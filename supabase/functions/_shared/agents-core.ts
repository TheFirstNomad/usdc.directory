// Shared core for the paid USDC Directory agent API.
// Used by BOTH the HTTP function (agents-api) and the MCP function (mcp) so
// prices, payment checks, self-listing and boosting live in exactly one place.

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
import { verifyUsdcPayment } from "./payment-verify.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

// ── Public identity ─────────────────────────────────────────────────────────
export const PUBLIC_HOST = "https://api.usdc.directory";
export const SITE = "https://usdc.directory";
export const TREASURY = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c".toLowerCase();

// ── Prices (atomic USDC, 6 decimals) ────────────────────────────────────────
export const PRICE_READ = 10_000n;        // 0.01 USDC
export const PRICE_SELF_LIST = 1_000_000n; // 1 USDC
export const PRICE_BOOST = 5_000_000n;     // 5 USDC
export const BOOST_DAYS = 30;

// ── Chains ──────────────────────────────────────────────────────────────────
export type ChainCfg = {
  id: number; name: string; network: string; rpc: string; usdc: string;
  explorer: string; usdcDecimals?: number;
};

export const CHAINS: Record<number, ChainCfg> = {
  8453: { id: 8453, name: "Base Mainnet", network: "base", rpc: "https://mainnet.base.org", usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", explorer: "https://basescan.org" },
  1: { id: 1, name: "Ethereum", network: "ethereum", rpc: "https://ethereum-rpc.publicnode.com", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", explorer: "https://etherscan.io" },
  42161: { id: 42161, name: "Arbitrum One", network: "arbitrum", rpc: "https://arb1.arbitrum.io/rpc", usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", explorer: "https://arbiscan.io" },
  10: { id: 10, name: "Optimism", network: "optimism", rpc: "https://mainnet.optimism.io", usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", explorer: "https://optimistic.etherscan.io" },
  137: { id: 137, name: "Polygon", network: "polygon", rpc: "https://polygon-rpc.com", usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", explorer: "https://polygonscan.com" },
  43114: { id: 43114, name: "Avalanche", network: "avalanche", rpc: "https://api.avax.network/ext/bc/C/rpc", usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", explorer: "https://snowtrace.io" },
  56: { id: 56, name: "BNB Chain", network: "bnb", rpc: "https://bsc-dataseed.binance.org", usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", explorer: "https://bscscan.com", usdcDecimals: 18 },
  59144: { id: 59144, name: "Linea", network: "linea", rpc: "https://rpc.linea.build", usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", explorer: "https://lineascan.build" },
  143: { id: 143, name: "Monad", network: "monad", rpc: "https://monad-mainnet.drpc.org", usdc: "0xf817257fed379853cDe0fa4F97AB987181B1E5f3", explorer: "https://monadexplorer.com" },
  5042: { id: 5042, name: "Arc Mainnet", network: "arc", rpc: "https://rpc.mainnet.arc.io", usdc: "0x3600000000000000000000000000000000000000", explorer: "https://explorer.arc.io" },
};

// Circle Gateway Nanopayments (GatewayWalletBatched) networks we advertise.
// Each one is listed by Circle's GET https://gateway-api.circle.com/v1/x402/supported
// and is verified + settled through Circle Gateway below.
// Other networks Circle may list (e.g. Arc, Sei, HyperEVM) are intentionally
// NOT advertised gasless here; they can be added when we choose to support them.
// Arc, BNB, Linea, Monad, Solana, Sui and Near are on-chain fallback only.
export const GATEWAY_WALLET_MAINNET = "0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE";
export const GATEWAY_API = "https://gateway-api.circle.com";
export const X402_GATEWAY_CHAINS: Array<{ network: string; name: string; usdc: string }> = [
  { network: "eip155:8453", name: "Base", usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  { network: "eip155:1", name: "Ethereum", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  { network: "eip155:42161", name: "Arbitrum", usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  { network: "eip155:10", name: "Optimism", usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
  { network: "eip155:137", name: "Polygon", usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
  { network: "eip155:43114", name: "Avalanche", usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
  { network: "eip155:130", name: "Unichain", usdc: "0x078D782b760474a361dDA0AF3839290b0EF57AD6" },
  { network: "eip155:480", name: "World Chain", usdc: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1" },
  { network: "eip155:146", name: "Sonic", usdc: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894" },
];

export const NON_EVM_CHAINS = [
  { key: "solana", family: "solana", treasury: "4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be", usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { key: "sui", family: "sui", treasury: "0xa15979dcd7429463cdf01aae184cb32e33fcf15d3e46067238ccc384115f9979", usdc: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC" },
  { key: "near", family: "near", treasury: "b63a64053204d89290b73e3dbdce660a2f29d211cd1c400f4a499ac165f98171", usdc: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1" },
];

export function resolveChain(header: string | null | undefined):
  | { kind: "evm"; cfg: ChainCfg } | { kind: "non_evm"; key: string } | null {
  const raw = String(header ?? "8453").trim().toLowerCase();
  if (!raw) return null;
  const caip = raw.startsWith("eip155:") ? raw.slice(7) : raw;
  if (/^\d+$/.test(caip)) {
    const cfg = CHAINS[Number(caip)];
    return cfg ? { kind: "evm", cfg } : null;
  }
  const aliases: Record<string, string> = {
    bsc: "bnb", binance: "bnb", bnb_chain: "bnb", "bnb chain": "bnb",
    eth: "ethereum", mainnet: "ethereum",
    arc_mainnet: "arc", arcmainnet: "arc", "arc mainnet": "arc",
    matic: "polygon", avax: "avalanche", op: "optimism", arb: "arbitrum", sol: "solana",
  };
  const key = aliases[raw] ?? raw.replace(/[\s-]+/g, "_");
  const cfg = Object.values(CHAINS).find((c) => c.network === key);
  if (cfg) return { kind: "evm", cfg };
  if (NON_EVM_CHAINS.some((c) => c.key === key)) return { kind: "non_evm", key };
  return null;
}

// ── Routes + x402 Bazaar schemas ────────────────────────────────────────────
export type RouteKey =
  | "list_agents" | "search_agents" | "get_agent" | "search_merchants" | "self_list" | "boost";

const agentSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" }, name: { type: "string" }, description: { type: "string" },
    website: { type: ["string", "null"] }, logo_url: { type: ["string", "null"] },
    categories: { type: "array", items: { type: "string" } }, region: { type: "string" },
    networks: { type: "array", items: { type: "string" } }, verified: { type: "boolean" },
    boosted_until: { type: ["string", "null"] }, created_at: { type: "string" },
  },
};

export const ROUTES: Record<RouteKey, {
  method: "GET" | "POST"; path: string; amount: bigint; description: string;
  input: Record<string, unknown>; output: Record<string, unknown>;
}> = {
  list_agents: {
    method: "GET", path: "/agents", amount: PRICE_READ, description: "List AI agents in the USDC Directory",
    input: { type: "http", method: "GET", discoverable: true },
    output: { type: "object", properties: { count: { type: "integer" }, agents: { type: "array", items: agentSchema }, paid: { type: "string" } } },
  },
  search_agents: {
    method: "GET", path: "/agents/search", amount: PRICE_READ, description: "Search AI agents by name or description",
    input: { type: "http", method: "GET", discoverable: true, queryParams: { q: { type: "string", required: true, description: "search text" } } },
    output: { type: "object", properties: { q: { type: "string" }, count: { type: "integer" }, agents: { type: "array", items: agentSchema }, paid: { type: "string" } } },
  },
  get_agent: {
    method: "GET", path: "/agents/{id}", amount: PRICE_READ, description: "Get one AI agent by UUID",
    input: { type: "http", method: "GET", discoverable: true, pathParams: { id: { type: "string", format: "uuid", required: true } } },
    output: { type: "object", properties: { agent: agentSchema, paid: { type: "string" } } },
  },
  search_merchants: {
    method: "GET", path: "/merchants/search", amount: PRICE_READ, description: "Search USDC-accepting merchants (max 50 results)",
    input: { type: "http", method: "GET", discoverable: true, queryParams: { q: { type: "string", required: true }, category: { type: "string" }, limit: { type: "integer", maximum: 50 } } },
    output: { type: "object", properties: { q: { type: "string" }, count: { type: "integer" }, merchants: { type: "array", items: { type: "object" } }, paid: { type: "string" } } },
  },
  self_list: {
    method: "POST", path: "/agents", amount: PRICE_SELF_LIST, description: "Self-list an AI agent (1 USDC)",
    input: {
      type: "http", method: "POST", discoverable: true, bodyType: "json",
      bodyFields: {
        name: { type: "string", maxLength: 100, required: true },
        wallet_address: { type: "string", maxLength: 256, required: true, description: "EVM 0x+40 hex, Solana base58, Sui 0x+64 hex, or Near 64 hex / *.near" },
        description: { type: "string", maxLength: 300, required: true },
        logo_url: { type: "string" }, website: { type: "string" },
        networks: { type: "array", items: { type: "string" } }, capabilities: { type: "array", items: { type: "string" } },
      },
    },
    output: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, paid: { type: "string" } } },
  },
  boost: {
    method: "POST", path: "/agents/{id}/boost", amount: PRICE_BOOST, description: `Featured boost for ${BOOST_DAYS} days (5 USDC)`,
    input: { type: "http", method: "POST", discoverable: true, pathParams: { id: { type: "string", format: "uuid", required: true } } },
    output: { type: "object", properties: { id: { type: "string" }, boosted_until: { type: "string" }, paid: { type: "string" } } },
  },
};

export function resourceFor(path: string): string {
  return `${PUBLIC_HOST}${path}`;
}

function amountLabel(amount: bigint): string {
  const usdc = Number(amount) / 1_000_000;
  return usdc < 1 ? `${usdc.toFixed(2)} USDC per call` : `${usdc} USDC`;
}

export function gatewayRequirement(amount: bigint, resource: string, network: string) {
  const c = X402_GATEWAY_CHAINS.find((x) => x.network === network);
  if (!c) return null;
  return {
    scheme: "exact",
    network: c.network,
    asset: c.usdc,
    amount: amount.toString(),
    payTo: TREASURY,
    maxTimeoutSeconds: 604800,
    extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: GATEWAY_WALLET_MAINNET },
  };
}

export function buildAccepts(route: RouteKey, resource: string) {
  const r = ROUTES[route];
  const desc = `USDC Directory: ${r.description}. ${amountLabel(r.amount)}. Settled via Circle Gateway Nanopayments.`;
  return X402_GATEWAY_CHAINS.map((c) => ({
    ...gatewayRequirement(r.amount, resource, c.network)!,
    maxAmountRequired: r.amount.toString(),
    resource,
    description: desc,
    mimeType: "application/json",
    outputSchema: { input: r.input, output: r.output },
  }));
}

/** Full payment-requirements object (402 body / MCP error data). */
export function paymentRequirements(route: RouteKey, resource: string, error?: string) {
  const r = ROUTES[route];
  const accepts = buildAccepts(route, resource);
  const resourceInfo = { url: resource, description: accepts[0].description, mimeType: "application/json" };
  return {
    error: error ?? "X-PAYMENT required",
    x402Version: 2,
    resource: resourceInfo,
    accepts,
    extensions: { bazaar: { info: { input: r.input, output: r.output } } },
    alternative: {
      description:
        "On-chain fallback (not gasless): pay USDC to the treasury on any listed chain, then resend with X-Payment-TxHash + X-Payment-Chain headers.",
      amount: r.amount.toString(),
      treasury: TREASURY,
      chains: [
        ...Object.values(CHAINS).map((c) => ({ chainId: c.id, key: c.network, family: "evm", name: c.name, treasury: TREASURY, usdc: c.usdc })),
        ...NON_EVM_CHAINS,
      ],
    },
  };
}

export function encodeB64Json(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function paymentRequiredHeader(reqs: ReturnType<typeof paymentRequirements>): string {
  return encodeB64Json({ x402Version: 2, resource: reqs.resource, accepts: reqs.accepts, extensions: reqs.extensions });
}

// ── On-chain EVM verification ───────────────────────────────────────────────
const ERC20_TRANSFER_ABI = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);

async function verifyOnChainPayment(txHash: string, chainId: number, amount: bigint):
  Promise<{ ok: true; from: string } | { ok: false; reason: string }> {
  const cfg = CHAINS[chainId];
  if (!cfg) return { ok: false, reason: "unsupported chain" };
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) return { ok: false, reason: "bad tx hash" };
  const client = createPublicClient({ transport: http(cfg.rpc) });
  let receipt;
  try { receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` }); }
  catch (e) { return { ok: false, reason: `receipt fetch failed: ${(e as Error).message}` }; }
  if (!receipt || receipt.status !== "success") return { ok: false, reason: "tx not successful" };
  const usdcAddr = getAddress(cfg.usdc).toLowerCase();
  let from: string | null = null;
  let total = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdcAddr) continue;
    try {
      const d = decodeEventLog({ abi: ERC20_TRANSFER_ABI, data: log.data, topics: log.topics });
      const a = d.args as { from: string; to: string; value: bigint };
      if (a.to.toLowerCase() === TREASURY) { total += a.value; if (!from) from = a.from.toLowerCase(); }
    } catch { /* not a Transfer */ }
  }
  const required = cfg.usdcDecimals && cfg.usdcDecimals > 6 ? amount * 10n ** BigInt(cfg.usdcDecimals - 6) : amount;
  if (total < required) return { ok: false, reason: `paid ${total} < required ${required}` };
  return { ok: true, from: from ?? "unknown" };
}

// ── Legacy direct EIP-3009 path (v1 network names like "base") ──────────────
type Auth = { from: `0x${string}`; to: `0x${string}`; value: string; validAfter: string; validBefore: string; nonce: `0x${string}` };

async function verifyEip3009(parsed: any, amount: bigint):
  Promise<{ ok: true; payer: string; nonce: string; network: string; chainId: number; auth: Auth; signature: `0x${string}` } | { ok: false; reason: string }> {
  const cfg = Object.values(CHAINS).find((c) => c.network === parsed.network);
  if (!cfg) return { ok: false, reason: `unknown network ${parsed.network}` };
  if (parsed.scheme !== "exact") return { ok: false, reason: "scheme must be 'exact'" };
  const a: Auth | undefined = parsed.payload?.authorization;
  if (!a) return { ok: false, reason: "missing authorization" };
  if (a.to.toLowerCase() !== TREASURY) return { ok: false, reason: "wrong recipient" };
  if (BigInt(a.value) < amount) return { ok: false, reason: "insufficient value" };
  const now = Math.floor(Date.now() / 1000);
  if (Number(a.validAfter) > now) return { ok: false, reason: "auth not yet valid" };
  if (Number(a.validBefore) < now) return { ok: false, reason: "auth expired" };
  try {
    const recovered = await recoverTypedDataAddress({
      domain: { name: "USD Coin", version: "2", chainId: cfg.id, verifyingContract: getAddress(cfg.usdc) },
      types: { TransferWithAuthorization: [
        { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" },
      ] },
      primaryType: "TransferWithAuthorization",
      message: { from: getAddress(a.from), to: getAddress(a.to), value: BigInt(a.value), validAfter: BigInt(a.validAfter), validBefore: BigInt(a.validBefore), nonce: a.nonce },
      signature: parsed.payload.signature,
    });
    if (recovered.toLowerCase() !== a.from.toLowerCase()) return { ok: false, reason: "signature does not match 'from'" };
  } catch (e) { return { ok: false, reason: `sig verify failed: ${(e as Error).message}` }; }
  return { ok: true, payer: a.from.toLowerCase(), nonce: a.nonce, network: parsed.network, chainId: cfg.id, auth: a, signature: parsed.payload.signature };
}

const TRANSFER_WITH_AUTH_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
]);

async function settleEip3009(chainId: number, auth: Auth, sig: `0x${string}`):
  Promise<{ ok: true; txHash: string } | { ok: false; reason: string }> {
  const cfg = CHAINS[chainId];
  const pk = Deno.env.get("X402_SETTLEMENT_PRIVATE_KEY");
  if (!cfg || !pk) return { ok: false, reason: "settlement signer not configured" };
  try {
    const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
    const wallet = createWalletClient({ account, transport: http(cfg.rpc) });
    const r = ("0x" + sig.slice(2, 66)) as `0x${string}`;
    const s = ("0x" + sig.slice(66, 130)) as `0x${string}`;
    let v = parseInt(sig.slice(130, 132), 16); if (v < 27) v += 27;
    const txHash = await wallet.writeContract({
      address: getAddress(cfg.usdc), abi: TRANSFER_WITH_AUTH_ABI, functionName: "transferWithAuthorization",
      args: [getAddress(auth.from), getAddress(auth.to), BigInt(auth.value), BigInt(auth.validAfter), BigInt(auth.validBefore), auth.nonce, v, r, s],
      chain: null,
    } as Parameters<typeof wallet.writeContract>[0]);
    return { ok: true, txHash };
  } catch (e) { return { ok: false, reason: (e as Error).message }; }
}

// ── Circle Gateway client (overridable in tests) ────────────────────────────
export const gatewayClient = {
  post: async (path: string, body: unknown): Promise<any> => {
    const res = await fetch(`${GATEWAY_API}${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { error: text, status: res.status }; }
  },
};

// ── Rate limit ──────────────────────────────────────────────────────────────
async function rateLimitOk(sb: Sb, bucketKey: string, endpoint: string, limit: number, windowSec: number) {
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count } = await sb.from("agent_rate_limits").select("id", { count: "exact", head: true })
    .eq("bucket_key", bucketKey).eq("endpoint", endpoint).gte("created_at", since);
  if ((count ?? 0) >= limit) return false;
  await sb.from("agent_rate_limits").insert({ bucket_key: bucketKey, endpoint });
  return true;
}

// ── Payment gate ────────────────────────────────────────────────────────────
export type PaymentInput = {
  xPayment?: string | Record<string, unknown> | null;
  txHash?: string | null;
  chain?: string | null;
  ip?: string;
};
export type GateOk = { ok: true; paymentId: string; payer: string; chain: string; scheme: string; txHash?: string };
export type GateFail = { ok: false; status: number; body: any };

export function decodePayment(x: string | Record<string, unknown>): any | null {
  if (typeof x === "object") return x;
  const s = x.trim();
  try { return JSON.parse(s.startsWith("{") ? s : new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)))); }
  catch { return null; }
}

export async function gatePayment(sb: Sb, p: PaymentInput, route: RouteKey, resource: string, endpoint: string): Promise<GateOk | GateFail> {
  const amount = ROUTES[route].amount;
  const method = ROUTES[route].method;
  const fail402 = (reason?: string): GateFail => ({ ok: false, status: 402, body: paymentRequirements(route, resource, reason) });

  if (!p.xPayment && !p.txHash) {
    const ok = await rateLimitOk(sb, `ip:${p.ip ?? "unknown"}`, endpoint, 30, 60);
    if (!ok) return { ok: false, status: 429, body: { error: "rate limited" } };
    return fail402();
  }

  // On-chain fallback
  if (p.txHash) {
    const txHash = p.txHash;
    const resolved = resolveChain(p.chain);
    if (!resolved) {
      return { ok: false, status: 400, body: { error: "unsupported X-Payment-Chain", supported: [...Object.values(CHAINS).map((c) => c.network), ...NON_EVM_CHAINS.map((c) => c.key)] } };
    }
    const { data: existing } = await sb.from("agent_api_payments").select("id").eq("payment_id", txHash).eq("endpoint", endpoint).maybeSingle();
    if (existing) return { ok: false, status: 409, body: { error: "tx hash already used for this endpoint" } };
    let network: string, payer: string;
    if (resolved.kind === "evm") {
      const v = await verifyOnChainPayment(txHash, resolved.cfg.id, amount);
      if (!v.ok) return fail402(`payment invalid: ${v.reason}`);
      network = resolved.cfg.network; payer = v.from;
    } else {
      const v = await verifyUsdcPayment(resolved.key, txHash, amount);
      if (!v.ok) return fail402(`payment invalid: ${v.error}`);
      network = resolved.key; payer = v.payer;
    }
    await sb.from("agent_api_payments").insert({ payment_id: txHash, endpoint, method, amount_usdc: amount.toString(), chain: network, agent_wallet: payer, scheme: "onchain" });
    return { ok: true, paymentId: txHash, payer, chain: network, scheme: "onchain" };
  }

  const parsed = decodePayment(p.xPayment!);
  if (!parsed) return fail402("invalid base64/json X-PAYMENT");
  const network: string = parsed.accepted?.network ?? parsed.paymentRequirements?.network ?? parsed.network ?? "";

  // Circle Gateway Nanopayments (GatewayWalletBatched) path
  if (network.startsWith("eip155:")) {
    const requirement = gatewayRequirement(amount, resource, network);
    if (!requirement) return fail402(`network ${network} is not supported for gasless payment`);
    const auth: Auth | undefined = parsed.payload?.authorization;
    if (!auth?.nonce) return fail402("missing authorization");
    if (String(auth.to).toLowerCase() !== TREASURY) return fail402("wrong recipient");
    if (BigInt(auth.value ?? "0") < amount) return fail402("insufficient value for this route");

    const paymentPayload = { ...parsed, x402Version: parsed.x402Version ?? 2 };
    const ver = await gatewayClient.post("/v1/x402/verify", { paymentPayload, paymentRequirements: requirement });
    if (!ver?.isValid) return fail402(`gateway verify failed: ${ver?.invalidReason ?? ver?.message ?? "invalid"}`);

    const payer = String(ver.payer ?? auth.from).toLowerCase();
    const { error: nonceErr } = await sb.from("x402_nonces").insert({ chain: network, nonce: auth.nonce, payer, endpoint, amount_usdc: amount.toString() });
    if (nonceErr) return { ok: false, status: 409, body: { error: "x402 nonce already used" } };

    const st = await gatewayClient.post("/v1/x402/settle", { paymentPayload, paymentRequirements: requirement });
    if (!st?.success) {
      await sb.from("x402_nonces").delete().eq("chain", network).eq("nonce", auth.nonce);
      return fail402(`gateway settle failed: ${st?.errorReason ?? st?.message ?? "unknown"}`);
    }
    const tx = st.transaction ? String(st.transaction) : undefined;
    await sb.from("x402_nonces").update({ tx_hash: tx ?? null, settled: true, settled_at: new Date().toISOString() }).eq("chain", network).eq("nonce", auth.nonce);
    const paymentId = `x402:${network}:${auth.nonce}`;
    await sb.from("agent_api_payments").insert({ payment_id: paymentId, endpoint, method, amount_usdc: amount.toString(), chain: network, agent_wallet: payer, scheme: "x402-gateway" });
    return { ok: true, paymentId, payer, chain: network, scheme: "x402-gateway", txHash: tx };
  }

  // Legacy direct EIP-3009 path
  const v = await verifyEip3009(parsed, amount);
  if (!v.ok) return fail402(v.reason);
  const { error: nonceErr } = await sb.from("x402_nonces").insert({ chain: v.network, nonce: v.nonce, payer: v.payer, endpoint, amount_usdc: amount.toString() });
  if (nonceErr) return { ok: false, status: 409, body: { error: "x402 nonce already used" } };
  const settled = await settleEip3009(v.chainId, v.auth, v.signature);
  if (!settled.ok) {
    await sb.from("x402_nonces").delete().eq("chain", v.network).eq("nonce", v.nonce);
    return fail402(`settlement failed: ${settled.reason}`);
  }
  await sb.from("x402_nonces").update({ tx_hash: settled.txHash, settled: true, settled_at: new Date().toISOString() }).eq("chain", v.network).eq("nonce", v.nonce);
  const paymentId = `x402:${v.network}:${v.nonce}`;
  await sb.from("agent_api_payments").insert({ payment_id: paymentId, endpoint, method, amount_usdc: amount.toString(), chain: v.network, agent_wallet: v.payer, scheme: "x402" });
  return { ok: true, paymentId, payer: v.payer, chain: v.network, scheme: "x402", txHash: settled.txHash };
}

export function paymentResponseHeader(g: GateOk): string {
  return encodeB64Json({ success: true, paymentId: g.paymentId, network: g.chain, scheme: g.scheme, transaction: g.txHash ?? null, payer: g.payer });
}

// ── Validation ──────────────────────────────────────────────────────────────
/** Returns the normalized wallet, or null if the format is not recognized. */
export function normalizeWallet(raw: unknown): string | null {
  const w = String(raw ?? "").trim();
  if (!w || w.length > 256) return null;
  if (/^0x[0-9a-fA-F]{40}$/.test(w)) return w.toLowerCase();      // EVM
  if (/^0x[0-9a-fA-F]{64}$/.test(w)) return w;                    // Sui
  if (/^[0-9a-f]{64}$/.test(w)) return w;                         // Near implicit
  if (/^([a-z0-9_-]+\.)*[a-z0-9_-]+\.near$/.test(w)) return w;    // Near named
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(w)) return w;          // Solana
  return null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function safeQuery(q: unknown): string {
  return String(q ?? "").trim().slice(0, 100).replace(/[,()."'\\*%:]/g, " ").replace(/\s+/g, " ").trim();
}

export type SelfListInput = { name: string; wallet: string; description: string; logo_url: string | null; website: string | null; networks: string[]; capabilities: string[] };

export function validateSelfList(body: any): { ok: true; value: SelfListInput } | { ok: false; error: string } {
  const b = body ?? {};
  const name = String(b.name ?? "").trim();
  const description = String(b.description ?? "").trim();
  if (!name || name.length > 100) return { ok: false, error: "name required (<=100)" };
  if (!b.wallet_address || String(b.wallet_address).trim().length > 256) return { ok: false, error: "wallet_address required (<=256)" };
  const wallet = normalizeWallet(b.wallet_address);
  if (!wallet) return { ok: false, error: "wallet_address format invalid (EVM 0x+40 hex, Solana base58, Sui 0x+64 hex, Near 64 hex or *.near)" };
  if (!description || description.length > 300) return { ok: false, error: "description required (<=300)" };
  return {
    ok: true,
    value: {
      name, wallet, description,
      logo_url: b.logo_url ? String(b.logo_url).trim() : null,
      website: b.website ? String(b.website).trim().slice(0, 255) : null,
      networks: Array.isArray(b.networks) ? b.networks.slice(0, 10).map(String) : [],
      capabilities: Array.isArray(b.capabilities) ? b.capabilities.slice(0, 20).map(String) : [],
    },
  };
}

// ── Data operations (shared by HTTP + MCP) ──────────────────────────────────
const AGENT_COLS = "id, name, description, website, logo_url, categories, region, networks, verified, boosted_until, created_at";
type OpResult = { status: number; body: any };

export async function listAgents(sb: Sb, paid: string): Promise<OpResult> {
  const { data, error } = await sb.from("partners").select(AGENT_COLS).contains("categories", ["AI Agents"])
    .order("boosted_until", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(500);
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { count: data?.length ?? 0, agents: data ?? [], paid } };
}

export async function getAgent(sb: Sb, id: string, paid: string): Promise<OpResult> {
  const { data, error } = await sb.from("partners").select(AGENT_COLS).eq("id", id).maybeSingle();
  if (error) return { status: 500, body: { error: error.message } };
  if (!data) return { status: 404, body: { error: "not found" } };
  return { status: 200, body: { agent: data, paid } };
}

export async function searchAgents(sb: Sb, qRaw: string, paid: string): Promise<OpResult> {
  const q = safeQuery(qRaw);
  if (!q) return { status: 400, body: { error: "q param required" } };
  const { data, error } = await sb.from("partners").select(`${AGENT_COLS}, wallet_address`).contains("categories", ["AI Agents"])
    .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
    .order("boosted_until", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(50);
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 200, body: { q, count: data?.length ?? 0, agents: data ?? [], paid } };
}

export const MERCHANT_MAX = 50;
export async function searchMerchants(sb: Sb, qRaw: string, paid: string, opts: { category?: string; limit?: number } = {}): Promise<OpResult> {
  const q = safeQuery(qRaw);
  if (!q) return { status: 400, body: { error: "q param required" } };
  const limit = Math.min(Math.max(Number(opts.limit ?? MERCHANT_MAX) || MERCHANT_MAX, 1), MERCHANT_MAX);
  let query = sb.from("partners").select("id, name, description, website, logo_url, categories, region, networks, verified, created_at")
    .or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  if (opts.category && String(opts.category).trim()) query = query.contains("categories", [String(opts.category).trim().slice(0, 64)]);
  const { data, error } = await query.limit(limit);
  if (error) return { status: 500, body: { error: error.message } };
  const rows = (data ?? []).slice(0, MERCHANT_MAX);
  return { status: 200, body: { q, count: rows.length, merchants: rows, paid } };
}

export async function selfListAgent(sb: Sb, v: SelfListInput, gate: GateOk): Promise<OpResult> {
  const categories = ["AI Agents", ...v.capabilities.map((c) => `AI: ${c}`).slice(0, 5)];
  const { data, error } = await sb.from("partners").insert({
    name: v.name, description: v.description, website: v.website, categories, region: "Global",
    networks: v.networks.length > 0 ? v.networks : [gate.chain], wallet_address: v.wallet, logo_url: v.logo_url,
    payment_status: "confirmed", payment_id: gate.paymentId,
  }).select().single();
  if (error) return { status: 500, body: { error: error.message } };
  return { status: 201, body: { id: data.id, name: data.name, paid: gate.paymentId } };
}

export async function boostAgent(sb: Sb, id: string, gate: GateOk): Promise<OpResult> {
  const expiresAt = new Date(Date.now() + BOOST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: upErr } = await sb.from("partners").update({ boosted_until: expiresAt }).eq("id", id);
  if (upErr) return { status: 500, body: { error: upErr.message } };
  const { error: insErr } = await sb.from("agent_boosts").insert({ partner_id: id, payment_id: gate.paymentId, amount_usdc: PRICE_BOOST.toString(), chain: gate.chain, expires_at: expiresAt });
  if (insErr) return { status: 500, body: { error: insErr.message } };
  return { status: 200, body: { id, boosted_until: expiresAt, paid: gate.paymentId } };
}

// ── MCP tool catalog (prices in descriptions) ───────────────────────────────
export const MCP_TOOLS: Array<{ name: string; route: RouteKey; description: string; inputSchema: Record<string, unknown> }> = [
  { name: "list_agents", route: "list_agents", description: "List AI agents in the USDC Directory. Price: 0.01 USDC per call (x402).", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "search_agents", route: "search_agents", description: "Search AI agents by name or description. Price: 0.01 USDC per call (x402).", inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"], additionalProperties: false } },
  { name: "get_agent", route: "get_agent", description: "Get one AI agent by UUID. Price: 0.01 USDC per call (x402).", inputSchema: { type: "object", properties: { id: { type: "string", format: "uuid" } }, required: ["id"], additionalProperties: false } },
  { name: "search_merchants", route: "search_merchants", description: "Search USDC-accepting merchants (max 50 results). Price: 0.01 USDC per call (x402).", inputSchema: { type: "object", properties: { q: { type: "string" }, category: { type: "string" }, limit: { type: "number", maximum: 50 } }, required: ["q"], additionalProperties: false } },
  { name: "submit_agent", route: "self_list", description: "Self-list an AI agent in the directory. Price: 1 USDC (x402).", inputSchema: { type: "object", properties: { name: { type: "string", maxLength: 100 }, wallet_address: { type: "string", maxLength: 256 }, description: { type: "string", maxLength: 300 }, logo_url: { type: "string" }, website: { type: "string" }, networks: { type: "array", items: { type: "string" } }, capabilities: { type: "array", items: { type: "string" } } }, required: ["name", "wallet_address", "description"], additionalProperties: false } },
  { name: "boost_agent", route: "boost", description: `Boost an agent listing to featured placement for ${BOOST_DAYS} days. Price: 5 USDC (x402).`, inputSchema: { type: "object", properties: { id: { type: "string", format: "uuid" } }, required: ["id"], additionalProperties: false } },
];
