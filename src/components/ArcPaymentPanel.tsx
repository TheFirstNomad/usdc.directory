/**
 * ArcPaymentPanel — 1 USDC listing fee, payable on ANY supported chain.
 *
 * Two paths:
 *   1. Base Mainnet — direct USDC transfer via wagmi with ERC-8021 attribution.
 *   2. Any other chain (Ethereum, Arbitrum, Optimism, Polygon, Avalanche, BNB,
 *      Linea, Solana, Sui, Near, …) — agent pays USDC to the treasury on their
 *      chain, then pastes the tx hash here. Backend verifies on-chain.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, Copy, ExternalLink, Loader2, Wallet, Droplets,
  AlertTriangle, ShieldCheck, RefreshCw, Globe2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppKitAccount, useAppKit } from "@reown/appkit/react";
import { useSendTransaction, usePublicClient, useChainId, useSwitchChain } from "wagmi";
import { encodeFunctionData, parseAbi } from "viem";
import {
  getExplorerUrl, getExplorerName, getChainLabel, type PaymentChainId,
} from "@/lib/arcAppKit";
import {
  buildBaseUsdcTransferCalldata, getBaseScanInputDataUrl,
  BASE_CHAIN_ID, BASE_USDC_ADDRESS, type BasePaymentDebug,
} from "@/lib/basePayment";
import { useChainContext } from "@/contexts/ChainContext";
import {
  PAYMENT_CHAINS, LISTING_FEE_USDC, LISTING_FEE_BASE_UNITS, EVM_TREASURY, getChain,
} from "@/lib/multichainPayments";

// ── Arc Mainnet listing payment constants ──
const ARC_CHAIN_ID = 5042 as const;
const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
// Fee is defined in multichainPayments — import keeps it in sync across all chains
const ERC20_TRANSFER_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

interface ArcPaymentPanelProps {
  type: "listing" | "update";
  submissionData: Record<string, unknown>;
  onSuccess: (txHash: string) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Saves the listing after payment. Because the money has already moved on-chain,
 * this NEVER gives up on a transient failure: it retries network errors and
 * server-side (5xx) errors with backoff. Only a definitive rejection (4xx) or a
 * duplicate (409 — already saved) stops the loop.
 */
async function persistListing(
  type: "listing" | "update",
  txHash: string,
  walletAddress: string,
  submissionData: Record<string, unknown>,
  chain: string,
  attempts = 4,
) {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;

  let lastError = "Failed to save listing";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/submit-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type, tx_hash: txHash, chain, wallet_address: walletAddress, data: submissionData,
        }),
      });
      if (res.ok) return res.json();

      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      lastError = err.error || `HTTP ${res.status}`;

      // Already saved by a previous attempt — treat as success.
      if (res.status === 409) return { success: true, duplicate: true };
      // Client-side rejection won't get better by retrying.
      if (res.status < 500 && res.status !== 408 && res.status !== 429) {
        throw new Error(lastError);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // A thrown definitive rejection propagates immediately.
      if (msg === lastError && !/fetch|network|load failed/i.test(msg)) throw e;
      lastError = msg;
    }
    if (attempt < attempts) await sleep(1200 * attempt);
  }
  throw new Error(lastError);
}

