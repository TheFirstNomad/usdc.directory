/**
 * submit-listing — Persists a new listing or update after on-chain payment.
 *
 * Accepts payments on ANY supported chain (EVM mainnets + Solana + Sui + Near).
 * 1 USDC fee for listing, 1 USDC for update.
 *
 * POST body:
 *   {
 *     type: "listing" | "update",
 *     tx_hash: string,        // chain-specific format
 *     chain: string,          // "base" | "ethereum" | ... | "solana" | "sui" | "near"
 *     wallet_address: string, // payer wallet (any format)
 *     data: { company_name, description, website, categories, region, logo_url, contact_email?, partner_id? }
 *   }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createPublicClient, http, decodeEventLog, getAddress, parseAbi } from "https://esm.sh/viem@2.21.55";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEE_BASE_UNITS = 1_000_000n; // 1 USDC, 6 decimals
const EVM_TREASURY = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c".toLowerCase();
const SOLANA_TREASURY = "4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be";
const SUI_TREASURY = "0xa15979dcd7429463cdf01aae184cb32e33fcf15d3e46067238ccc384115f9979".toLowerCase();
const NEAR_TREASURY = "b63a64053204d89290b73e3dbdce660a2f29d211cd1c400f4a499ac165f98171";

const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SUI_USDC_TYPE = "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const NEAR_USDC_CONTRACT = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

interface EvmChain {
  rpc: string;
  usdc: string; // contract address (any-case)
}
const EVM_CHAINS: Record<string, EvmChain> = {
  base:      { rpc: "https://mainnet.base.org",                       usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  ethereum:  { rpc: "https://eth.llamarpc.com",                        usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  arbitrum:  { rpc: "https://arb1.arbitrum.io/rpc",                    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  optimism:  { rpc: "https://mainnet.optimism.io",                     usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
  polygon:   { rpc: "https://polygon-rpc.com",                         usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
  avalanche: { rpc: "https://api.avax.network/ext/bc/C/rpc",           usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
  bnb:       { rpc: "https://bsc-dataseed.binance.org",                usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
  linea:     { rpc: "https://rpc.linea.build",                         usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff" },
};

const SUPPORTED_CHAINS = new Set<string>([
  ...Object.keys(EVM_CHAINS), "monad", "solana", "sui", "near",
]);

const ALLOWED_CATEGORIES = new Set([
  "AI & Agentic Platforms","Bridge Apps","Bridge SDKs","DeFi Apps","Digital Wallets",
  "Due Diligence & Advisory","Ecommerce","Exchanges","Fintechs","Gaming",
  "Infrastructure Providers","Market Makers","Marketplaces","Neobanks","OTC Desks",
  "Payments","PR & Communications","Remittances","Security","AI Agents",
]);
const ALLOWED_REGIONS = new Set([
  "Global","Africa","Europe","Asia","North America","South America","Other",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EVM_TX_RE = /^0x[0-9a-fA-F]{64}$/;
const SOLANA_TX_RE = /^[1-9A-HJ-NP-Za-km-z]{43,90}$/;
const SUI_TX_RE = /^[1-9A-HJ-NP-Za-km-z]{40,50}$/;
const NEAR_TX_RE = /^[0-9a-fA-F]{32,64}$|^[1-9A-HJ-NP-Za-km-z]{40,50}$/;

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

const ERC20_TRANSFER_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

// ── EVM verification ────────────────────────────────────────────────
async function verifyEvm(chainKey: string, txHash: string): Promise<{ ok: true; payer: string } | { ok: false; error: string }> {
  const cfg = EVM_CHAINS[chainKey];
  if (!cfg) {
    // Monad and other newer chains: we accept any tx hash format but cannot verify on-chain yet.
    // For now, allow only if the chain has a configured RPC.
    return { ok: false, error: `On-chain verification not yet configured for ${chainKey}. Use Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche, BNB, or Linea for now.` };
  }
  if (!EVM_TX_RE.test(txHash)) return { ok: false, error: "Invalid EVM tx hash" };

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
        if (decoded.eventName === "Transfer") {
          const args = decoded.args as { from: string; to: string; value: bigint };
          if (args.to.toLowerCase() === EVM_TREASURY) {
            total += args.value;
            if (!payer) payer = args.from.toLowerCase();
          }
        }
      } catch { /* not a Transfer log */ }
    }
    if (total < FEE_BASE_UNITS) return { ok: false, error: `Insufficient payment: ${total} < ${FEE_BASE_UNITS} required` };
    return { ok: true, payer: payer ?? "unknown" };
  } catch (e) {
    return { ok: false, error: `RPC error: ${(e as Error).message}` };
  }
}

