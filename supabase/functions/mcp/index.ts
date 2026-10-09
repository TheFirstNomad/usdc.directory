// MCP server (Streamable HTTP, JSON-RPC 2.0) for USDC Directory.
// initialize and tools/list are free; every tool call is paid via x402.
// Unpaid tools/call -> JSON-RPC error 402 with the same payment requirements
// as the HTTP API. Pay on retry via params._meta["x402/payment"] or an
// X-PAYMENT header (or X-Payment-TxHash + X-Payment-Chain for on-chain).
// All payment + data logic is shared with agents-api via ../_shared/agents-core.ts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  MCP_TOOLS, PUBLIC_HOST, SITE, ROUTES, UUID_RE,
  gatePayment, paymentResponseHeader, resourceFor, validateSelfList,
  listAgents, getAgent, searchAgents, searchMerchants, selfListAgent, boostAgent,
} from "../_shared/agents-core.ts";

const PROTOCOL_VERSION = "2025-06-18";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, authorization, apikey, x-client-info, mcp-session-id, mcp-protocol-version, x-payment, x-payment-txhash, x-payment-chain, x-public-host",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Expose-Headers": "mcp-session-id, PAYMENT-RESPONSE",
};

const text = (value: unknown) => [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }];
const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string, data?: unknown) =>
  ({ jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } });

type Hdr = { xPayment: string | null; txHash: string | null; chain: string | null; ip: string };

async function callTool(sb: any, id: unknown, params: any, hdr: Hdr) {
  const tool = MCP_TOOLS.find((t) => t.name === params?.name);
  if (!tool) return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
  const args = params?.arguments ?? {};
  const meta = params?._meta ?? {};

  // Pre-payment validation so bad input never costs the caller.
  let selfList: ReturnType<typeof validateSelfList> | null = null;
  if (tool.route === "self_list") {
    selfList = validateSelfList(args);
    if (!selfList.ok) return rpcError(id, -32602, selfList.error);
  }
  let path = ROUTES[tool.route].path;
  if (tool.route === "get_agent" || tool.route === "boost") {
    const aid = String(args.id ?? "").trim();
    if (!UUID_RE.test(aid)) return rpcError(id, -32602, "id must be a UUID");
    path = path.replace("{id}", aid);
  }
  if ((tool.route === "search_agents" || tool.route === "search_merchants") && !String(args.q ?? "").trim()) {
    return rpcError(id, -32602, "q is required");
  }

  const g = await gatePayment(sb, {
    xPayment: meta["x402/payment"] ?? hdr.xPayment,
    txHash: meta["x402/txHash"] ?? hdr.txHash,
    chain: meta["x402/chain"] ?? hdr.chain,
    ip: hdr.ip,
  }, tool.route, resourceFor(path), path);
  if (!g.ok) {
    if (g.status === 402) return rpcError(id, 402, g.body?.error ?? "Payment required", g.body);
    return rpcError(id, g.status, g.body?.error ?? "error", g.body);
  }

  let r: { status: number; body: any };
  switch (tool.route) {
    case "list_agents": r = await listAgents(sb, g.paymentId); break;
    case "search_agents": r = await searchAgents(sb, String(args.q), g.paymentId); break;
    case "get_agent": r = await getAgent(sb, String(args.id).trim(), g.paymentId); break;
    case "search_merchants": r = await searchMerchants(sb, String(args.q), g.paymentId, { category: args.category, limit: args.limit }); break;
    case "self_list": r = await selfListAgent(sb, (selfList as any).value, g); break;
    case "boost": r = await boostAgent(sb, String(args.id).trim(), g); break;
  }
  return rpcResult(id, {
    content: text(r!.body),
    structuredContent: r!.body,
    isError: r!.status >= 400,
    _meta: { "x402/payment-response": paymentResponseHeader(g) },
  });
}

async function handleRpc(sb: any, msg: any, hdr: Hdr): Promise<unknown | null> {
  const { id, method, params } = msg ?? {};
  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "usdc-directory", title: "USDC Directory", version: "2.0.0" },
        instructions:
          "Paid USDC Directory tools (x402). Reads 0.01 USDC; submit_agent 1 USDC; boost_agent 5 USDC. An unpaid call returns error 402 with payment requirements; retry with params._meta[\"x402/payment\"] or an X-PAYMENT header.",
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: MCP_TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call":
      try { return await callTool(sb, id, params, hdr); }
      catch (e) { return rpcResult(id, { content: text(`Error: ${(e as Error).message}`), isError: true }); }
    case "resources/list": return rpcResult(id, { resources: [] });
    case "prompts/list": return rpcResult(id, { prompts: [] });
    default:
      if (id === undefined || id === null) return null;
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const jsonHeaders = { ...cors, "content-type": "application/json" };
  if (req.method === "GET") {
    return new Response(JSON.stringify({
      name: "usdc-directory", transport: "streamable-http", protocolVersion: PROTOCOL_VERSION,
      url: `${PUBLIC_HOST}/mcp`, tools: MCP_TOOLS.map((t) => t.name), docs: `${SITE}/api-docs`,
    }, null, 2), { headers: jsonHeaders });
  }
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify(rpcError(null, -32600, "Method not allowed")), { status: 405, headers: jsonHeaders });

  let body: any;
  try { body = await req.json(); }
  catch { return new Response(JSON.stringify(rpcError(null, -32700, "Parse error")), { status: 400, headers: jsonHeaders }); }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const hdr: Hdr = {
    xPayment: req.headers.get("x-payment"),
    txHash: req.headers.get("x-payment-txhash"),
    chain: req.headers.get("x-payment-chain"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown",
  };
  const messages = Array.isArray(body) ? body : [body];
  const responses = (await Promise.all(messages.map((m) => handleRpc(sb, m, hdr)))).filter((r) => r !== null);
  if (responses.length === 0) return new Response(null, { status: 202, headers: cors });
  return new Response(JSON.stringify(Array.isArray(body) ? responses : responses[0]), {
    headers: { ...jsonHeaders, "mcp-session-id": crypto.randomUUID() },
  });
});
