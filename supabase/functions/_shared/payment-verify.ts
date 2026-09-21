/**
 * Shared on-chain USDC payment verification used by paid actions
 * (listings, agent listings, boosts).
 *
 * Every verifier confirms a real USDC transfer of at least `minUnits`
 * (6-decimal base units) to the project treasury on the given chain.
 */

import { createPublicClient, http, decodeEventLog, getAddress, parseAbi } from "https://esm.sh/viem@2.21.55";

export const EVM_TREASURY = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c".toLowerCase();
export const SOLANA_TREASURY = "4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be";

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const EVM_TX_RE = /^0x[0-9a-fA-F]{64}$/;
const SOLANA_TX_RE = /^[1-9A-HJ-NP-Za-km-z]{43,90}$/;

export interface EvmChainCfg { rpc: string; usdc: string }

export const EVM_CHAINS: Record<string, EvmChainCfg> = {
  base:          { rpc: "https://mainnet.base.org",             usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  ethereum:      { rpc: "https://eth.llamarpc.com",             usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  arbitrum:      { rpc: "https://arb1.arbitrum.io/rpc",         usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  optimism:      { rpc: "https://mainnet.optimism.io",          usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
  polygon:       { rpc: "https://polygon-rpc.com",              usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
  avalanche:     { rpc: "https://api.avax.network/ext/bc/C/rpc", usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
  bnb:           { rpc: "https://bsc-dataseed.binance.org",     usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  linea:         { rpc: "https://rpc.linea.build",              usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff" },
  arc:           { rpc: "https://rpc.mainnet.arc.io",           usdc: "0x3600000000000000000000000000000000000000" },
};

/** Normalises the many chain spellings the clients send. */
export function normalizeChainKey(chain: string | undefined | null): string {
  const c = String(chain ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (c === "arc" || c === "arc_mainnet" || c === "arcmainnet") return "arc";
  if (c === "bsc" || c === "bnb_chain" || c === "binance") return "bnb";
  if (c === "eth" || c === "mainnet") return "ethereum";
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

  try {
    const client = createPublicClient({ transport: http(cfg.rpc) });
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (!receipt || receipt.status !== "success") return { ok: false, error: "Transaction not successful" };

    const usdcAddr = getAddress(cfg.usdc).toLowerCase();
    let total = 0n;
    let payer: string | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddr) continue;
      try {
        const decoded = decodeEventLog({ abi: ERC20_TRANSFER_ABI, data: log.data, topics: log.topics });
        if (decoded.eventName !== "Transfer") continue;
        const args = decoded.args as unknown as { from: string; to: string; value: bigint };
        if (args.to.toLowerCase() === EVM_TREASURY) {
          total += args.value;
          if (!payer) payer = args.from.toLowerCase();
        }
      } catch { /* not a Transfer log */ }
    }
    if (total < minUnits) return { ok: false, error: `Insufficient payment: ${total} < ${minUnits} required` };
    return { ok: true, payer: payer ?? "unknown" };
  } catch (e) {
    return { ok: false, error: `RPC error: ${(e as Error).message}` };
  }
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
    const j = await res.json();
    const tx = j?.result;
    if (!tx || tx.meta?.err) return { ok: false, error: "Solana transaction not found or failed" };

    const pre: any[] = tx.meta?.preTokenBalances ?? [];
    const post: any[] = tx.meta?.postTokenBalances ?? [];
    let delta = 0n;
    for (const p of post) {
      if (p.mint !== SOLANA_USDC_MINT || p.owner !== SOLANA_TREASURY) continue;
      const before = pre.find((b) => b.accountIndex === p.accountIndex);
      const beforeAmt = BigInt(before?.uiTokenAmount?.amount ?? "0");
      delta += BigInt(p.uiTokenAmount?.amount ?? "0") - beforeAmt;
    }
    if (delta < minUnits) return { ok: false, error: `Insufficient USDC to treasury: ${delta} < ${minUnits}` };
    const payer = tx.transaction?.message?.accountKeys?.[0]?.pubkey ?? "unknown";
    return { ok: true, payer };
  } catch (e) {
    return { ok: false, error: `Solana RPC error: ${(e as Error).message}` };
  }
}

/**
 * Verifies a USDC payment of at least `minUnits` base units to the treasury.
 */
export async function verifyUsdcPayment(
  chain: string,
  txHash: string,
  minUnits: bigint,
): Promise<VerifyResult> {
  const key = normalizeChainKey(chain);
  if (key === "solana") return verifySolana(txHash, minUnits);
  return verifyEvm(key, txHash, minUnits);
}
