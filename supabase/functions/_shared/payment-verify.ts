/**
 * Shared on-chain USDC payment verification used by EVERY paid action
 * (business listings, agent listings, boosts, the paid API and MCP).
 *
 * One verifier, one set of rules, so chains cannot drift apart:
 *  - amounts are normalised to 6-decimal USDC units (BNB USDC has 18 decimals);
 *  - every EVM chain has one or more RPC endpoints, tried in order;
 *  - Solana, Sui and Near are verified here too;
 *  - claimPayment() consumes a transaction exactly once across all features.
 */

import { createPublicClient, http, decodeEventLog, getAddress, parseAbi } from "https://esm.sh/viem@2.21.55";
import { sumTransfersTo, paymentKey } from "./payment-math.ts";

export const EVM_TREASURY = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c".toLowerCase();
export const SOLANA_TREASURY = "4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be";
export const SUI_TREASURY = "0xa15979dcd7429463cdf01aae184cb32e33fcf15d3e46067238ccc384115f9979".toLowerCase();
export const NEAR_TREASURY = "b63a64053204d89290b73e3dbdce660a2f29d211cd1c400f4a499ac165f98171";

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SUI_USDC_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const NEAR_USDC_CONTRACT = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

const EVM_TX_RE = /^0x[0-9a-fA-F]{64}$/;
const SOLANA_TX_RE = /^[1-9A-HJ-NP-Za-km-z]{43,90}$/;
const SUI_TX_RE = /^[1-9A-HJ-NP-Za-km-z]{40,50}$/;
const NEAR_TX_RE = /^[1-9A-HJ-NP-Za-km-z]{40,50}$/;
const NEAR_SIGNER_RE = /^([a-z0-9_-]+\.)*[a-z0-9_-]+(\.near)?$/;

export interface EvmChainCfg {
  rpcs: string[];          // tried in order
  usdc: string;
  usdcDecimals?: number;   // defaults to 6
}

