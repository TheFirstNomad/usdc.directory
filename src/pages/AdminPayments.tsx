import { useEffect, useState, useCallback } from "react";
import { useAppKitAccount } from "@reown/appkit/react";
import { useSignMessage } from "wagmi";
import { TREASURY_ADDRESS, LISTING_FEE_DISPLAY } from "@/lib/web3";
import { getAdminAuthHeaders } from "@/lib/adminAuth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, RefreshCw, DollarSign, Clock, CheckCircle, AlertTriangle, Inbox, Star, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Submission {
  id: string;
  company_name: string;
  contact_email: string;
  website: string;
  description: string;
  categories: string[];
  region: string | null;
  wallet_address: string | null;
  payment_id: string | null;
  payment_status: string;
  status: string;
  created_at: string;
  partner_id: string | null;
}

interface Summary {
  revenueToday: number;
  revenueMonth: number;
  totalRevenue: number;
  totalPaid: number;
  pendingCount: number;
}

const statusColors: Record<string, string> = {
  finished: "bg-green-500/20 text-green-400 border-green-500/30",
  confirmed: "bg-green-500/20 text-green-400 border-green-500/30",
  sending: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  confirming: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  awaiting_payment: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  pending: "bg-muted text-muted-foreground border-border",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  expired: "bg-red-500/20 text-red-400 border-red-500/30",
};

const AdminPayments = () => {
  const { address, isConnected } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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
        `https://${projectId}.supabase.co/functions/v1/admin-payments`,
        { headers }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSubmissions(data.submissions);
      setSummary(data.summary);
      setLastRefresh(new Date());
    } catch {
      toast({ title: "Error", description: "Failed to load payment data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isOwner, address, toast, getHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(async (id: string) => {
    try {      const headers = await getHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-payments`,
        {
          method: "DELETE",
          headers,
          body: JSON.stringify({ id }),
        }
      );
      if (!res.ok) throw new Error("Failed to delete");
      setSubmissions((prev) => prev.filter((s) => s.id !== id));
      toast({ title: "Deleted", description: "Submission removed" });
    } catch {
      toast({ title: "Error", description: "Failed to delete submission", variant: "destructive" });
    }
  }, [toast, getHeaders]);

  useEffect(() => {
    if (!isOwner) return;
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [isOwner, fetchData]);

  const filtered = submissions.filter((s) => {
    const matchesSearch =
      !search ||
      s.company_name.toLowerCase().includes(search.toLowerCase()) ||
      s.payment_id?.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || s.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
                Connect the owner wallet to access the admin dashboard.
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
      <SEO title="Payment Monitor | USDC Directory" description="Admin payment dashboard" />
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payment Monitor</h1>
            <p className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/featured" className="gap-2">
                <Star className="h-4 w-4" /> Featured
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            title="Revenue Today"
            value={`$${summary?.revenueToday ?? 0}`}
            icon={<DollarSign className="h-5 w-5 text-green-400" />}
            loading={loading}
          />
          <SummaryCard
            title="Revenue This Month"
            value={`$${summary?.revenueMonth ?? 0}`}
            icon={<DollarSign className="h-5 w-5 text-primary" />}
            loading={loading}
          />
          <SummaryCard
            title="Total Paid Listings"
            value={String(summary?.totalPaid ?? 0)}
            icon={<CheckCircle className="h-5 w-5 text-green-400" />}
            loading={loading}
          />
          <SummaryCard
            title="Pending Payments"
            value={String(summary?.pendingCount ?? 0)}
            icon={<Clock className="h-5 w-5 text-yellow-400" />}
            loading={loading}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by company, payment ID, or listing ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-sm"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
              <SelectItem value="confirming">Confirming</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="sending">Sending</SelectItem>
              <SelectItem value="finished">Finished</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-4 p-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Inbox className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm">No payments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payment ID</TableHead>
                      <TableHead>Wallet</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(s.created_at).toLocaleDateString()}{" "}
                          <span className="text-muted-foreground">
                            {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">
                          {s.company_name}
                          {(s.contact_email === "ai-agent@autonomous" || s.categories?.includes("AI Agents") || s.categories?.includes("AI Agents & Automation")) && (
                            <Badge variant="outline" className="ml-2 text-[10px] border-cyan-500/30 text-cyan-400">🤖 AI Agent</Badge>
                          )}
                        </TableCell>
                        <TableCell>{LISTING_FEE_DISPLAY} USDC</TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs border ${statusColors[s.payment_status] ?? statusColors.pending}`}
                          >
                            {s.payment_status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[140px] truncate">
                          {s.payment_id || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground max-w-[140px] truncate">
                          {s.wallet_address
                            ? `${s.wallet_address.slice(0, 6)}…${s.wallet_address.slice(-4)}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete submission?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove <strong>{s.company_name}</strong> from the submissions table. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(s.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

const SummaryCard = ({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  loading: boolean;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      {loading ? (
        <div className="h-8 w-20 rounded bg-muted animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-foreground">{value}</p>
      )}
    </CardContent>
  </Card>
);

export default AdminPayments;