const ArcPaymentPanel = ({ type, submissionData, onSuccess }: ArcPaymentPanelProps) => {
  const { toast } = useToast();
  const { isConnected, address } = useAppKitAccount();
  const { open } = useAppKit();
  const { chainId } = useChainContext();

  const { sendTransactionAsync } = useSendTransaction();
  const basePublicClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const arcPublicClient = usePublicClient({ chainId: ARC_CHAIN_ID });
  const walletChainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  const [paying, setPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paidChain, setPaidChain] = useState<string>("base");
  const [error, setError] = useState<string | null>(null);
  const [baseDebug, setBaseDebug] = useState<BasePaymentDebug | null>(null);
  const [unsavedPayment, setUnsavedPayment] = useState<{ hash: string; chainKey: string; payer: string } | null>(null);
  const [retrying, setRetrying] = useState(false);

  // External "paste tx hash" multichain path
  const [showExternal, setShowExternal] = useState(false);
  const [externalChainKey, setExternalChainKey] = useState<string>("ethereum");
  const [externalTx, setExternalTx] = useState("");
  const [externalWallet, setExternalWallet] = useState("");
  const [submittingExternal, setSubmittingExternal] = useState(false);

  const fee = LISTING_FEE_USDC;
  const paymentChainId = chainId as PaymentChainId;
  const chainLabel = getChainLabel(paymentChainId);
  const explorerName = getExplorerName(paymentChainId);
  const isBase = paymentChainId === BASE_CHAIN_ID;
  const isArc = paymentChainId === ARC_CHAIN_ID;
  const activeChainId: PaymentChainId = isArc ? ARC_CHAIN_ID : BASE_CHAIN_ID;
  const activeChainKey = isArc ? "arc" : "base";

  // ── Base Mainnet pay path ──
  const payOnBase = async (): Promise<string> => {
    if (!address) throw new Error("Wallet not connected");
    const debug = buildBaseUsdcTransferCalldata(fee);
    setBaseDebug(debug);
    const hash = await sendTransactionAsync({
      to: debug.to, data: debug.attributed,
      account: address as `0x${string}`,
      chainId: BASE_CHAIN_ID, value: 0n,
    } as Parameters<typeof sendTransactionAsync>[0]);
    if (basePublicClient) await basePublicClient.waitForTransactionReceipt({ hash });
    return hash;
  };

  // ── Arc Mainnet pay path (USDC ERC-20 transfer, USDC is also gas) ──
  const payOnArc = async (): Promise<string> => {
    if (!address) throw new Error("Wallet not connected");
    const data = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [EVM_TREASURY as `0x${string}`, LISTING_FEE_BASE_UNITS],
    });
    const hash = await sendTransactionAsync({
      to: ARC_USDC_ADDRESS, data,
      account: address as `0x${string}`,
      chainId: ARC_CHAIN_ID, value: 0n,
    } as Parameters<typeof sendTransactionAsync>[0]);
    if (arcPublicClient) await arcPublicClient.waitForTransactionReceipt({ hash });
    return hash;
  };

  /** Saves a confirmed payment; keeps the hash around so the user can retry. */
  const saveAfterPayment = async (hash: string, chainKey: string, payer: string) => {
    try {
      await persistListing(type, hash, payer, submissionData, chainKey);
    } catch (saveErr: unknown) {
      const message = saveErr instanceof Error ? saveErr.message : String(saveErr);
      setUnsavedPayment({ hash, chainKey, payer });
      setError(`Your payment is confirmed on-chain and safe. Saving the listing didn't go through yet: ${message}. Tap "Retry saving my listing" below — you will not be charged again.`);
      toast({
        title: "Payment safe — listing not saved yet",
        description: "Tap Retry saving my listing. No second payment needed.",
        variant: "destructive",
      });
      return false;
    }
    setUnsavedPayment(null);
    setPaidChain(chainKey);
    setTxHash(hash);
    toast({ title: "Payment successful!", description: `Tx: ${hash.slice(0, 12)}…` });
    onSuccess(hash);
    return true;
  };

  const handlePay = async () => {
    setPaying(true); setError(null); setBaseDebug(null);
    try {
      const hash = isArc ? await payOnArc() : await payOnBase();
      await saveAfterPayment(hash, activeChainKey, address!);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Payment failed on ${chainLabel}`;
      setError(msg);
      toast({ title: "Payment failed", description: msg, variant: "destructive" });
    } finally { setPaying(false); }
  };

  const handleRetrySave = async () => {
    if (!unsavedPayment) return;
    setRetrying(true); setError(null);
    await saveAfterPayment(unsavedPayment.hash, unsavedPayment.chainKey, unsavedPayment.payer);
    setRetrying(false);
  };

  const handleExternalSubmit = async () => {
    if (!externalTx.trim() || !externalWallet.trim()) {
      toast({ title: "Paste your tx hash and payer wallet", variant: "destructive" });
      return;
    }
    setSubmittingExternal(true); setError(null);
    try {
      await persistListing(type, externalTx.trim(), externalWallet.trim(), submissionData, externalChainKey);
      setPaidChain(externalChainKey);
      setTxHash(externalTx.trim());
      toast({ title: "Listing confirmed!", description: `Verified on ${externalChainKey}` });
      onSuccess(externalTx.trim());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      setError(msg);
      toast({ title: "Could not verify payment", description: msg, variant: "destructive" });
    } finally { setSubmittingExternal(false); }
  };

  const copy = (value: string, label = "Copied!") => {
    navigator.clipboard.writeText(value);
    toast({ title: label });
  };

  // ── Success ──
  if (txHash) {
    const ch = getChain(paidChain);
    return (
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Payment Confirmed!</h3>
        <p className="text-sm text-muted-foreground">
          Your {fee} USDC payment on {ch?.label ?? paidChain} was verified.
        </p>
        <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-muted-foreground truncate">{txHash}</span>
          <button onClick={() => copy(txHash)} className="text-primary hover:text-primary/80 shrink-0">
            <Copy className="h-4 w-4" />
          </button>
        </div>
        {ch && (
          <a href={ch.explorerTx(txHash)} target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center justify-center gap-1 text-sm text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" /> View on explorer
          </a>
        )}
      </div>
    );
  }

  // ── Not connected ──
  if (!isConnected) {
    return (
      <div className="space-y-4 text-center">
        <h3 className="text-xl font-bold text-foreground">{fee} USDC</h3>
        <p className="text-sm text-muted-foreground">
          {type === "listing" ? "One-time listing fee" : "One-time update fee"}: pay on {chainLabel} or any chain
        </p>
        <Button onClick={() => open()}
          className="w-full bg-gradient-to-r from-primary to-[hsl(var(--accent))] text-primary-foreground font-semibold py-6 rounded-xl text-base">
          <Wallet className="h-5 w-5 mr-2" /> Connect Wallet to Pay
        </Button>
        <button onClick={() => setShowExternal((v) => !v)}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          <Globe2 className="h-3.5 w-3.5" />
          Or pay from Solana, Sui, Near, BNB, ETH, Polygon… (no wallet connect needed)
        </button>
        {showExternal && renderExternalForm()}
      </div>
    );
  }

  const needsSwitch = walletChainId !== activeChainId;

  const handleSwitch = async () => {
    try {
      await switchChainAsync({ chainId: activeChainId });
      toast({ title: `Switched to ${chainLabel}` });
    } catch (e: unknown) {
      toast({ title: "Network switch failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  function renderExternalForm() {
    const ch = getChain(externalChainKey);
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 text-left">
        <div className="flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Pay on any chain / paste tx hash</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Send <strong>{fee} USDC</strong> to our treasury on your chain, then paste the transaction hash. We verify on-chain and publish your listing automatically.
        </p>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Chain</label>
          <select value={externalChainKey} onChange={(e) => setExternalChainKey(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {PAYMENT_CHAINS.map((c) => (
              <option key={c.key} value={c.key}>{c.label} ({c.family.toUpperCase()})</option>
            ))}
          </select>
        </div>
        {ch && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Treasury ({ch.label})</p>
                <p className="text-xs font-mono text-foreground break-all">{ch.treasury}</p>
              </div>
              <button onClick={() => copy(ch.treasury, "Treasury copied")} className="text-primary shrink-0">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            {ch.usdc && (
              <p className="text-[10px] text-muted-foreground break-all">
                USDC: <span className="font-mono">{ch.usdc}</span>
                {ch.usdcKind === "bridged" && <span className="ml-1 text-amber-600 dark:text-amber-400">(bridged)</span>}
              </p>
            )}
            {ch.notes && <p className="text-[10px] text-muted-foreground italic">{ch.notes}</p>}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Your payer wallet</label>
          <Input value={externalWallet} onChange={(e) => setExternalWallet(e.target.value)}
            placeholder="0x… / Solana pubkey / Sui addr / near.account" className="font-mono text-xs" />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Transaction hash / signature</label>
          <Input value={externalTx} onChange={(e) => setExternalTx(e.target.value)}
            placeholder="Paste the tx hash from your payment" className="font-mono text-xs" />
        </div>
        <Button onClick={handleExternalSubmit} disabled={submittingExternal}
          className="w-full bg-primary text-primary-foreground rounded-lg">
          {submittingExternal ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying on-chain…</>
          ) : (
            <>Verify {fee} USDC & publish listing</>
          )}
        </Button>
      </div>
    );
  }

  // ── Main UI ──
  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h3 className="text-xl font-bold text-foreground">{fee} USDC</h3>
        <p className="text-sm text-muted-foreground">
          {type === "listing" ? "One-time listing fee" : "One-time update fee"}
        </p>
      </div>

      {isArc && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-foreground/90">
            <strong>Arc Mainnet</strong> is live. USDC is the gas token, so listing fees settle in seconds.
          </p>
        </div>
      )}

      {isBase && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-foreground/80">
            Native gasless x402 path runs on <strong>Base Mainnet</strong> with our <strong>ERC-8021 builder code</strong> (<code className="font-mono">bc_madq6cms</code>) attribution.
          </p>
        </div>
      )}

      {needsSwitch && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/90">
              Your wallet is on a different network. Switch to <strong>{chainLabel}</strong> to pay directly, or scroll down to pay from any other chain.
            </p>
          </div>
          <Button onClick={handleSwitch} disabled={switching} variant="outline"
            className="w-full rounded-lg border-amber-500/40 hover:bg-amber-500/10" size="sm">
            {switching ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Switching…</>
              : <><RefreshCw className="h-4 w-4 mr-2" /> Switch wallet to {chainLabel}</>}
          </Button>
        </div>
      )}

      <Button onClick={handlePay} disabled={paying || needsSwitch || switching}
        className="w-full bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground font-semibold py-6 rounded-xl text-base">
        {paying ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing Payment…</>
          : needsSwitch ? <>Switch to {chainLabel} to pay with wallet</>
          : <>💰 Pay {fee} USDC on {chainLabel}</>}
      </Button>


      <div className="pt-2">
        <button onClick={() => setShowExternal((v) => !v)}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 w-full justify-center">
          <Globe2 className="h-3.5 w-3.5" />
          {showExternal ? "Hide" : "Or pay from Solana, Sui, Near, BNB, ETH, Arbitrum, Polygon…"}
        </button>
      </div>
      {showExternal && renderExternalForm()}

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      {baseDebug && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">ERC-8021 Calldata</span>
            <span className="text-[10px] font-mono text-muted-foreground">suffix {baseDebug.suffix.slice(0, 10)}…</span>
          </div>
          <p className="text-[10px] font-mono text-foreground break-all">{baseDebug.attributed}</p>
        </div>
      )}

      <div className="bg-muted/50 rounded-xl p-4">
        <p className="text-xs text-muted-foreground">
          🔵 Direct on-chain USDC transfer to treasury. {chainLabel} USDC:{" "}
          <code className="font-mono">
            {(isArc ? ARC_USDC_ADDRESS : BASE_USDC_ADDRESS).slice(0, 10)}…
          </code>
        </p>
      </div>
    </div>
  );
};

export default ArcPaymentPanel;