export const EVM_CHAINS: Record<string, EvmChainCfg> = {
  arc:       { rpcs: ["https://rpc.mainnet.arc.io"], usdc: "0x3600000000000000000000000000000000000000" },
  base:      { rpcs: ["https://mainnet.base.org"], usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  ethereum:  { rpcs: ["https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com", "https://cloudflare-eth.com"], usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  arbitrum:  { rpcs: ["https://arb1.arbitrum.io/rpc"], usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  optimism:  { rpcs: ["https://mainnet.optimism.io"], usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
  polygon:   { rpcs: ["https://polygon-rpc.com"], usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
  avalanche: { rpcs: ["https://api.avax.network/ext/bc/C/rpc"], usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
  // Binance-Peg USDC has 18 decimals, not 6.
  bnb:       { rpcs: ["https://bsc-dataseed.binance.org"], usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", usdcDecimals: 18 },
  linea:     { rpcs: ["https://rpc.linea.build"], usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff" },
  monad:     { rpcs: ["https://monad-mainnet.drpc.org"], usdc: "0xf817257fed379853cDe0fa4F97AB987181B1E5f3" },
};

export const NON_EVM_KEYS = ["solana", "sui", "near"] as const;

/** Normalises the many chain spellings clients send. */
export function normalizeChainKey(chain: string | undefined | null): string {
  const c = String(chain ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const byId: Record<string, string> = {
    "5042": "arc", "8453": "base", "1": "ethereum", "42161": "arbitrum", "10": "optimism",
    "137": "polygon", "43114": "avalanche", "56": "bnb", "59144": "linea", "143": "monad",
  };
  if (byId[c]) return byId[c];
  if (c === "arc_mainnet" || c === "arcmainnet") return "arc";
  if (c === "base_mainnet") return "base";
  if (c === "bsc" || c === "bnb_chain" || c === "binance" || c === "binance_smart_chain") return "bnb";
  if (c === "eth" || c === "mainnet" || c === "ethereum_mainnet") return "ethereum";
  if (c === "matic") return "polygon";
  if (c === "avax") return "avalanche";
  if (c === "op" || c === "op_mainnet") return "optimism";
  if (c === "arb" || c === "arbitrum_one") return "arbitrum";
  if (c === "sol") return "solana";
  return c;
}

const ERC20_TRANSFER_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export type VerifyResult =
  | { ok: true; payer: string }
  | { ok: false; error: string };

async function verifyEvm(chainKey: string, txHash: string, minUnits: bigint): Promise<VerifyResult> {
  const cfg = EVM_CHAINS[chainKey];
  if (!cfg) return { ok: false, error: `On-chain verification is not available for chain "${chainKey}"` };
  if (!EVM_TX_RE.test(txHash)) return { ok: false, error: "Invalid EVM transaction hash" };

  const usdcAddr = getAddress(cfg.usdc).toLowerCase();
  let lastErr = "RPC error";
  for (const rpc of cfg.rpcs) {
    try {
      const client = createPublicClient({ transport: http(rpc) });
      const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
      if (!receipt || receipt.status !== "success") return { ok: false, error: "Transaction not successful" };

      const transfers: { from: string; to: string; value: bigint }[] = [];
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== usdcAddr) continue;
        try {
          const d = decodeEventLog({ abi: ERC20_TRANSFER_ABI, data: log.data, topics: log.topics });
          if (d.eventName === "Transfer") transfers.push(d.args as unknown as { from: string; to: string; value: bigint });
        } catch { /* not a Transfer log */ }
      }
      // Normalised to 6-decimal USDC units, so BNB (18 decimals) cannot underpay.
      const { total, payer } = sumTransfersTo(EVM_TREASURY, transfers, cfg.usdcDecimals ?? 6);
      if (total < minUnits) return { ok: false, error: `Insufficient payment: ${total} < ${minUnits} required (USDC base units)` };
      return { ok: true, payer: payer ?? "unknown" };
    } catch (e) {
      lastErr = `RPC error: ${(e as Error).message}`;
    }
  }
  return { ok: false, error: lastErr };
}

async function verifySolana(txHash: string, minUnits: bigint): Promise<VerifyResult> {
  if (!SOLANA_TX_RE.test(txHash)) return { ok: false, error: "Invalid Solana transaction signature" };
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getTransaction",
        params: [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      }),
    });
    const tx = (await res.json())?.result;
    if (!tx || tx.meta?.err) return { ok: false, error: "Solana transaction not found or failed" };

    type TokenBal = { accountIndex: number; mint?: string; owner?: string; uiTokenAmount?: { amount?: string } };
    const pre: TokenBal[] = tx.meta?.preTokenBalances ?? [];
    const post: TokenBal[] = tx.meta?.postTokenBalances ?? [];
    let delta = 0n;
    for (const p of post) {
      if (p.mint !== SOLANA_USDC_MINT || p.owner !== SOLANA_TREASURY) continue;
      const before = pre.find((b) => b.accountIndex === p.accountIndex);
      const gain = BigInt(p.uiTokenAmount?.amount ?? "0") - BigInt(before?.uiTokenAmount?.amount ?? "0");
      if (gain > 0n) delta += gain;
    }
    if (delta < minUnits) return { ok: false, error: `Insufficient USDC to treasury: ${delta} < ${minUnits}` };
    return { ok: true, payer: tx.transaction?.message?.accountKeys?.[0]?.pubkey ?? "unknown" };
  } catch (e) {
    return { ok: false, error: `Solana RPC error: ${(e as Error).message}` };
  }
}

async function verifySui(txHash: string, minUnits: bigint): Promise<VerifyResult> {
  if (!SUI_TX_RE.test(txHash)) return { ok: false, error: "Invalid Sui transaction digest" };
  try {
    const res = await fetch("https://fullnode.mainnet.sui.io", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "sui_getTransactionBlock",
        params: [txHash, { showEffects: true, showBalanceChanges: true, showInput: true }],
      }),
    });
    const tx = (await res.json())?.result;
    if (!tx) return { ok: false, error: "Sui transaction not found" };
    if (tx.effects?.status?.status !== "success") return { ok: false, error: "Sui transaction failed" };

    let delta = 0n;
    for (const bc of tx.balanceChanges ?? []) {
      if (String(bc.coinType).toLowerCase() !== SUI_USDC_TYPE.toLowerCase()) continue;
      if (String(bc.owner?.AddressOwner ?? "").toLowerCase() !== SUI_TREASURY) continue;
      const amt = BigInt(bc.amount);
      if (amt > 0n) delta += amt;
    }
    if (delta < minUnits) return { ok: false, error: `Insufficient USDC to Sui treasury: ${delta} < ${minUnits}` };
    return { ok: true, payer: String(tx.transaction?.data?.sender ?? "unknown").toLowerCase() };
  } catch (e) {
    return { ok: false, error: `Sui RPC error: ${(e as Error).message}` };
  }
}