// ── Solana verification (SPL token transfer of USDC mint to treasury) ─
async function verifySolana(txHash: string): Promise<{ ok: true; payer: string } | { ok: false; error: string }> {
  if (!SOLANA_TX_RE.test(txHash)) return { ok: false, error: "Invalid Solana tx signature" };
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "getTransaction",
        params: [txHash, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
      }),
    });
    const data = await res.json();
    const tx = data?.result;
    if (!tx) return { ok: false, error: "Transaction not found on Solana mainnet" };
    if (tx.meta?.err) return { ok: false, error: "Transaction failed on Solana" };

    // Walk postTokenBalances - preTokenBalances to find a USDC delta to treasury wallet.
    const pre = tx.meta?.preTokenBalances ?? [];
    const post = tx.meta?.postTokenBalances ?? [];
    let delta = 0n;
    let payer: string | null = null;
    for (const p of post) {
      if (p.mint !== SOLANA_USDC_MINT) continue;
      if (p.owner !== SOLANA_TREASURY) continue;
      const preMatch = pre.find((x: any) => x.accountIndex === p.accountIndex);
      const preAmt = BigInt(preMatch?.uiTokenAmount?.amount ?? "0");
      const postAmt = BigInt(p.uiTokenAmount?.amount ?? "0");
      if (postAmt > preAmt) delta += postAmt - preAmt;
    }
    if (delta < FEE_BASE_UNITS) return { ok: false, error: `Insufficient USDC to treasury: ${delta} < ${FEE_BASE_UNITS}` };
    // Payer = fee payer (first signer)
    payer = tx.transaction?.message?.accountKeys?.[0]?.pubkey ?? null;
    return { ok: true, payer: payer ?? "unknown" };
  } catch (e) {
    return { ok: false, error: `Solana RPC error: ${(e as Error).message}` };
  }
}

// ── Sui verification ────────────────────────────────────────────────
async function verifySui(txHash: string): Promise<{ ok: true; payer: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("https://fullnode.mainnet.sui.io", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "sui_getTransactionBlock",
        params: [txHash, { showEffects: true, showBalanceChanges: true, showInput: true }],
      }),
    });
    const data = await res.json();
    const tx = data?.result;
    if (!tx) return { ok: false, error: "Sui transaction not found" };
    if (tx.effects?.status?.status !== "success") return { ok: false, error: "Sui transaction failed" };

    const treasuryLc = SUI_TREASURY.toLowerCase();
    let delta = 0n;
    for (const bc of tx.balanceChanges ?? []) {
      if (bc.coinType !== SUI_USDC_TYPE) continue;
      const owner = (bc.owner?.AddressOwner ?? "").toLowerCase();
      if (owner !== treasuryLc) continue;
      const amt = BigInt(bc.amount);
      if (amt > 0n) delta += amt;
    }
    if (delta < FEE_BASE_UNITS) return { ok: false, error: `Insufficient USDC to Sui treasury: ${delta} < ${FEE_BASE_UNITS}` };
    const payer = tx.transaction?.data?.sender ?? "unknown";
    return { ok: true, payer };
  } catch (e) {
    return { ok: false, error: `Sui RPC error: ${(e as Error).message}` };
  }
}

