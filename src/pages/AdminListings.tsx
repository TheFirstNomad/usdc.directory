// Admin Manage Listings page — full CRUD table for partners
const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
import { useEffect, useState, useCallback } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useSignMessage } from "wagmi";
import { TREASURY_ADDRESS } from "@/lib/web3";
import { getAdminAuthHeaders } from "@/lib/adminAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, RefreshCw, Pencil, Trash2, Loader2, Star, DollarSign, ArrowLeft, Check, X, Clock, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { CATEGORIES as ALL_CATEGORIES } from "@/lib/partners";

interface PartnerRow {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  logo_emoji: string | null;
  website: string | null;
  categories: string[];
  region: string | null;
  featured: boolean | null;
  payment_status: string;
  created_at: string;
}

const AdminListings = () => {
  const { address, isConnected } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending_review" | "confirmed">("all");
  const [editPartner, setEditPartner] = useState<PartnerRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectTarget, setRejectTarget] = useState<{ ids: string[]; names: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const isOwner = isConnected && address?.toLowerCase() === TREASURY_ADDRESS.toLowerCase();

  const getHeaders = useCallback(async () => {
    if (!address) throw new Error("No wallet connected");
    return getAdminAuthHeaders(address, (args: any) => signMessageAsync({ ...args, account: address as `0x${string}` }));
  }, [address, signMessageAsync]);

  const fetchData = useCallback(async () => {
    if (!isOwner || !address) return;
    setLoading(true);
    try {      const headers = await getHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-listings`,
        { headers }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPartners(data.partners);
    } catch {
      toast({ title: "Error", description: "Failed to load listings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isOwner, address, toast, getHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    try {      const headers = await getHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-listings`,
        {
          method: "DELETE",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        }
      );
      if (!res.ok) throw new Error("Failed to delete");
      setPartners((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "Deleted", description: "Listing removed" });
    } catch {
      toast({ title: "Error", description: "Failed to delete listing", variant: "destructive" });
    }
  }, [toast, getHeaders]);

  const handleSave = useCallback(async () => {
    if (!editPartner || !address) return;
    setSaving(true);
    try {      const headers = await getHeaders();
      const payload = {
        id: editPartner.id,
        name: editPartner.name,
        description: editPartner.description,
        website: editPartner.website,
        categories: editPartner.categories,
        region: editPartner.region,
      };
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-listings`,
        {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Failed to update");
      }
      setPartners((prev) =>
        prev.map((p) => (p.id === editPartner.id ? { ...p, ...editPartner } : p))
      );
      setEditPartner(null);
      toast({ title: "Updated", description: "Listing saved" });
    } catch (err) {
      console.error("[AdminListings] Save error:", err);
      toast({ title: "Error", description: (err as Error)?.message || "Failed to update listing", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [editPartner, address, toast, getHeaders]);

  const handleToggleFeatured = useCallback(async (id: string, featured: boolean) => {
    try {      const headers = await getHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-listings`,
        {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id, featured }),
        }
      );
      if (!res.ok) throw new Error("Failed to update");
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, featured } : p)));
    } catch {
      toast({ title: "Error", description: "Failed to toggle featured", variant: "destructive" });
    }
  }, [toast, getHeaders]);

  const handleModerate = useCallback(async (id: string, action: "approve" | "reject", reason?: string) => {
    setActionLoadingId(id);
    try {      const headers = await getHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-listings`,
        {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id, action, reason }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      const newStatus = action === "approve" ? "confirmed" : "rejected";
      setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, payment_status: newStatus } : p)));
      toast({ title: action === "approve" ? "Approved" : "Rejected", description: `Listing ${action === "approve" ? "is now live" : "has been rejected"}` });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message || `Failed to ${action} listing`, variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  }, [toast, getHeaders]);

  const runBulk = useCallback(async (action: "approve" | "reject" | "delete", reason?: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {      const headers = await getHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-listings`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action, reason }),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Bulk action failed");
      if (action === "delete") {
        setPartners((prev) => prev.filter((p) => !selected.has(p.id)));
      } else {
        const newStatus = action === "approve" ? "confirmed" : "rejected";
        setPartners((prev) => prev.map((p) => (selected.has(p.id) ? { ...p, payment_status: newStatus } : p)));
      }
      setSelected(new Set());
      toast({ title: "Done", description: `${ids.length} listing(s) ${action}d` });
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBulkBusy(false);
    }
  }, [selected, toast, getHeaders]);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {      const headers = await getHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-listings?resource=audit`,
        { headers }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed");
      setAuditEntries(body.entries || []);
    } catch (err) {
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setAuditLoading(false);
    }
  }, [toast, getHeaders]);

  const openAudit = useCallback(() => {
    setAuditOpen(true);
    fetchAudit();
  }, [fetchAudit]);

  const submitReject = useCallback(async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    if (rejectTarget.ids.length === 1) {
      await handleModerate(rejectTarget.ids[0], "reject", rejectReason.trim());
    } else {
      // bulk: temporarily inject ids
      setSelected(new Set(rejectTarget.ids));
      await runBulk("reject", rejectReason.trim());
    }
    setRejectTarget(null);
    setRejectReason("");
  }, [rejectTarget, rejectReason, handleModerate, runBulk]);

  const filtered = partners.filter((p) => {
    if (statusFilter !== "all" && p.payment_status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingCount = partners.filter((p) => p.payment_status === "pending_review").length;

  if (!isConnected || !isOwner) {
    return (
      <>
        <SEO title="Unauthorized" description="Admin access only" />
        <Header />
        <main className="min-h-[70vh] flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <ShieldAlert className="h-16 w-16 text-destructive" />
              <h2 className="text-xl font-bold text-foreground">Unauthorized</h2>
              <p className="text-muted-foreground text-center text-sm">
                Connect the owner wallet to access listing management.
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SEO title="Manage Listings | USDC Directory" description="Admin listing management" />
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">{partners.length} total listings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openAudit} className="gap-2">
              <FileText className="h-4 w-4" /> Audit Log
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border pb-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/payments" className="gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" /> Payment Monitor
            </Link>
          </Button>
          <Button variant="secondary" size="sm" className="gap-2">
            <Pencil className="h-4 w-4" /> Manage Listings
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/featured" className="gap-2 text-muted-foreground">
              <Star className="h-4 w-4" /> Featured
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search listings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex gap-1 ml-auto">
            <Button size="sm" variant={statusFilter === "all" ? "secondary" : "ghost"} onClick={() => setStatusFilter("all")}>All ({partners.length})</Button>
            <Button size="sm" variant={statusFilter === "pending_review" ? "secondary" : "ghost"} onClick={() => setStatusFilter("pending_review")} className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Pending {pendingCount > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{pendingCount}</Badge>}
            </Button>
            <Button size="sm" variant={statusFilter === "confirmed" ? "secondary" : "ghost"} onClick={() => setStatusFilter("confirmed")}>Live</Button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
            <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
            <div className="flex gap-2 ml-auto">
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set())} disabled={bulkBusy}>Clear</Button>
              <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => runBulk("approve")} disabled={bulkBusy}>
                {bulkBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                const ids = Array.from(selected);
                const names = filtered.filter((p) => selected.has(p.id)).map((p) => p.name).join(", ");
                setRejectTarget({ ids, names });
                setRejectReason("");
              }} disabled={bulkBusy}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1.5" disabled={bulkBusy}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selected.size} listing(s)?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => runBulk("delete")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-4 p-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={
                            filtered.length > 0 && filtered.every((p) => selected.has(p.id))
                              ? true
                              : filtered.some((p) => selected.has(p.id))
                                ? "indeterminate"
                                : false
                          }
                          disabled={filtered.length === 0}
                          onCheckedChange={(val) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (val) {
                                filtered.forEach((p) => next.add(p.id));
                              } else {
                                filtered.forEach((p) => next.delete(p.id));
                              }
                              return next;
                            });
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Business Name</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Featured</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id} className={p.featured ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={(val) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (val) next.add(p.id); else next.delete(p.id);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {p.logo_url ? (
                            <img
                              src={p.logo_url}
                              alt={p.name}
                              className="w-8 h-8 rounded-lg object-contain bg-card"
                              onError={(e) => { e.currentTarget.src = "https://cryptologos.cc/logos/usd-coin-usdc-logo.png"; }}
                            />
                          ) : (
                            <span className="text-xl">{p.logo_emoji || "🏢"}</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{p.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[300px] truncate">
                          {p.description}
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.payment_status === "confirmed" ? "default" : "secondary"} className="text-[10px]">
                            {p.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={!!p.featured}
                            onCheckedChange={(val) => handleToggleFeatured(p.id, val)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {p.payment_status === "pending_review" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-success"
                                  onClick={() => handleModerate(p.id, "approve")}
                                  disabled={actionLoadingId === p.id}
                                  title="Approve"
                                >
                                  {actionLoadingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => { setRejectTarget({ ids: [p.id], names: p.name }); setRejectReason(""); }}
                                  disabled={actionLoadingId === p.id}
                                  title="Reject"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => setEditPartner({ ...p })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete listing?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove <strong>{p.name}</strong>. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(p.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!editPartner} onOpenChange={(open) => !open && setEditPartner(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
          </DialogHeader>
          {editPartner && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <label className="text-sm font-medium text-foreground">Business Name</label>
                <Input
                  value={editPartner.name}
                  onChange={(e) => setEditPartner({ ...editPartner, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={editPartner.description}
                  onChange={(e) => setEditPartner({ ...editPartner, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Website</label>
                <Input
                  value={editPartner.website || ""}
                  onChange={(e) => setEditPartner({ ...editPartner, website: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Region</label>
                <Input
                  value={editPartner.region || ""}
                  onChange={(e) => setEditPartner({ ...editPartner, region: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Categories</label>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                  {ALL_CATEGORIES.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={editPartner.categories.includes(cat)}
                        onChange={() => {
                          const cats = editPartner.categories.includes(cat)
                            ? editPartner.categories.filter((c) => c !== cat)
                            : [...editPartner.categories, cat];
                          setEditPartner({ ...editPartner, categories: cats });
                        }}
                        className="w-3.5 h-3.5 rounded accent-primary"
                      />
                      <span className="text-muted-foreground">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPartner(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget && rejectTarget.ids.length > 1 ? `${rejectTarget.ids.length} listings` : "listing"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground line-clamp-2">{rejectTarget?.names}</p>
            <div>
              <label className="text-sm font-medium text-foreground">Reason (visible to submitter)</label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                placeholder="e.g. Description doesn't clearly explain USDC integration."
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground mt-1">{rejectReason.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={submitReject} disabled={!rejectReason.trim() || bulkBusy || actionLoadingId !== null}>
              {(bulkBusy || actionLoadingId) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Audit Log</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto -mx-6 px-6">
            {auditLoading ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded bg-muted animate-pulse" />)}
              </div>
            ) : auditEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No audit entries yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Listing</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Admin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditEntries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{e.action.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{e.partner_name || e.partner_id?.slice(0, 8) || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">{e.reason || "—"}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{e.admin_address.slice(0, 6)}…{e.admin_address.slice(-4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={fetchAudit} disabled={auditLoading} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${auditLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </>
  );
};

export default AdminListings;
