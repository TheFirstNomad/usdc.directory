/**
 * ArcPaymentPanel — listing fee payable on ANY supported EVM chain.
 *
 * Paths:
 *   1. Any supported EVM chain — USDC ERC-20 transfer via wagmi.
 *      No forced Base switch. Arc, Base, ETH, Arb, OP, Polygon, AVAX, BNB, Linea all work.
 *   2. Non-EVM / other chains — paste tx hash (Solana, Sui, Near, etc.)
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, Copy, ExternalLink, Loader2, Wallet,
  AlertTriangle, ShieldCheck, RefreshCw, Globe2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppKitAccount, useAppKit, useAppKitNetwork, useAppKitProvider } from "@reown/appkit/react";
import { useAppKitConnection, type Provider as SolanaProvider } from "@reown/appkit-adapter-solana/react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { useSendTransaction, usePublicClient, useChainId, useSwitchChain } from "wagmi";
import { encodeFunctionData, parseAbi, parseUnits } from "viem";
import {
  getExplorerUrl, getExplorerName, getChainLabel, type PaymentChainId,
} from "@/lib/arcAppKit";
import { getBaseScanInputDataUrl, type BasePaymentDebug } from "@/lib/basePayment";
import {
  PAYMENT_CHAINS, LISTING_FEE_USDC, EVM_TREASURY, getChain,
} from "@/lib/multichainPayments";

// ── EVM chain USDC config ──
const ERC20_TRANSFER_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

interface EvmUsdcConfig { address: `0x${string}`; decimals: number }

const EVM_USDC: Record<number, EvmUsdcConfig> = {
  5042:  { address: "0x3600000000000000000000000000000000000000", decimals: 6  },
  8453:  { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6  },
  1:     { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6  },
  42161: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6  },
  10:    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6  },
  137:   { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6  },
  43114: { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6  },
  56:    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  59144: { address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", decimals: 6  },
};

const CHAIN_ID_TO_KEY: Record<number, string> = {
  5042: "arc", 8453: "base", 1: "ethereum", 42161: "arbitrum",
  10: "optimism", 137: "polygon", 43114: "avalanche", 56: "bnb", 59144: "linea",
};

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const SUPPORTED_CHAIN_IDS = new Set(Object.keys(EVM_USDC).map(Number));

// Chain labels for unsupported chain warning
const CHAIN_NAMES: Record<number, string> = {
  5042: "Arc", 8453: "Base", 1: "Ethereum", 42161: "Arbitrum",
  10: "Optimism", 137: "Polygon", 43114: "Avalanche", 56: "BNB Chain", 59144: "Linea",
};

function getChainName(id: number) {
  return CHAIN_NAMES[id] ?? `Chain ${id}`;
}

interface ArcPaymentPanelProps {
  type: "listing" | "update";
  submissionData: Record<string, unknown>;
  onSuccess: (txHash: string) => void;
}

async function persistListing(
  type: "listing" | "update",
  txHash: string,
  walletAddress: string,
  submissionData: Record<string, unknown>,
  chain: string,
) {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL || "https://ddhytszijvfejnymrwgd.supabase.co";
  const { tier: listingTier, ...listingData } = submissionData as Record<string, unknown> & { tier?: string };
  const res = await fetch(`${supabaseUrl}/functions/v1/submit-listing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      tx_hash: txHash,
      chain,
      wallet_address: walletAddress,
      tier: listingTier ?? "standard",
      data: listingData,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || "Failed to save listing");
  }
  return res.json();
}

const ArcPaymentPanel = ({ type, submissionData, onSuccess }: ArcPaymentPanelProps) => {
  const { toast } = useToast();
  const { isConnected, address } = useAppKitAccount();
  const { open } = useAppKit();
  const { caipNetwork } = useAppKitNetwork();
  const isSolana = caipNetwork?.chainNamespace === "solana";
  const { walletProvider: solanaProvider } = useAppKitProvider<SolanaProvider>("solana");
  const { connection: solanaConnection } = useAppKitConnection();

  const { sendTransactionAsync } = useSendTransaction();
  const walletChainId = useChainId();
  const { switchChainAsync, isPending: switching } = useSwitchChain();

  // Use the wallet's actual chain — not the UI dropdown chain
  const usdcConfig = EVM_USDC[walletChainId];
  const isArc = walletChainId === 5042;
  const chainKey = CHAIN_ID_TO_KEY[walletChainId] ?? "base";
  const isSupported = isSolana || SUPPORTED_CHAIN_IDS.has(walletChainId);
  const chainName = isSolana ? "Solana" : getChainName(walletChainId);

  // Public client for the active wallet chain
  const publicClient = usePublicClient({ chainId: walletChainId });

  const [paying, setPaying] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [paidChain, setPaidChain] = useState<string>("arc");
  const [error, setError] = useState<string | null>(null);
  const [saveFailedHash, setSaveFailedHash] = useState<string | null>(null);
  const [saveFailedChain, setSaveFailedChain] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [baseDebug] = useState<BasePaymentDebug | null>(null);

  // External "paste tx hash" path
  const [showExternal, setShowExternal] = useState(false);
  const [externalChainKey, setExternalChainKey] = useState<string>("ethereum");
  const [externalTx, setExternalTx] = useState("");
  const [externalWallet, setExternalWallet] = useState("");
  const [submittingExternal, setSubmittingExternal] = useState(false);

  const fee = LISTING_FEE_USDC;

  // ── Generic EVM pay path — works for all 9 chains ──
  const payOnEvmChain = async (): Promise<string> => {
    if (!address) throw new Error("Wallet not connected");
    if (!usdcConfig) throw new Error(`USDC not configured for chain ${walletChainId}`);

    const feeUnits = parseUnits(String(fee), usdcConfig.decimals);
    const data = encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [EVM_TREASURY as `0x${string}`, feeUnits],
    });
    const hash = await sendTransactionAsync({
      to: usdcConfig.address,
      data,
      account: address as `0x${string}`,
      chainId: walletChainId,
      value: 0n,
    } as Parameters<typeof sendTransactionAsync>[0]);
    if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  };

  // ── Solana pay path — 1-click SPL USDC transfer via Phantom/Solflare/Backpack ──
  const payOnSolana = async (): Promise<string> => {
    if (!address || !solanaProvider || !solanaConnection) throw new Error("Solana wallet not connected");
    const solCfg = getChain("solana");
    if (!solCfg?.treasury) throw new Error("Solana treasury not configured");
    const mint = new PublicKey(SOLANA_USDC_MINT);
    const payer = new PublicKey(address);
    const treasury = new PublicKey(solCfg.treasury);
    const fromAta = getAssociatedTokenAddressSync(mint, payer);
    const toAta = getAssociatedTokenAddressSync(mint, treasury);
    const units = BigInt(Math.round(fee * 1_000_000));
    const { blockhash, lastValidBlockHeight } = await solanaConnection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: payer, blockhash, lastValidBlockHeight }).add(
      createAssociatedTokenAccountIdempotentInstruction(payer, toAta, treasury, mint),
      createTransferCheckedInstruction(fromAta, mint, toAta, payer, units, 6),
    );
    const sig = await solanaProvider.sendTransaction(tx, solanaConnection);
    await solanaConnection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  };

  const handlePay = async () => {
    setPaying(true); setError(null);
    const payChainKey = isSolana ? "solana" : chainKey;
    try {
      const hash = isSolana ? await payOnSolana() : await payOnEvmChain();
      try {
        await persistListing(type, hash, address!, submissionData, payChainKey);
      } catch (saveErr: unknown) {
        const message = saveErr instanceof Error ? saveErr.message : String(saveErr);
        setSaveFailedHash(hash);
        setSaveFailedChain(payChainKey);
        setError(`Your payment is confirmed and safe. Saving the listing didn't go through yet: ${message}. Tap "Retry saving my listing" below — you will not be charged again.`);
        toast({
          title: "Payment safe — listing not saved yet",
          description: "Tap Retry saving my listing. No second payment needed.",
          variant: "destructive",
        });
        return;
      }
      setPaidChain(payChainKey);
      setTxHash(hash);
      toast({ title: "Payment successful!", description: `Tx: ${hash.slice(0, 12)}…` });
      onSuccess(hash);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Payment failed on ${chainName}`;
      setError(msg);
      toast({ title: "Payment failed", description: msg, variant: "destructive" });
    } finally { setPaying(false); }
  };

  const handleRetry = async () => {
    if (!saveFailedHash || !saveFailedChain || !address) return;
    setRetrying(true); setError(null);
    try {
      await persistListing(type, saveFailedHash, address, submissionData, saveFailedChain);
      setSaveFailedHash(null);
      setSaveFailedChain(null);
      setPaidChain(saveFailedChain);
      setTxHash(saveFailedHash);
      toast({ title: "Listing saved!", description: "Your listing is now live." });
      onSuccess(saveFailedHash);
    } catch (retryErr: unknown) {
      const message = retryErr instanceof Error ? retryErr.message : String(retryErr);
      setError(`Retry failed: ${message}. Your tx hash: ${saveFailedHash} — contact hello@usdc.directory.`);
      toast({ title: "Retry failed", description: message, variant: "destructive" });
    } finally { setRetrying(false); }
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
          {type === "listing" ? "One-time listing fee" : "One-time update fee"}: pay on any chain
        </p>
        <Button onClick={() => open()}
          className="w-full bg-gradient-to-r from-primary to-[hsl(var(--accent))] text-primary-foreground font-semibold py-6 rounded-xl text-base">
          <Wallet className="h-5 w-5 mr-2" /> Connect Wallet to Pay
        </Button>
        <button onClick={() => setShowExternal((v) => !v)}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1">
          <Globe2 className="h-3.5 w-3.5" />
          Or pay from Sui, Near or another chain by pasting a tx hash
        </button>
        {showExternal && renderExternalForm()}
      </div>
    );
  }

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

  // ── Main UI — wallet connected ──
  return (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <h3 className="text-xl font-bold text-foreground">{fee} USDC</h3>
        <p className="text-sm text-muted-foreground">
          {type === "listing" ? "One-time listing fee" : "One-time update fee"}
        </p>
      </div>

      {/* Chain info banner */}
      {isSupported ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-foreground/90">
            {isSolana
              ? <><strong>Solana</strong> — Pay {fee} USDC in one click from Phantom, Solflare or Backpack.</>
              : isArc
              ? <><strong>Arc Mainnet</strong> — USDC is the gas token. Listing fees settle in seconds.</>
              : <><strong>{chainName}</strong> — Pay {fee} USDC directly. Listing publishes after on-chain verification.</>
            }
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-foreground/90">
              Chain {walletChainId} is not supported for direct payment. Switch to Arc, Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche, BNB, or Linea — or use the paste-tx-hash path below.
            </p>
          </div>
          <Button onClick={() => switchChainAsync({ chainId: 5042 })} disabled={switching}
            variant="outline" className="w-full rounded-lg border-amber-500/40" size="sm">
            {switching
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Switching…</>
              : <><RefreshCw className="h-4 w-4 mr-2" /> Switch to Arc Mainnet</>}
          </Button>
        </div>
      )}

      <Button
        onClick={handlePay}
        disabled={paying || !isSupported || switching}
        className="w-full bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground font-semibold py-6 rounded-xl text-base"
      >
        {paying
          ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing Payment…</>
          : <>💰 Pay {fee} USDC on {chainName}</>}
      </Button>

      <div className="pt-2">
        <button onClick={() => setShowExternal((v) => !v)}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1.5 w-full justify-center">
          <Globe2 className="h-3.5 w-3.5" />
          {showExternal ? "Hide" : "Or pay from Sui, Near or another chain (paste tx hash)"}
        </button>
      </div>
      {showExternal && renderExternalForm()}

      {error && (
        <div className="space-y-3">
          <p className="text-sm text-destructive text-center">{error}</p>
          {saveFailedHash && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
              <p className="text-xs text-foreground font-medium">Your payment is confirmed and safe. Retry the save — no extra charge.</p>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-xs font-mono text-muted-foreground truncate flex-1">{saveFailedHash}</span>
                <button onClick={() => copy(saveFailedHash, "Tx hash copied")} className="text-primary shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button onClick={handleRetry} disabled={retrying}
                className="w-full bg-primary text-primary-foreground rounded-lg">
                {retrying
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Retrying…</>
                  : "Retry saving my listing"}
              </Button>
            </div>
          )}
        </div>
      )}

      {baseDebug && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">ERC-8021 Calldata</span>
            <span className="text-[10px] font-mono text-muted-foreground">suffix {baseDebug.suffix.slice(0, 10)}…</span>
          </div>
          <p className="text-[10px] font-mono text-foreground break-all">{baseDebug.attributed}</p>
        </div>
      )}

      {isSupported && !isSolana && usdcConfig && (
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">
            🔵 Direct on-chain USDC transfer to treasury. {chainName} USDC:{" "}
            <code className="font-mono">{usdcConfig.address.slice(0, 10)}…</code>
          </p>
          {isSupported && (
            <a
              href={getBaseScanInputDataUrl("")}
              className="hidden"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ArcPaymentPanel;