// ── Near verification ───────────────────────────────────────────────
async function verifyNear(txHash: string, signer?: string): Promise<{ ok: true; payer: string } | { ok: false; error: string }> {
  try {
    // Near RPC `tx` requires both hash and signer_id. We try signer if provided, else use treasury.
    const senderHint = signer && signer.length > 0 ? signer : NEAR_TREASURY;
    const res = await fetch("https://rpc.mainnet.near.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "tx",
        params: [txHash, senderHint],
      }),
    });
    const data = await res.json();
    const tx = data?.result;
    if (!tx) return { ok: false, error: data?.error?.data ?? "Near tx not found (include payer wallet)" };

    // Walk receipts for an ft_transfer to NEAR_TREASURY of amount >= FEE_BASE_UNITS
    const receipts = tx.receipts_outcome ?? [];
    let ok = false;
    for (const r of receipts) {
      const logs: string[] = r.outcome?.logs ?? [];
      for (const log of logs) {
        // Standard ft_transfer event log: 'EVENT_JSON:{...}' OR plain "Transfer X from A to B"
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
          } catch { /* ignore */ }
        }
      }
      if (ok) break;
    }
    if (!ok) return { ok: false, error: "No qualifying ft_transfer to Near treasury found in this tx" };
    const payer = tx.transaction?.signer_id ?? "unknown";
    return { ok: true, payer };
  } catch (e) {
    return { ok: false, error: `Near RPC error: ${(e as Error).message}` };
  }
}

async function verifyPayment(chain: string, txHash: string, signerHint?: string) {
  if (chain === "solana") return verifySolana(txHash);
  if (chain === "sui") return verifySui(txHash);
  if (chain === "near") return verifyNear(txHash, signerHint);
  return verifyEvm(chain, txHash);
}