async function verifyNear(txHash: string, signer: string | undefined, minUnits: bigint): Promise<VerifyResult> {
  if (!NEAR_TX_RE.test(txHash)) return { ok: false, error: "Invalid Near transaction hash" };
  const signerId = String(signer ?? "").trim().toLowerCase();
  if (!signerId || signerId.length > 64 || !NEAR_SIGNER_RE.test(signerId)) {
    return { ok: false, error: "Near verification needs the paying account (signer) id" };
  }
  try {
    const res = await fetch("https://rpc.mainnet.near.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tx", params: [txHash, signerId] }),
    });
    const j = await res.json();
    const tx = j?.result;
    if (!tx) return { ok: false, error: "Near transaction not found (check the signer account)" };
    if (tx.status && typeof tx.status === "object" && "Failure" in tx.status) return { ok: false, error: "Near transaction failed" };

    // Only logs emitted by the real USDC contract count; a look-alike token must not pass.
    let paid = 0n;
    for (const r of tx.receipts_outcome ?? []) {
      if (r.outcome?.executor_id !== NEAR_USDC_CONTRACT) continue;
      if (r.outcome?.status && typeof r.outcome.status === "object" && "Failure" in r.outcome.status) continue;
      for (const log of (r.outcome?.logs ?? []) as string[]) {
        if (!log.startsWith("EVENT_JSON:")) continue;
        try {
          const ev = JSON.parse(log.slice("EVENT_JSON:".length));
          if (ev.standard !== "nep141" || ev.event !== "ft_transfer") continue;
          for (const d of ev.data ?? []) {
            if (d.new_owner_id === NEAR_TREASURY) paid += BigInt(d.amount);
          }
        } catch { /* ignore malformed log */ }
      }
    }
    if (paid < minUnits) return { ok: false, error: `Insufficient USDC to Near treasury: ${paid} < ${minUnits}` };
    return { ok: true, payer: String(tx.transaction?.signer_id ?? signerId).toLowerCase() };
  } catch (e) {
    return { ok: false, error: `Near RPC error: ${(e as Error).message}` };
  }
}

/**
 * Verifies a USDC payment of at least `minUnits` (6-decimal units) to the treasury.
 * `signerHint` is only needed for Near, whose RPC cannot look up a tx without it.
 */
export async function verifyUsdcPayment(
  chain: string,
  txHash: string,
  minUnits: bigint,
  opts: { signerHint?: string } = {},
): Promise<VerifyResult> {
  const key = normalizeChainKey(chain);
  if (key === "solana") return verifySolana(txHash, minUnits);
  if (key === "sui") return verifySui(txHash, minUnits);
  if (key === "near") return verifyNear(txHash, opts.signerHint, minUnits);
  return verifyEvm(key, txHash, minUnits);
}

// ── Single-use claim across every paid feature ──────────────────────────────
// Minimal structural type for the database client (avoids importing it here).
type Sb = { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: "used" | "error"; message?: string };

/**
 * Atomically consumes a payment transaction. The unique (chain, tx_hash) key
 * guarantees that only one caller, across all features and concurrent
 * requests, ever receives { ok: true } for a given transaction.
 */
export async function claimPayment(sb: Sb, chain: string, txHash: string, feature: string): Promise<ClaimResult> {
  const key = paymentKey(normalizeChainKey(chain), txHash);
  const { error } = await sb.from("used_payments").insert({ ...key, feature });
  if (!error) return { ok: true };
  if (error.code === "23505") return { ok: false, reason: "used" };
  console.error("claimPayment failed:", error.message);
  return { ok: false, reason: "error", message: error.message };
}

/** Gives a transaction back when the paid action could not be delivered. */
export async function releasePayment(sb: Sb, chain: string, txHash: string): Promise<void> {
  const key = paymentKey(normalizeChainKey(chain), txHash);
  const { error } = await sb.from("used_payments").delete().eq("chain", key.chain).eq("tx_hash", key.tx_hash);
  if (error) console.error("releasePayment failed:", error.message);
}
