// agents-api: paid agent-facing directory API with x402 + on-chain USDC payment.
// Endpoints (all paid):
//   GET  /agents          – list AI agents       ($0.001)
//   GET  /agents/{id}     – fetch one agent      ($0.001)
//   POST /agents          – self-list new agent  (1 USDC)
//   POST /agents/{id}/boost – featured boost     (5 USDC)
//
// Payment options:
//   1. x402     : caller sends X-PAYMENT (base64 JSON of EIP-3009 auth)
//   2. On-chain : caller sends X-Payment-TxHash + X-Payment-Chain (we verify on-chain)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient,
  createWalletClient,
  http,
  decodeEventLog,
  getAddress,
  parseAbi,
  recoverTypedDataAddress,
} from "https://esm.sh/viem@2.21.55";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.55/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-payment, x-payment-txhash, x-payment-chain",
  "Access-Control-Expose-Headers": "x-payment-response",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TREASURY = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c".toLowerCase();

type ChainCfg = {
  id: number;
  name: string;
  network: string; // x402 network id
  rpc: string;
  usdc: string;
  explorer: string;
};

const CHAINS: Record<number, ChainCfg> = {
  8453: {
    id: 8453, name: "Base Mainnet", network: "base",
    rpc: "https://mainnet.base.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org",
  },
  1: {
    id: 1, name: "Ethereum", network: "ethereum",
    rpc: "https://ethereum-rpc.publicnode.com",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    explorer: "https://etherscan.io",
  },
  42161: {
    id: 42161, name: "Arbitrum One", network: "arbitrum",
    rpc: "https://arb1.arbitrum.io/rpc",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    explorer: "https://arbiscan.io",
  },
  10: {
    id: 10, name: "Optimism", network: "optimism",
    rpc: "https://mainnet.optimism.io",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    explorer: "https://optimistic.etherscan.io",
  },
  137: {
    id: 137, name: "Polygon", network: "polygon",
    rpc: "https://polygon-rpc.com",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    explorer: "https://polygonscan.com",
  },
  43114: {
    id: 43114, name: "Avalanche", network: "avalanche",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    explorer: "https://snowtrace.io",
  },
  56: {
    id: 56, name: "BNB Chain", network: "bnb",
    rpc: "https://bsc-dataseed.binance.org",
    usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    explorer: "https://bscscan.com",
  },
  59144: {
    id: 59144, name: "Linea", network: "linea",
    rpc: "https://rpc.linea.build",
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    explorer: "https://lineascan.build",
  },
  5042: {
    id: 5042, name: "Arc Mainnet", network: "arc",
    rpc: "https://rpc.mainnet.arc.io",
    usdc: "0x3600000000000000000000000000000000000000",
    explorer: "https://explorer.arc.io",
  },
};

// Chains where USDC supports EIP-3009 transferWithAuthorization (native x402 "exact" scheme).
// Other EVM chains use the alternative on-chain pay-then-submit-tx path.
const X402_NATIVE_CHAIN_IDS = [8453, 1, 42161, 10, 137, 43114];

