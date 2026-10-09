// agents-api: paid agent-facing directory API (x402 + on-chain USDC).
//   GET  /agents              – list AI agents        (0.01 USDC)
//   GET  /agents/search?q=    – search agents         (0.01 USDC)
//   GET  /agents/{id}         – fetch one agent       (0.01 USDC)
//   GET  /merchants/search?q= – search merchants      (0.01 USDC, max 50)
//   POST /agents              – self-list new agent   (1 USDC)
//   POST /agents/{id}/boost   – featured boost        (5 USDC, 30 days)
// Payment: X-PAYMENT (Circle Gateway GatewayWalletBatched) or
// X-Payment-TxHash + X-Payment-Chain (on-chain fallback). Logic lives in
// ../_shared/agents-core.ts, shared with the MCP server.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  PUBLIC_HOST, SITE, UUID_RE, BOOST_DAYS,
  gatePayment, paymentRequiredHeader, paymentResponseHeader, resourceFor, validateSelfList,
  listAgents, getAgent, searchAgents, searchMerchants, selfListAgent, boostAgent,
  type GateFail, type GateOk, type RouteKey,
} from "../_shared/agents-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-payment, payment-signature, x-payment-txhash, x-payment-chain, x-public-host",
  "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", ...extra } });
}

function failResponse(f: GateFail) {
  if (f.status === 402 && f.body?.accepts) return json(f.body, 402, { "PAYMENT-REQUIRED": paymentRequiredHeader(f.body) });
  return json(f.body, f.status);
}

function okHeaders(g: GateOk) {
  const v = paymentResponseHeader(g);
  return { "PAYMENT-RESPONSE": v, "X-PAYMENT-RESPONSE": v };
}

function basePath(url: URL): string {
  const p = url.pathname.replace(/^.*\/agents-api/, "");
  return p || "/";
}

async function handle(req: Request, sb: any): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const path = basePath(url);
  const method = req.method === "HEAD" ? "GET" : req.method;
  const resource = resourceFor(path); // always PUBLIC_HOST
  const payment = {
    xPayment: req.headers.get("x-payment") ?? req.headers.get("payment-signature"),
    txHash: req.headers.get("x-payment-txhash"),
    chain: req.headers.get("x-payment-chain"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown",
  };
  const gate = (route: RouteKey, endpoint: string) => gatePayment(sb, payment, route, resource, endpoint);
  const send = (r: { status: number; body: any }, g: GateOk) => json(r.body, r.status, r.status < 300 ? okHeaders(g) : {});

  try {
    if (method === "GET" && path === "/agents") {
      const g = await gate("list_agents", "/agents"); if (!g.ok) return failResponse(g);
      return send(await listAgents(sb, g.paymentId), g);
    }
    if (method === "GET" && path === "/agents/search") {
      const g = await gate("search_agents", "/agents/search"); if (!g.ok) return failResponse(g);
      return send(await searchAgents(sb, url.searchParams.get("q") ?? "", g.paymentId), g);
    }
    if (method === "GET" && path === "/merchants/search") {
      const g = await gate("search_merchants", "/merchants/search"); if (!g.ok) return failResponse(g);
      return send(await searchMerchants(sb, url.searchParams.get("q") ?? "", g.paymentId, {
        category: url.searchParams.get("category") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 50),
      }), g);
    }
    const detail = path.match(/^\/agents\/([0-9a-f-]{36})$/i);
    if (method === "GET" && detail) {
      const g = await gate("get_agent", path); if (!g.ok) return failResponse(g);
      return send(await getAgent(sb, detail[1], g.paymentId), g);
    }
    if (method === "POST" && path === "/agents") {
      // Validate before charging so bad input never costs the caller.
      const hasPayment = payment.xPayment || payment.txHash;
      let parsed: any = null;
      if (hasPayment) {
        try { parsed = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
        const v = validateSelfList(parsed);
        if (!v.ok) return json({ error: v.error }, 400);
      }
      const g = await gate("self_list", "/agents"); if (!g.ok) return failResponse(g);
      const v = validateSelfList(parsed);
      if (!v.ok) return json({ error: v.error }, 400);
      return send(await selfListAgent(sb, v.value, g), g);
    }
    const boost = path.match(/^\/agents\/([0-9a-f-]{36})\/boost$/i);
    if (method === "POST" && boost && UUID_RE.test(boost[1])) {
      const g = await gate("boost", path); if (!g.ok) return failResponse(g);
      return send(await boostAgent(sb, boost[1], g), g);
    }
    if (method === "GET" && path === "/") {
      return json({
        name: "USDC Directory Agent API", version: "2", base_url: PUBLIC_HOST,
        manifest: `${SITE}/.well-known/x402`, openapi: `${SITE}/openapi.json`, mcp: `${PUBLIC_HOST}/mcp`,
        endpoints: [
          { path: "/agents", method: "GET", price_usdc: "0.01" },
          { path: "/agents/search", method: "GET", price_usdc: "0.01" },
          { path: "/agents/{id}", method: "GET", price_usdc: "0.01" },
          { path: "/merchants/search", method: "GET", price_usdc: "0.01" },
          { path: "/agents", method: "POST", price_usdc: "1" },
          { path: "/agents/{id}/boost", method: "POST", price_usdc: "5", duration_days: BOOST_DAYS },
        ],
      });
    }
    return json({ error: "not found", path }, 404);
  } catch (e) {
    console.error("agents-api error:", e);
    return json({ error: (e as Error).message }, 500);
  }
}

Deno.serve((req) => handle(req, createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!)));
