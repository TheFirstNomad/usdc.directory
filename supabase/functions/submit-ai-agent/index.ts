/**
 * submit-ai-agent — Self-list an AI agent for 1 USDC on any supported chain.
 *
 * AI agent fee is intentionally 1 USDC (vs 3 USDC for business listings).
 * Agents are the network effect: lower barrier = more autonomous agents listed.
 *
 * Supported chains: Arc, Base, Ethereum, Arbitrum, Optimism, Polygon,
 * Avalanche, BNB, Linea (EVM) + Solana, Sui, Near (non-EVM).
 *
 * For Base, the front-end pays via wagmi sendTransaction (ERC-8021 attribution)
 * and posts the tx hash here. For any other chain the agent pays USDC to our
 * treasury on that chain and submits the tx hash for on-chain verification.
 * Arc agents can also use the x402 gasless path via the agents-api endpoint.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createPublicClient, http, decodeEventLog, getAddress, parseAbi } from "https://esm.sh/viem@2.21.55";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEE_BASE_UNITS = 1_000_000n;
const EVM_TREASURY = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c".toLowerCase();
const SOLANA_TREASURY = "4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be";
const SUI_TREASURY = "0xa15979dcd7429463cdf01aae184cb32e33fcf15d3e46067238ccc384115f9979".toLowerCase();
const NEAR_TREASURY = "b63a64053204d89290b73e3dbdce660a2f29d211cd1c400f4a499ac165f98171";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SUI_USDC_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const NEAR_USDC_CONTRACT = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

const EVM_CHAINS: Record<string, { rpc: string; usdc: string }> = {
  base:      { rpc: "https://mainnet.base.org",                 usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  ethereum:  { rpc: "https://eth.llamarpc.com",                  usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  arbitrum:  { rpc: "https://arb1.arbitrum.io/rpc",              usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  optimism:  { rpc: "https://mainnet.optimism.io",               usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
  polygon:   { rpc: "https://polygon-rpc.com",                   usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
  avalanche: { rpc: "https://api.avax.network/ext/bc/C/rpc",     usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
  bnb:       { rpc: "https://bsc-dataseed.binance.org",          usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  linea:     { rpc: "https://rpc.linea.build",                   usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff" },
};

const ERC20_TRANSFER_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

async function verifyEvm(chain: string, txHash: string) {
  const cfg = EVM_CHAINS[chain];
  if (!cfg) return { ok: false as const, error: `No verifier configured for ${chain}` };
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { ok: false as const, error: "Invalid EVM tx hash" };
  try {
    const client = createPublicClient({ transport: http(cfg.rpc) });
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
    if (!receipt || receipt.status !== "success") return { ok: false as const, error: "tx not successful" };
    const usdcAddr = getAddress(cfg.usdc).toLowerCase();
    let total = 0n; let payer: string | null = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdcAddr) continue;
      try {
        const d = decodeEventLog({ abi: ERC20_TRANSFER_ABI, data: log.data, topics: log.topics });
        if (d.eventName === "Transfer") {
          const a = d.args as { from: string; to: string; value: bigint };
          if (a.to.toLowerCase() === EVM_TREASURY) { total += a.value; if (!payer) payer = a.from.toLowerCase(); }
        }
      } catch { /* skip */ }
    }
    if (total < FEE_BASE_UNITS) return { ok: false as const, error: `paid ${total} < ${FEE_BASE_UNITS}` };
    return { ok: true as const, payer: payer ?? "unknown" };
  } catch (e) { return { ok: false as const, error: (e as Error).message }; }
}

async function verifySolana(txHash: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,90}$/.test(txHash)) return { ok: false as const, error: "Invalid Solana signature" };
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction",
        params: [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }] }),
    });
    const tx = (await res.json())?.result;
    if (!tx || tx.meta?.err) return { ok: false as const, error: "Solana tx not found or failed" };
    const pre = tx.meta?.preTokenBalances ?? [];
    const post = tx.meta?.postTokenBalances ?? [];
    let delta = 0n;
    for (const p of post) {
      if (p.mint !== SOLANA_USDC_MINT || p.owner !== SOLANA_TREASURY) continue;
      const prev = pre.find((x: any) => x.accountIndex === p.accountIndex);
      const a = BigInt(prev?.uiTokenAmount?.amount ?? "0");
      const b = BigInt(p.uiTokenAmount?.amount ?? "0");
      if (b > a) delta += b - a;
    }
    if (delta < FEE_BASE_UNITS) return { ok: false as const, error: `Solana USDC delta ${delta} < ${FEE_BASE_UNITS}` };
    return { ok: true as const, payer: tx.transaction?.message?.accountKeys?.[0]?.pubkey ?? "unknown" };
  } catch (e) { return { ok: false as const, error: (e as Error).message }; }
}