// Non-EVM treasuries — agents pay on their native chain, then submit tx hash.
const NON_EVM_CHAINS = [
  { key: "solana", family: "solana", treasury: "4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be",
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { key: "sui", family: "sui", treasury: "0xa15979dcd7429463cdf01aae184cb32e33fcf15d3e46067238ccc384115f9979",
    usdc: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC" },
  { key: "near", family: "near", treasury: "b63a64053204d89290b73e3dbdce660a2f29d211cd1c400f4a499ac165f98171",
    usdc: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1" },
];

const ERC20_TRANSFER_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

function buildAccepts(amount: bigint, resource: string) {
  return X402_NATIVE_CHAIN_IDS.map((id) => {
    const c = CHAINS[id];
    return {
      scheme: "exact",
      network: c.network,
      maxAmountRequired: amount.toString(),
      resource,
      description: "USDC Directory paid endpoint — 5 USDC self-listing",
      mimeType: "application/json",
      payTo: TREASURY,
      maxTimeoutSeconds: 60,
      asset: c.usdc,
      extra: { name: "USD Coin", version: "2" },
    };
  });
}

function require402(amount: bigint, resource: string, error?: string) {
  return json(
    {
      error: error ?? "X-PAYMENT required",
      x402Version: 1,
      accepts: buildAccepts(amount, resource),
      alternative: {
        description:
          "Pay USDC to the listed treasury on any supported chain (EVM, Solana, Sui, or Near), then resend with X-Payment-TxHash + X-Payment-Chain headers.",
        treasury: TREASURY,
        chains: [
          ...Object.values(CHAINS).map((c) => ({
            chainId: c.id, key: c.network, family: "evm",
            name: c.name, treasury: TREASURY, usdc: c.usdc,
          })),
          ...NON_EVM_CHAINS,
        ],
      },
    },

    402,
  );
}

// ── On-chain verification: confirm a USDC Transfer to TREASURY of >= amount ──
async function verifyOnChainPayment(
  txHash: string,
  chainId: number,
  amount: bigint,
): Promise<{ ok: true; from: string } | { ok: false; reason: string }> {
  const cfg = CHAINS[chainId];
  if (!cfg) return { ok: false, reason: "unsupported chain" };
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { ok: false, reason: "bad tx hash" };

  const client = createPublicClient({ transport: http(cfg.rpc) });
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch (e) {
    return { ok: false, reason: `receipt fetch failed: ${(e as Error).message}` };
  }
  if (!receipt || receipt.status !== "success") return { ok: false, reason: "tx not successful" };

  const usdcAddr = getAddress(cfg.usdc).toLowerCase();
  const treasury = TREASURY.toLowerCase();
  let from: string | null = null;
  let total = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdcAddr) continue;
    try {
      const decoded = decodeEventLog({
        abi: ERC20_TRANSFER_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "Transfer") {
        const args = decoded.args as { from: string; to: string; value: bigint };
        if (args.to.toLowerCase() === treasury) {
          total += args.value;
          if (!from) from = args.from.toLowerCase();
        }
      }
    } catch (_e) { /* ignore non-Transfer logs */ }
  }
  if (total < amount) return { ok: false, reason: `paid ${total} < required ${amount}` };
  return { ok: true, from: from ?? "unknown" };
}

// ── x402 verification: EIP-3009 transferWithAuthorization signature only ─────
// We accept the signed authorization as proof-of-intent (gasless).
// For full settlement, a facilitator would submit the tx; here we record the
// payment and rely on the agent's signed authorization for replay-safe accounting.
type X402Payload = {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: `0x${string}`;
    authorization: {
      from: `0x${string}`;
      to: `0x${string}`;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: `0x${string}`;
    };
  };
};

async function verifyX402Header(
  headerB64: string,
  amount: bigint,
): Promise<
  | { ok: true; payer: string; nonce: string; network: string; chainId: number; auth: X402Payload["payload"]["authorization"]; signature: `0x${string}` }
  | { ok: false; reason: string }
> {
  let parsed: X402Payload;
  try {
    const decoded = atob(headerB64);
    parsed = JSON.parse(decoded);
  } catch {
    return { ok: false, reason: "invalid base64/json X-PAYMENT" };
  }

  const cfg = Object.values(CHAINS).find((c) => c.network === parsed.network);
  if (!cfg) return { ok: false, reason: `unknown network ${parsed.network}` };
  if (parsed.scheme !== "exact") return { ok: false, reason: "scheme must be 'exact'" };

  const a = parsed.payload?.authorization;
  if (!a) return { ok: false, reason: "missing authorization" };
  if (a.to.toLowerCase() !== TREASURY) return { ok: false, reason: "wrong recipient" };
  if (BigInt(a.value) < amount) return { ok: false, reason: "insufficient value" };
  const now = Math.floor(Date.now() / 1000);
  if (Number(a.validAfter) > now) return { ok: false, reason: "auth not yet valid" };
  if (Number(a.validBefore) < now) return { ok: false, reason: "auth expired" };

  try {
    const recovered = await recoverTypedDataAddress({
      domain: { name: "USD Coin", version: "2", chainId: cfg.id, verifyingContract: getAddress(cfg.usdc) },
      types: {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: {
        from: getAddress(a.from), to: getAddress(a.to),
        value: BigInt(a.value), validAfter: BigInt(a.validAfter),
        validBefore: BigInt(a.validBefore), nonce: a.nonce,
      },
      signature: parsed.payload.signature,
    });
    if (recovered.toLowerCase() !== a.from.toLowerCase()) {
      return { ok: false, reason: "signature does not match 'from'" };
    }
  } catch (e) {
    return { ok: false, reason: `sig verify failed: ${(e as Error).message}` };
  }

  return {
    ok: true,
    payer: a.from.toLowerCase(),
    nonce: a.nonce,
    network: parsed.network,
    chainId: cfg.id,
    auth: a,
    signature: parsed.payload.signature,
  };
}

// ── x402 on-chain settlement (broadcast transferWithAuthorization) ──────────
const TRANSFER_WITH_AUTH_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
]);

