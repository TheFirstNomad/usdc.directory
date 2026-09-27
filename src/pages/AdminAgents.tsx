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
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, RefreshCw, DollarSign, Zap, Activity, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AgentPayment {
  id: string;
  payment_id: string;
  endpoint: string;
  method: string;
  amount_usdc: number;
  chain: string;
  scheme: string;
  agent_wallet: string | null;
  paid_at: string;
}

interface AgentBoost {
  id: string;
  partner_id: string;
  amount_usdc: number;
  chain: string;
  payment_id: string;
  created_at: string;
  expires_at: string;
}

interface Summary {
  callsTotal: number;
  callsToday: number;
  revenueApiTotal: number;
  revenueApiMonth: number;
  boostsActive: number;
  revenueBoostsTotal: number;
}

const AdminAgents = () => {
  const { address, isConnected } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  const { toast } = useToast();
  const [payments, setPayments] = useState<AgentPayment[]>([]);
  const [boosts, setBoosts] = useState<AgentBoost[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwner = isConnected && address?.toLowerCase() === TREASURY_ADDRESS.toLowerCase();

  const fetchData = useCallback(async () => {
    if (!isOwner || !address) return;
    setLoading(true);
    try {      const headers = await getAdminAuthHeaders(address, (args: any) =>
        signMessageAsync({ ...args, account: address as `0x${string}` })
      );
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/admin-agents`, { headers });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setPayments(data.payments || []);
      setBoosts(data.boosts || []);
      setSummary(data.summary || null);
    } catch {
      toast({ title: "Error", description: "Failed to load agent data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isOwner, address, signMessageAsync, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!isConnected || !isOwner) {
    return (
      <>
        <SEO title="Unauthorized | USDC Directory" description="Admin only" />
        <Header />
        <main className="min-h-[70vh] flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="flex flex-col items-center gap-4 py-12">
              <ShieldAlert className="h-16 w-16 text-destructive" />
              <h2 className="text-xl font-bold text-foreground">Unauthorized</h2>
              <p className="text-muted-foreground text-center text-sm">
                Connect the owner wallet to access this dashboard.
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
      <SEO title="Agent API Monitor | USDC Directory" description="Admin dashboard for agent API payments and boosts" />
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agent API Monitor</h1>
            <p className="text-sm text-muted-foreground">x402 payments and boost revenue</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard title="API Calls (Today)" value={String(summary?.callsToday ?? 0)} icon={<Activity className="h-5 w-5 text-primary" />} />
          <SummaryCard title="API Calls (Total)" value={String(summary?.callsTotal ?? 0)} icon={<TrendingUp className="h-5 w-5 text-primary" />} />
          <SummaryCard title="API Revenue (Month)" value={`$${(summary?.revenueApiMonth ?? 0).toFixed(3)}`} icon={<DollarSign className="h-5 w-5 text-green-400" />} />
          <SummaryCard title="Active Boosts" value={String(summary?.boostsActive ?? 0)} icon={<Zap className="h-5 w-5 text-amber-400" />} />
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent API Payments</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead>Agent Wallet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No payments yet</TableCell></TableRow>
                  ) : payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(p.paid_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{p.endpoint}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{p.method}</Badge></TableCell>
                      <TableCell>${(Number(p.amount_usdc) / 1_000_000).toFixed(3)}</TableCell>
                      <TableCell className="text-xs">{p.chain}</TableCell>
                      <TableCell className="text-xs">{p.scheme}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {p.agent_wallet ? `${p.agent_wallet.slice(0, 6)}…${p.agent_wallet.slice(-4)}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Boost Purchases</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchased</TableHead>
                    <TableHead>Partner ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boosts.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No boosts yet</TableCell></TableRow>
                  ) : boosts.map((b) => {
                    const active = new Date(b.expires_at).getTime() > Date.now();
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="whitespace-nowrap text-xs">{new Date(b.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs">{b.partner_id.slice(0, 8)}…</TableCell>
                        <TableCell>${(Number(b.amount_usdc) / 1_000_000).toFixed(2)}</TableCell>
                        <TableCell className="text-xs">{b.chain}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{new Date(b.expires_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge className={active ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-muted text-muted-foreground"}>
                            {active ? "Active" : "Expired"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </>
  );
};

const SummaryCard = ({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </CardContent>
  </Card>
);

export default AdminAgents;