async function verifySui(txHash: string) {
  try {
    const res = await fetch("https://fullnode.mainnet.sui.io", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "sui_getTransactionBlock",
        params: [txHash, { showEffects: true, showBalanceChanges: true, showInput: true }] }),
    });
    const tx = (await res.json())?.result;
    if (!tx) return { ok: false as const, error: "Sui tx not found" };
    if (tx.effects?.status?.status !== "success") return { ok: false as const, error: "Sui tx failed" };
    let delta = 0n;
    for (const bc of tx.balanceChanges ?? []) {
      if (bc.coinType !== SUI_USDC_TYPE) continue;
      const owner = (bc.owner?.AddressOwner ?? "").toLowerCase();
      if (owner !== SUI_TREASURY) continue;
      const amt = BigInt(bc.amount);
      if (amt > 0n) delta += amt;
    }
    if (delta < FEE_BASE_UNITS) return { ok: false as const, error: `Sui USDC ${delta} < ${FEE_BASE_UNITS}` };
    return { ok: true as const, payer: tx.transaction?.data?.sender ?? "unknown" };
  } catch (e) { return { ok: false as const, error: (e as Error).message }; }
}

async function verifyNear(txHash: string, signer?: string) {
  try {
    const res = await fetch("https://rpc.mainnet.near.org", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tx",
        params: [txHash, signer && signer.length > 0 ? signer : NEAR_TREASURY] }),
    });
    const tx = (await res.json())?.result;
    if (!tx) return { ok: false as const, error: "Near tx not found (include payer wallet)" };
    let ok = false;
    for (const r of tx.receipts_outcome ?? []) {
      for (const log of r.outcome?.logs ?? []) {
        const m = /Transfer\s+(\d+)\s+from\s+\S+\s+to\s+(\S+)/.exec(log);
        if (m && m[2] === NEAR_TREASURY && BigInt(m[1]) >= FEE_BASE_UNITS) { ok = true; break; }
        if (log.startsWith("EVENT_JSON:")) {
          try {
            const ev = JSON.parse(log.slice("EVENT_JSON:".length));
            if (ev.standard === "nep141" && ev.event === "ft_transfer") {
              for (const d of ev.data ?? []) {
                if (d.new_owner_id === NEAR_TREASURY && BigInt(d.amount) >= FEE_BASE_UNITS) { ok = true; break; }
              }
            }
          } catch { /* */ }
        }
      }
      if (ok) break;
    }
    if (!ok) return { ok: false as const, error: "No qualifying ft_transfer to Near treasury" };
    return { ok: true as const, payer: tx.transaction?.signer_id ?? "unknown" };
  } catch (e) { return { ok: false as const, error: (e as Error).message }; }
}

async function verify(chain: string, txHash: string, signerHint?: string) {
  if (chain === "solana") return verifySolana(txHash);
  if (chain === "sui") return verifySui(txHash);
  if (chain === "near") return verifyNear(txHash, signerHint);
  return verifyEvm(chain, txHash);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json();
    const { agent_name, wallet_address, description, logo_url, payment_tx } = body;
    const chain = String(body?.chain ?? "base").toLowerCase();

    if (!agent_name || typeof agent_name !== "string" || agent_name.trim().length === 0 || agent_name.trim().length > 100)
      return j({ error: "agent_name required (≤100)" }, 400);
    if (!wallet_address || typeof wallet_address !== "string" || wallet_address.trim().length === 0 || wallet_address.length > 256)
      return j({ error: "wallet_address required (≤256)" }, 400);
    if (!description || typeof description !== "string" || description.trim().length === 0 || description.trim().length > 300)
      return j({ error: "description required (≤300)" }, 400);
    if (!payment_tx || typeof payment_tx !== "string" || payment_tx.length < 16)
      return j({ error: "payment_tx required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const dedupKey = `${chain}:${payment_tx}`;
    const { data: dup } = await supabase
      .from("partners").select("id").eq("payment_id", dedupKey).maybeSingle();
    if (dup) return j({ error: "Transaction hash already used" }, 409);

    const v = await verify(chain, payment_tx, wallet_address);
    if (!v.ok) return j({ error: `Payment verification failed: ${v.error}` }, 402);

    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .insert({
        name: agent_name.trim(),
        description: description.trim(),
        categories: ["AI Agents"],
        region: "Global",
        networks: [chain],
        wallet_address: wallet_address.trim().toLowerCase(),
        logo_url: logo_url || null,
        payment_status: "confirmed",
        payment_id: dedupKey,
      })
      .select()
      .single();

    if (partnerError) {
      console.error("Partner insert failed:", partnerError.message);
      return j({ error: "Failed to create listing" }, 500);
    }

    return j({ id: partner.id, name: partner.name, chain, verified_payer: v.payer });
  } catch (err) {
    console.error("submit-ai-agent error:", err);
    return j({ error: "Internal server error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
