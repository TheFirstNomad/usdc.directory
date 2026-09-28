import { useState } from "react";
import { Bot, Upload, CheckCircle2, Copy, ExternalLink, Globe2, Zap } from "lucide-react";
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
import { createViemAdapterFromWallet, payListingFee } from "@/lib/arcAppKit";

const ARC_CHAIN_ID = 5042 as const;

const CAPABILITIES = ["payments", "search", "trading", "content", "data", "automation", "defi", "nft", "gaming", "social"];

const SubmitAIAgent = () => {
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>("eip155");
  const [agentName, setAgentName] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCaps, setSelectedCaps] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payingArc, setPayingArc] = useState(false);
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

  const handleWebsiteBlur = () => {
    if (website && !website.startsWith("http://") && !website.startsWith("https://")) {
      setWebsite("https://" + website);
    }
  };

  const toggleCap = (cap: string) => {
    setSelectedCaps((prev) => prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]);
  };

  const uploadLogo = async (addr: string): Promise<string | null> => {
    if (!logoFile || !addr) return null;
    const formData = new FormData();
    formData.append("file", logoFile);
    formData.append("wallet_address", addr.trim());
    const { data, error } = await supabase.functions.invoke("upload-logo", { body: formData });
    if (error) return null;
    return data?.url || null;
  };

  const validateFields = () => {
    if (!agentName.trim()) { toast.error("Agent name is required"); return false; }
    if (!walletAddress.trim()) { toast.error("Agent wallet address is required"); return false; }
    if (!description.trim()) { toast.error("Description is required"); return false; }
    return true;
  };

  const submitToBackend = async (chain: string, txHash: string, payerWallet: string) => {
    const logoUrl = await uploadLogo(payerWallet);
    const { data, error } = await supabase.functions.invoke("submit-ai-agent", {
      body: {
        agent_name: agentName.trim(),
        wallet_address: payerWallet.trim(),
        description: description.trim(),
        website: website.trim() || undefined,
        capabilities: selectedCaps.length > 0 ? selectedCaps : undefined,
        networks: [chain],
        logo_url: logoUrl,
        payment_tx: txHash,
        chain,
      },
    });
    if (error) throw new Error((data as Record<string, string>)?.error ?? error.message);
    if ((data as Record<string, string>)?.error) throw new Error((data as Record<string, string>).error);
  };

  const handlePayOnBase = async () => {
    if (!validateFields()) return;
    if (!isConnected || !address) { toast.error("Connect your wallet first"); return; }
    setPaying(true);
    try {
      if (walletChainId !== BASE_CHAIN_ID) await switchChainAsync({ chainId: BASE_CHAIN_ID });
      const debug = buildBaseUsdcTransferCalldata(LISTING_FEE_USDC);
      const hash = await sendTransactionAsync({
        to: debug.to, data: debug.attributed,
        account: address as `0x${string}`,
        chainId: BASE_CHAIN_ID, value: 0n,
      } as Parameters<typeof sendTransactionAsync>[0]);
      if (basePublicClient) await basePublicClient.waitForTransactionReceipt({ hash });
      await submitToBackend("base", hash, address);
      setSuccess({ txHash: hash, chain: "base" });
      toast.success("AI Agent listed on Base!");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Payment failed on Base");
    } finally { setPaying(false); }
  };

  const handlePayOnArc = async () => {
    if (!validateFields()) return;
    if (!isConnected || !address || !walletProvider) { toast.error("Connect your wallet first"); return; }
    setPayingArc(true);
    try {
      const adapter = await createViemAdapterFromWallet(walletProvider, ARC_CHAIN_ID);
      const hash = await payListingFee(adapter, LISTING_FEE_USDC, "arc");
      await submitToBackend("arc", hash, address);
      setSuccess({ txHash: hash, chain: "arc" });
      toast.success("AI Agent listed on Arc!");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Payment failed on Arc");
    } finally { setPayingArc(false); }
  };

  const handleExternalSubmit = async () => {
    if (!validateFields()) return;
    if (!externalTx.trim()) { toast.error("Paste your tx hash"); return; }
    setSubmittingExternal(true);
    try {
      await submitToBackend(externalChainKey, externalTx.trim(), walletAddress);
      setSuccess({ txHash: externalTx.trim(), chain: externalChainKey });
      toast.success(`Verified on ${externalChainKey}!`);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Verification failed");
    } finally { setSubmittingExternal(false); }
  };

  const explorer = success ? getChain(success.chain)?.explorerTx(success.txHash) : undefined;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="List Your AI Agent: 1 USDC, Any Chain"
        description="Autonomous AI agents self-list in 30 seconds for 1 USDC. Pay on Arc, Base, Ethereum, Arbitrum, BNB, Solana, Sui, Near, and more."
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
              <p className="text-muted-foreground">
                {agentName} is now live on USDC Directory. Verified on {success.chain}.
              </p>
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
                <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">List Your AI Agent</h1>
                <p className="text-muted-foreground text-base max-w-md mx-auto">
                  1 USDC on any chain. Arc is recommended: USDC is the gas token, sub-second finality.
                </p>
              </div>

              <div className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
                {/* Agent Name */}
                <div className="space-y-2">
                  <label htmlFor="agent-name" className="text-sm font-semibold text-foreground">Agent Name *</label>
                  <Input id="agent-name" placeholder="e.g. PayBot3000" value={agentName}
                    onChange={(e) => setAgentName(e.target.value)} maxLength={100} className="rounded-xl h-12" />
                </div>

                {/* Wallet */}
                <div className="space-y-2">
                  <label htmlFor="agent-wallet" className="text-sm font-semibold text-foreground">Agent Wallet (payer) *</label>
                  <Input id="agent-wallet" placeholder="0x… / Solana pubkey / Sui addr / near.account"
                    value={walletAddress} onChange={(e) => setWalletAddress(e.target.value)}
                    maxLength={256} className="rounded-xl h-12 font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Displayed on your agent card as on-chain identity.</p>
                </div>

                {/* Website */}
                <div className="space-y-2">
                  <label htmlFor="agent-website" className="text-sm font-semibold text-foreground">Website / Docs / API</label>
                  <Input id="agent-website" type="url" placeholder="yourbot.ai or https://yourbot.ai"
                    value={website} onChange={(e) => setWebsite(e.target.value)}
                    onBlur={handleWebsiteBlur} maxLength={255} className="rounded-xl h-12" />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label htmlFor="agent-description" className="text-sm font-semibold text-foreground">Description *</label>
                  <Input id="agent-description" placeholder="What does your agent do?"
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    maxLength={300} className="rounded-xl h-12" />
                  <p className="text-xs text-muted-foreground text-right">{description.length}/300</p>
                </div>

                {/* Capabilities */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">Capabilities (optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {CAPABILITIES.map((cap) => (
                      <button key={cap} type="button" onClick={() => toggleCap(cap)}
                        className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                          selectedCaps.includes(cap)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                        }`}>
                        {cap}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo */}
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
                      {logoPreview ? "Change logo" : "Upload logo (JPG, PNG, SVG, max 2MB)"}
                      <input type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                        className="hidden" onChange={handleLogoChange} />
                    </label>
                  </div>
                </div>

                {/* Pay buttons */}
                {isConnected ? (
                  <div className="space-y-3">
                    <Button onClick={handlePayOnArc} disabled={payingArc || paying}
                      className="w-full h-14 text-base font-bold rounded-xl bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground">
                      <Zap className="h-5 w-5 mr-2" />
                      {payingArc ? "Processing on Arc…" : "Pay 1 USDC on Arc (Recommended)"}
                    </Button>
                    <Button onClick={handlePayOnBase} disabled={paying || payingArc}
                      variant="outline" className="w-full h-12 rounded-xl font-semibold">
                      {paying ? "Processing on Base…" : "Pay 1 USDC on Base"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-center text-muted-foreground py-2">
                    Connect your wallet to pay on Arc or Base, or use any chain below.
                  </p>
                )}

                {/* External multichain path */}
                <div className="pt-1">
                  <button onClick={() => setShowExternal((v) => !v)}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 w-full justify-center">
                    <Globe2 className="h-3.5 w-3.5" />
                    {showExternal ? "Hide" : "Or pay from Solana, Sui, Near, BNB, ETH, Arbitrum, Polygon…"}
                  </button>
                </div>

                {showExternal && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Send <strong>1 USDC</strong> to our treasury on your chain, paste the tx hash. We verify on-chain and publish instantly.
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
                          <button onClick={() => { navigator.clipboard.writeText(ch.treasury); toast.success("Copied"); }}
                            className="text-primary shrink-0">
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
                      {submittingExternal ? "Verifying on-chain…" : "Verify 1 USDC and list agent"}
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