function validateData(data: any): { ok: true; out: any } | { ok: false; error: string } {
  if (!data || typeof data !== "object") return { ok: false, error: "Missing data" };
  const company_name = String(data.company_name ?? "").trim();
  const description = String(data.description ?? "").trim();
  if (company_name.length < 1 || company_name.length > 80) return { ok: false, error: "company_name 1-80 chars" };
  if (description.length < 1 || description.length > 500) return { ok: false, error: "description 1-500 chars" };

  let website: string | null = null;
  if (data.website) {
    const w = String(data.website).trim();
    if (w.length > 200 || !isValidUrl(w)) return { ok: false, error: "Invalid website URL" };
    website = w;
  }
  let contact_email: string | null = null;
  if (data.contact_email) {
    const e = String(data.contact_email).trim();
    if (e.length > 255 || !EMAIL_RE.test(e)) return { ok: false, error: "Invalid contact_email" };
    contact_email = e;
  }
  const categories: string[] = Array.isArray(data.categories) ? data.categories.map(String) : [];
  if (categories.length > 5) return { ok: false, error: "Max 5 categories" };
  for (const c of categories) if (!ALLOWED_CATEGORIES.has(c)) return { ok: false, error: `Invalid category: ${c}` };

  const region = data.region ? String(data.region) : "Global";
  if (!ALLOWED_REGIONS.has(region)) return { ok: false, error: `Invalid region: ${region}` };

  let logo_url: string | null = null;
  if (data.logo_url) {
    const l = String(data.logo_url).trim();
    if (l.length > 500 || !isValidUrl(l)) return { ok: false, error: "Invalid logo_url" };
    logo_url = l;
  }
  const partner_id = data.partner_id ? String(data.partner_id) : undefined;
  return { ok: true, out: { company_name, description, website, contact_email, categories, region, logo_url, partner_id } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { type, tx_hash, wallet_address, data } = body ?? {};
    const chain = String(body?.chain ?? "base").toLowerCase();

    if (type !== "listing" && type !== "update")
      return json({ error: "type must be 'listing' or 'update'" }, 400);
    if (typeof tx_hash !== "string" || tx_hash.length < 16 || tx_hash.length > 200)
      return json({ error: "Invalid tx_hash" }, 400);
    if (!SUPPORTED_CHAINS.has(chain))
      return json({ error: `Unsupported chain '${chain}'. Supported: ${[...SUPPORTED_CHAINS].join(", ")}` }, 400);
    if (typeof wallet_address !== "string" || wallet_address.trim().length < 1 || wallet_address.length > 256)
      return json({ error: "Invalid wallet_address" }, 400);

    const dv = validateData(data);
    if (!dv.ok) return json({ error: dv.error }, 400);
    const { company_name, description, website, contact_email, categories, region, logo_url, partner_id } = dv.out;
    if (type === "update" && !partner_id) return json({ error: "partner_id required for updates" }, 400);

    // Note: wallet_address from the client is only a hint (used by the Near
    // verifier to locate the tx); it is never trusted for authorisation.
    const now = new Date().toISOString();

    // Dedupe by tx hash (scoped per chain in case formats overlap)
    const dedupKey = `${chain}:${tx_hash}`;
    const { data: dup } = await supabase
      .from("submissions")
      .select("id")
      .eq("payment_id", dedupKey)
      .maybeSingle();
    if (dup) return json({ error: "Transaction hash already used" }, 409);

    // ── Verify the on-chain payment ──
    const verification = await verifyPayment(chain, tx_hash, wallet_address);
    if (!verification.ok) return json({ error: `Payment verification failed: ${verification.error}` }, 402);

    // The wallet that actually sent the funds on-chain is the only identity we
    // trust. A client-supplied wallet_address is never used for authorisation.
    const verifiedPayer = String(verification.payer ?? "").toLowerCase();
    if (!verifiedPayer || verifiedPayer === "unknown")
      return json({ error: "Could not determine the paying wallet from the transaction" }, 402);

    if (type === "listing") {
      const { data: newPartner, error: partnerErr } = await supabase
        .from("partners")
        .insert({
          name: company_name, description, website, categories, region, logo_url,
          // Owner = verified on-chain payer, not the client-claimed address.
          wallet_address: verifiedPayer,
          payment_status: "confirmed",
          payment_id: dedupKey,
          networks: [chain],
          featured: false,
        })
        .select("id")
        .single();

      if (partnerErr) { console.error("Partner insert error:", partnerErr); throw partnerErr; }

      await supabase.from("submissions").insert({
        company_name,
        contact_email: contact_email || "not-provided@usdc.directory",
        website: website || "https://usdc.directory",
        description, categories, region, logo_url,
        wallet_address: verifiedPayer,
        payment_id: dedupKey,
        payment_status: "confirmed",
        status: "approved",
        networks: [chain],
        partner_id: newPartner.id,
      });

      return json({ success: true, partner_id: newPartner.id, chain, verified_payer: verification.payer });
    }

    // type === "update"
    const { data: existing, error: loadErr } = await supabase
      .from("partners")
      .select("id, wallet_address")
      .eq("id", partner_id!)
      .maybeSingle();
    if (loadErr || !existing) return json({ error: "Partner not found" }, 404);
    // Authorisation is bound to the wallet that actually paid on-chain.
    if ((existing.wallet_address || "").toLowerCase() !== verifiedPayer)
      return json({ error: "The paying wallet is not the owner of this listing" }, 403);

    const { error: updateErr } = await supabase
      .from("partners")
      .update({ description, website, categories, region, updated_at: now })
      .eq("id", partner_id!);
    if (updateErr) { console.error("Partner update error:", updateErr); throw updateErr; }

    await supabase.from("submissions").insert({
      company_name,
      contact_email: contact_email || "not-provided@usdc.directory",
      website: website || "https://usdc.directory",
      description, categories, region,
      wallet_address: verifiedPayer,
      payment_id: dedupKey,
      payment_status: "confirmed",
      status: "approved",
      networks: [chain],
      partner_id: partner_id!,
    });

    return json({ success: true, partner_id, chain, verified_payer: verification.payer });
  } catch (err) {
    console.error("submit-listing error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