function splitSig(sig: `0x${string}`): { v: number; r: `0x${string}`; s: `0x${string}` } {
  const r = ("0x" + sig.slice(2, 66)) as `0x${string}`;
  const s = ("0x" + sig.slice(66, 130)) as `0x${string}`;
  let v = parseInt(sig.slice(130, 132), 16);
  if (v < 27) v += 27;
  return { v, r, s };
}

async function settleX402(
  chainId: number,
  auth: X402Payload["payload"]["authorization"],
  signature: `0x${string}`,
): Promise<{ ok: true; txHash: string } | { ok: false; reason: string }> {
  const cfg = CHAINS[chainId];
  if (!cfg) return { ok: false, reason: "unsupported chain" };
  const pk = Deno.env.get("X402_SETTLEMENT_PRIVATE_KEY");
  if (!pk) return { ok: false, reason: "settlement signer not configured" };
  const normalizedPk = (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`;
  try {
    const account = privateKeyToAccount(normalizedPk);
    const wallet = createWalletClient({ account, transport: http(cfg.rpc) });
    const { v, r, s } = splitSig(signature);
    const txHash = await wallet.writeContract({
      address: getAddress(cfg.usdc),
      abi: TRANSFER_WITH_AUTH_ABI,
      functionName: "transferWithAuthorization",
      args: [
        getAddress(auth.from), getAddress(auth.to), BigInt(auth.value),
        BigInt(auth.validAfter), BigInt(auth.validBefore), auth.nonce, v, r, s,
      ],
      chain: null,
    } as Parameters<typeof wallet.writeContract>[0]);
    return { ok: true, txHash };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

// ── Rate limiter (sliding window) ───────────────────────────────────────────
async function rateLimitOk(
  supabase: ReturnType<typeof createClient>,
  bucketKey: string,
  endpoint: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count } = await supabase
    .from("agent_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("bucket_key", bucketKey)
    .eq("endpoint", endpoint)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) return false;
  await supabase.from("agent_rate_limits").insert({ bucket_key: bucketKey, endpoint });
  return true;
}

// ── Payment gate ────────────────────────────────────────────────────────────
async function gatePayment(
  req: Request,
  amount: bigint,
  resource: string,
  supabase: ReturnType<typeof createClient>,
  endpoint: string,
  method: string,
): Promise<
  | { ok: true; paymentId: string; payer: string; chain: string; scheme: string }
  | { ok: false; response: Response }
> {
  const xPayment = req.headers.get("x-payment");
  const txHash = req.headers.get("x-payment-txhash");
  const chainHeader = req.headers.get("x-payment-chain");

  // Rate limit the 402 challenge surface (pre-payment) per IP
  if (!xPayment && !txHash) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const ok = await rateLimitOk(supabase, `ip:${ip}`, endpoint, 30, 60);
    if (!ok) return { ok: false, response: json({ error: "rate limited" }, 429) };
    return { ok: false, response: require402(amount, resource) };
  }

  // Path 1: on-chain pre-paid
  if (txHash) {
    const chainId = Number(chainHeader || 8453);
    if (!CHAINS[chainId]) {
      return { ok: false, response: json({ error: "unsupported X-Payment-Chain" }, 400) };
    }
    const { data: existing } = await supabase
      .from("agent_api_payments")
      .select("id")
      .eq("payment_id", txHash)
      .eq("endpoint", endpoint)
      .maybeSingle();
    if (existing) {
      return { ok: false, response: json({ error: "tx hash already used for this endpoint" }, 409) };
    }
    const v = await verifyOnChainPayment(txHash, chainId, amount);
    if (!v.ok) {
      return { ok: false, response: json({ error: `payment invalid: ${v.reason}` }, 402) };
    }
    await supabase.from("agent_api_payments").insert({
      payment_id: txHash, endpoint, method,
      amount_usdc: amount.toString(),
      chain: CHAINS[chainId].network, agent_wallet: v.from, scheme: "onchain",
    });
    return { ok: true, paymentId: txHash, payer: v.from, chain: CHAINS[chainId].network, scheme: "onchain" };
  }

  // Path 2: x402 — verify, settle on chain, then record
  if (xPayment) {
    const v = await verifyX402Header(xPayment, amount);
    if (!v.ok) {
      return { ok: false, response: require402(amount, resource, v.reason) };
    }
    // Replay protection via dedicated nonce table (unique chain+nonce)
    const { error: nonceErr } = await supabase.from("x402_nonces").insert({
      chain: v.network, nonce: v.nonce, payer: v.payer,
      endpoint, amount_usdc: amount.toString(),
    });
    if (nonceErr) {
      return { ok: false, response: json({ error: "x402 nonce already used" }, 409) };
    }
    // Broadcast transferWithAuthorization on chain
    const settled = await settleX402(v.chainId, v.auth, v.signature);
    if (!settled.ok) {
      // Free the nonce so the caller can retry (and don't bill them)
      await supabase.from("x402_nonces").delete().eq("chain", v.network).eq("nonce", v.nonce);
      return { ok: false, response: json({ error: `settlement failed: ${settled.reason}` }, 402) };
    }
    await supabase
      .from("x402_nonces")
      .update({ tx_hash: settled.txHash, settled: true, settled_at: new Date().toISOString() })
      .eq("chain", v.network)
      .eq("nonce", v.nonce);
    const paymentId = `x402:${v.network}:${v.nonce}`;
    await supabase.from("agent_api_payments").insert({
      payment_id: paymentId, endpoint, method,
      amount_usdc: amount.toString(),
      chain: v.network, agent_wallet: v.payer, scheme: "x402",
    });
    return { ok: true, paymentId, payer: v.payer, chain: v.network, scheme: "x402", txHash: settled.txHash } as any;
  }

  return { ok: false, response: require402(amount, resource) };
}

// Build the X-PAYMENT-RESPONSE header value per x402 spec (base64 JSON).
function paymentResponseHeader(gate: { paymentId: string; chain: string; scheme: string; txHash?: string }): Record<string, string> {
  const body = {
    success: true,
    paymentId: gate.paymentId,
    network: gate.chain,
    scheme: gate.scheme,
    transaction: gate.txHash ?? null,
  };
  return { "X-PAYMENT-RESPONSE": btoa(JSON.stringify(body)) };
}

// ── Pricing ──────────────────────────────────────────────────────────────────
const PRICE_API_CALL = 1_000n;       // $0.001
const PRICE_LIST_AGENT = 5_000_000n; // 5 USDC
const PRICE_BOOST = 5_000_000n;      // 5 USDC

// ── Handlers ─────────────────────────────────────────────────────────────────
function basePath(url: URL): string {
  // Strip "/agents-api" prefix if present (Supabase routes /functions/v1/agents-api/...)
  const p = url.pathname.replace(/^.*\/agents-api/, "");
  return p || "/";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = basePath(url);
  const resource = `${url.origin}${url.pathname}`;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // GET /agents – list
    if (req.method === "GET" && path === "/agents") {
      const gate = await gatePayment(req, PRICE_API_CALL, resource, supabase, "/agents", "GET");
      if (!gate.ok) return gate.response;
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, description, website, logo_url, categories, region, networks, verified, boosted_until, created_at")
        .contains("categories", ["AI Agents"])
        .order("boosted_until", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return json({ error: error.message }, 500);
      return json({ count: data?.length ?? 0, agents: data, paid: gate.paymentId }, 200, paymentResponseHeader(gate));
    }

    // GET /agents/{id}
    const detailMatch = path.match(/^\/agents\/([0-9a-f-]{36})$/i);
    if (req.method === "GET" && detailMatch) {
      const gate = await gatePayment(req, PRICE_API_CALL, resource, supabase, path, "GET");
      if (!gate.ok) return gate.response;
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, description, website, logo_url, categories, region, networks, verified, boosted_until, created_at")
        .eq("id", detailMatch[1])
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data) return json({ error: "not found" }, 404);
      return json({ agent: data, paid: gate.paymentId }, 200, paymentResponseHeader(gate));
    }

    // POST /agents – self-list
    if (req.method === "POST" && path === "/agents") {
      const gate = await gatePayment(req, PRICE_LIST_AGENT, resource, supabase, "/agents", "POST");
      if (!gate.ok) return gate.response;
      let body: { name?: string; wallet_address?: string; description?: string; logo_url?: string };
      try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
      const name = (body.name || "").trim();
      const wallet = (body.wallet_address || "").trim().toLowerCase();
      const description = (body.description || "").trim();
      const logo_url = body.logo_url ? String(body.logo_url).trim() : null;
      if (!name || name.length > 100) return json({ error: "name required (<=100)" }, 400);
      if (!wallet || wallet.length > 256) return json({ error: "wallet_address required (<=256)" }, 400);
      if (!description || description.length > 300) return json({ error: "description required (<=300)" }, 400);

      const { data: partner, error } = await supabase
        .from("partners")
        .insert({
          name,
          description,
          categories: ["AI Agents"],
          region: "Global",
          networks: [],
          wallet_address: wallet,
          logo_url,
          payment_status: "confirmed",
          payment_id: gate.paymentId,
        })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      return json({ id: partner.id, name: partner.name, paid: gate.paymentId }, 201, paymentResponseHeader(gate));
    }

    // POST /agents/{id}/boost
    const boostMatch = path.match(/^\/agents\/([0-9a-f-]{36})\/boost$/i);
    if (req.method === "POST" && boostMatch) {
      const gate = await gatePayment(req, PRICE_BOOST, resource, supabase, path, "POST");
      if (!gate.ok) return gate.response;
      const partnerId = boostMatch[1];
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: upErr } = await supabase
        .from("partners")
        .update({ boosted_until: expiresAt })
        .eq("id", partnerId);
      if (upErr) return json({ error: upErr.message }, 500);
      const { error: insErr } = await supabase.from("agent_boosts").insert({
        partner_id: partnerId,
        payment_id: gate.paymentId,
        amount_usdc: PRICE_BOOST.toString(),
        chain: gate.chain,
        expires_at: expiresAt,
      });
      if (insErr) return json({ error: insErr.message }, 500);
      return json({ id: partnerId, boosted_until: expiresAt, paid: gate.paymentId }, 200, paymentResponseHeader(gate));
    }

    // Discovery: GET / -> mini index
    if (req.method === "GET" && (path === "/" || path === "")) {
      return json({
        name: "USDC Directory Agent API",
        version: "1",
        manifest: "https://usdc.directory/.well-known/x402",
        docs: "https://usdc.directory/api-docs",
        endpoints: [
          { path: "/agents", method: "GET", price_usdc: "0.001" },
          { path: "/agents/{id}", method: "GET", price_usdc: "0.001" },
          { path: "/agents", method: "POST", price_usdc: "5.000" },
          { path: "/agents/{id}/boost", method: "POST", price_usdc: "5.000" },
        ],
      });
    }

    return json({ error: "not found", path }, 404);
  } catch (e) {
    console.error("agents-api error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
