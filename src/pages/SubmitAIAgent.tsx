import { useState } from "react";
import { Bot, Upload, CheckCircle2, Copy, ExternalLink, Globe2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { useSendTransaction, useChainId, useSwitchChain, usePublicClient } from "wagmi";
import { buildBaseUsdcTransferCalldata, BASE_CHAIN_ID } from "@/lib/basePayment";
import { PAYMENT_CHAINS, getChain, LISTING_FEE_USDC } from "@/lib/multichainPayments";

const SubmitAIAgent = () => {
  const { address, isConnected } = useAppKitAccount();
  const [agentName, setAgentName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState<{ txHash: string; chain: string } | null>(null);

  // External multichain path
  const [showExternal, setShowExternal] = useState(false);
  const [externalChainKey, setExternalChainKey] = useState("ethereum");
  const [externalTx, setExternalTx] = useState("");
  const [submittingExternal, setSubmittingExternal] = useState(false);

  const { sendTransactionAsync } = useSendTransaction();
  const basePublicClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const walletChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile || !walletAddress) return null;
    const formData = new FormData();
    formData.append("file", logoFile);
    formData.append("wallet_address", walletAddress.trim());
    const { data, error } = await supabase.functions.invoke("upload-logo", { body: formData });
    if (error) return null;
    return data?.url || null;
  };

  const submitToBackend = async (chain: string, txHash: string, payerWallet: string) => {
    const logoUrl = await uploadLogo();
    const { data, error } = await supabase.functions.invoke("submit-ai-agent", {
      body: {
        agent_name: agentName.trim(),
        wallet_address: payerWallet.trim(),
        description: description.trim(),
        logo_url: logoUrl,
        payment_tx: txHash,
        chain,
      },
    });
    if (error) throw new Error((data as any)?.error ?? error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
  };

  const handlePayOnBase = async () => {
    if (!agentName.trim() || !walletAddress.trim() || !description.trim()) {
      toast.error("Fill in all required fields"); return;
    }
    if (!isConnected || !address) { toast.error("Connect your wallet first"); return; }
    setPaying(true);
    try {
      if (walletChainId !== BASE_CHAIN_ID) {
        await switchChainAsync({ chainId: BASE_CHAIN_ID });
      }
      const debug = buildBaseUsdcTransferCalldata(LISTING_FEE_USDC);
      const hash = await sendTransactionAsync({
        to: debug.to, data: debug.attributed,
        account: address as `0x${string}`,
        chainId: BASE_CHAIN_ID, value: 0n,
      } as Parameters<typeof sendTransactionAsync>[0]);
      if (basePublicClient) await basePublicClient.waitForTransactionReceipt({ hash });
      await submitToBackend("base", hash, address);
      setSuccess({ txHash: hash, chain: "base" });
      toast.success("AI Agent listed!");
    } catch (err: any) {
      toast.error(err.message || "Payment failed on Base");
    } finally { setPaying(false); }
  };

  const handleExternalSubmit = async () => {
    if (!agentName.trim() || !walletAddress.trim() || !description.trim()) {
      toast.error("Fill in all required fields"); return;
    }
    if (!externalTx.trim()) { toast.error("Paste your tx hash"); return; }
    setSubmittingExternal(true);
    try {
      await submitToBackend(externalChainKey, externalTx.trim(), walletAddress);
      setSuccess({ txHash: externalTx.trim(), chain: externalChainKey });
      toast.success(`Verified on ${externalChainKey}!`);
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally { setSubmittingExternal(false); }
  };

  const explorer = success ? getChain(success.chain)?.explorerTx(success.txHash) : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="List Your AI Agent — 1 USDC, Any Chain"
        description="Autonomous AI agents self-list in 30 seconds for 1 USDC. Pay on Base, Ethereum, Arbitrum, BNB, Solana, Sui, Near, and more."
        path="/submit/ai-agent"
      />
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {success ? (
            <div className="bg-card border border-border rounded-3xl p-8 text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Listed Successfully!</h1>
              <p className="text-muted-foreground">Verified on {success.chain}.</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate max-w-[220px]">{success.txHash}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7"
                  onClick={() => { navigator.clipboard.writeText(success.txHash); toast.success("Copied!"); }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              {explorer && (
                <Button asChild variant="outline" className="rounded-xl">
                  <a href={explorer} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" /> View on explorer
                  </a>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">🤖 List Your AI Agent — 1 USDC</h1>
                <p className="text-muted-foreground text-base max-w-md mx-auto">
                  Any chain — Base, Ethereum, Arbitrum, Optimism, Polygon, BNB, Linea, Solana, Sui, Near.
                </p>
              </div>

              <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                <div className="space-y-2">
                  <label htmlFor="agent-name" className="text-sm font-semibold text-foreground">Agent Name *</label>
                  <Input id="agent-name" placeholder="e.g. PayBot3000" value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={100} className="rounded-xl h-12" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="agent-wallet" className="text-sm font-semibold text-foreground">Agent Wallet (payer) *</label>
                  <Input id="agent-wallet" placeholder="0x… / Solana pubkey / Sui addr / near.account" value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)} maxLength={256} className="rounded-xl h-12 font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="agent-description" className="text-sm font-semibold text-foreground">Description *</label>
                  <Input id="agent-description" placeholder="What does your agent do?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} className="rounded-xl h-12" />
                  <p className="text-xs text-muted-foreground text-right">{description.length}/300</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Logo (optional)</label>
                  <div className="flex items-center gap-4">
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo preview" className="w-12 h-12 rounded-xl object-cover border border-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <label className="cursor-pointer text-sm text-primary hover:underline font-medium">
                      {logoPreview ? "Change logo" : "Upload logo"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    </label>
                  </div>
                </div>

                {isConnected ? (
                  <Button onClick={handlePayOnBase} disabled={paying}
                    className="w-full h-14 text-lg font-bold rounded-xl bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground">
                    {paying ? "Processing…" : `Pay 1 USDC on Base & List`}
                  </Button>
                ) : (
                  <p className="text-sm text-center text-muted-foreground">Connect your wallet for the Base path, or use any chain below.</p>
                )}

                <div className="pt-2">
                  <button onClick={() => setShowExternal((v) => !v)}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 w-full justify-center">
                    <Globe2 className="h-3.5 w-3.5" />
                    {showExternal ? "Hide" : "Or pay from Solana, Sui, Near, BNB, ETH, Arbitrum, Polygon…"}
                  </button>
                </div>

                {showExternal && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Send <strong>1 USDC</strong> to our treasury on your chain, paste the tx hash, we verify on-chain.
                    </p>
                    <select value={externalChainKey} onChange={(e) => setExternalChainKey(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      {PAYMENT_CHAINS.map((c) => (
                        <option key={c.key} value={c.key}>{c.label} ({c.family.toUpperCase()})</option>
                      ))}
                    </select>
                    {(() => { const ch = getChain(externalChainKey); return ch && (
                      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Treasury ({ch.label})</p>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-mono text-foreground break-all">{ch.treasury}</p>
                          <button onClick={() => { navigator.clipboard.writeText(ch.treasury); toast.success("Copied"); }} className="text-primary shrink-0">
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {ch.usdc && <p className="text-[10px] text-muted-foreground break-all">USDC: <span className="font-mono">{ch.usdc}</span></p>}
                      </div>
                    ); })()}
                    <Input value={externalTx} onChange={(e) => setExternalTx(e.target.value)}
                      placeholder="Paste tx hash / signature" className="font-mono text-xs" />
                    <Button onClick={handleExternalSubmit} disabled={submittingExternal}
                      className="w-full bg-primary text-primary-foreground rounded-lg">
                      {submittingExternal ? "Verifying on-chain…" : "Verify 1 USDC & list agent"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SubmitAIAgent;
