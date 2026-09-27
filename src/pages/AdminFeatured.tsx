import { useEffect, useState, useCallback } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useSignMessage } from "wagmi";
import { TREASURY_ADDRESS } from "@/lib/web3";
import { getAdminAuthHeaders } from "@/lib/adminAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShieldAlert, RefreshCw, Star, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface PartnerRow {
  id: string;
  name: string;
  logo_url: string | null;
  logo_emoji: string | null;
  website: string | null;
  categories: string[];
  region: string | null;
  featured: boolean | null;
  created_at: string;
}

const AdminFeatured = () => {
  const { address, isConnected } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [featuredCount, setFeaturedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const isOwner =
    isConnected &&
    address?.toLowerCase() === TREASURY_ADDRESS.toLowerCase();

  const getHeaders = useCallback(async () => {
    if (!address) throw new Error("No wallet connected");
    return getAdminAuthHeaders(address, (args: any) => signMessageAsync({ ...args, account: address as `0x${string}` }));
  }, [address, signMessageAsync]);

  const fetchData = useCallback(async () => {
    if (!isOwner || !address) return;
    setLoading(true);
    try {      const headers = await getHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-featured`,
        { headers }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPartners(data.partners);
      setFeaturedCount(data.featuredCount);
    } catch {
      toast({ title: "Error", description: "Failed to load listings", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isOwner, address, toast, getHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleFeatured = async (partnerId: string, newValue: boolean) => {
    if (!address) return;
    setToggling(partnerId);
    try {      const headers = await getHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-featured`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ partnerId, featured: newValue }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      setPartners((prev) =>
        prev.map((p) => (p.id === partnerId ? { ...p, featured: newValue } : p))
      );
      setFeaturedCount((c) => (newValue ? c + 1 : c - 1));
      toast({
        title: newValue ? "Featured ⭐" : "Unfeatured",
        description: `Listing ${newValue ? "added to" : "removed from"} featured.`,
      });
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const filtered = partners.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.categories.some((c) => c.toLowerCase().includes(search.toLowerCase()))
  );

  const logoUrl = (p: PartnerRow) =>
    p.logo_url && p.logo_url !== ""
      ? p.logo_url
      : `https://logo.clearbit.com/${p.website?.replace(/https?:\/\//, "").replace(/\/.*/, "") || p.name.toLowerCase().replace(/\s+/g, "") + ".com"}`;

  if (!isConnected || !isOwner) {
    return (
      <>
        <SEO title="Unauthorized | USDC Directory" description="Admin access only" />
        <Header />
        <main className="min-h-[70vh] flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <ShieldAlert className="h-16 w-16 text-destructive" />
              <h2 className="text-xl font-bold text-foreground">Unauthorized</h2>
              <p className="text-muted-foreground text-center text-sm">
                Connect the owner wallet to access featured management.
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
      <SEO title="Featured Management | USDC Directory" description="Manage featured listings" />
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-1 -ml-2 gap-1 text-muted-foreground">
              <Link to="/admin/payments"><ArrowLeft className="h-4 w-4" /> Payments</Link>
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Featured Management</h1>
            <p className="text-sm text-muted-foreground">
              {featuredCount}/4 featured slots used
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="flex gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full transition-colors ${
                i < featuredCount ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <Input
          placeholder="Search by name or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />

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
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Listing</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead className="text-center">Featured</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((p) => (
                      <TableRow key={p.id} className={p.featured ? "bg-primary/5" : ""}>
                        <TableCell>
                          <img
                            src={logoUrl(p)}
                            alt={p.name}
                            className="w-8 h-8 rounded-lg object-contain bg-card"
                            onError={(e) => {
                              e.currentTarget.src =
                                "https://cryptologos.cc/logos/usd-coin-usdc-logo.png";
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {p.categories.slice(0, 2).map((c, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">
                                {c}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.region || "Global"}
                        </TableCell>
                        <TableCell className="text-center">
                          {toggling === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />
                          ) : (
                            <Switch
                              checked={!!p.featured}
                              onCheckedChange={(val) => toggleFeatured(p.id, val)}
                              disabled={!p.featured && featuredCount >= 4}
                            />
                          )}
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
      <Footer />
    </>
  );
};

export default AdminFeatured;
