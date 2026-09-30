// MCP server (Model Context Protocol) — Streamable HTTP transport.
// Exposes USDC Directory tools to Claude Desktop, Cursor, Continue, GPT, etc.
//
// Implemented as a dependency-free JSON-RPC 2.0 handler so the function can
// never fail to boot on a third-party SDK signature change.
//
// Tools:
//   list_agents      – list AI agents in the directory (free preview, 20 max)
//   get_agent        – fetch one agent by id (free preview)
//   search_merchants – search USDC-accepting merchants (free preview)
//   submit_agent     – returns instructions + payment quote (1 USDC via x402)
//   boost_agent      – returns instructions + payment quote (5 USDC via x402)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const API_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1/agents-api`;
const SITE = "https://usdc.directory";
const TREASURY = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c";

const PROTOCOL_VERSION = "2025-06-18";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "content-type, authorization, apikey, x-client-info, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, any>) => Promise<unknown> | unknown;
};

const text = (value: unknown) => ({
  content: [{
    type: "text",
    text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
  }],
});

const TOOLS: Tool[] = [
  {
    name: "list_agents",
    description:
      "List AI agents in the USDC Directory (free preview, max 20). For full paid programmatic access use GET /agents-api/agents with x402.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", description: "1-20", default: 10 } },
      additionalProperties: false,
    },
    handler: async (args) => {
      const limit = Math.min(Math.max(Number(args.limit ?? 10) || 10, 1), 20);
      const { data, error } = await supabase
        .from("partners_public")
        .select("id, name, description, website, categories, boosted_until, verified")
        .contains("categories", ["AI Agents"])
        .order("boosted_until", { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) return text({ error: error.message });
      return text({ count: data?.length ?? 0, agents: data ?? [] });
    },
  },
  {
    name: "get_agent",
    description: "Fetch one agent or merchant listing by UUID (free preview).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "listing UUID" } },
      required: ["id"],
      additionalProperties: false,
    },
    handler: async (args) => {
      const id = String(args.id ?? "").trim();
      if (!id) return text({ error: "id is required" });
      const { data, error } = await supabase
        .from("partners_public")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) return text({ error: error.message });
      return text(data ?? { error: "not found" });
    },
  },
  {
    name: "search_merchants",
    description:
      "Search USDC-accepting merchants and services by free-text query and/or category (free preview, max 50).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "free-text match against name/description" },
        category: { type: "string" },
        limit: { type: "number", default: 20 },
      },
      additionalProperties: false,
    },
    handler: async (args) => {
      const limit = Math.min(Math.max(Number(args.limit ?? 20) || 20, 1), 50);
      let q = supabase
        .from("partners_public")
        .select("id, name, description, website, categories, region");
      if (typeof args.category === "string" && args.category.trim()) {
        q = q.contains("categories", [args.category.trim().slice(0, 64)]);
      }
      if (typeof args.query === "string" && args.query.trim()) {
        // Strip PostgREST filter metacharacters so raw input can't inject extra clauses.
        const safe = args.query
          .trim()
          .slice(0, 100)
          .replace(/[,()."'\\*%:]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (safe) q = q.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
      }
      const { data, error } = await q.limit(limit);
      if (error) return text({ error: error.message });
      return text({ count: data?.length ?? 0, results: data ?? [] });
    },
  },
  {
    name: "submit_agent",
    description:
      "Get instructions to self-list an AI agent. Costs 1 USDC via x402. Returns the POST endpoint and payment quote.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: () =>
      text({
        action: "POST",
        endpoint: `${API_BASE}/agents`,
        price: { amount_usdc: "1.000", asset: "USDC" },
        x402_networks: [
          "eip155:8453", "eip155:1", "eip155:42161", "eip155:10", "eip155:137",
          "eip155:43114", "eip155:130", "eip155:480", "eip155:146",
        ],
        onchain_networks: [
          "arc", "base", "ethereum", "arbitrum", "optimism", "polygon",
          "avalanche", "bnb", "linea", "monad", "solana", "sui", "near",
        ],
        treasury: TREASURY,
        body_schema: {
          name: "string",
          wallet_address: "0x... (or chain-native address)",
          description: "string<=300",
          website: "https://... (optional)",
          logo_url: "https://... (optional)",
        },
        payment_methods: [
          "x402: retry with X-PAYMENT header (Circle Gateway Nanopayments, gasless)",
          "On-chain prepaid: send USDC to treasury, retry with X-Payment-TxHash + X-Payment-Chain",
        ],
        docs: `${SITE}/api-docs`,
      }),
  },
  {
    name: "boost_agent",
    description:
      "Get instructions to boost a listing to featured placement for 30 days. Costs 5 USDC via x402.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "listing UUID" } },
      required: ["id"],
      additionalProperties: false,
    },
    handler: (args) =>
      text({
        action: "POST",
        endpoint: `${API_BASE}/agents/${String(args.id ?? "").trim()}/boost`,
        price: { amount_usdc: "5.000", asset: "USDC" },
        duration_days: 30,
        treasury: TREASURY,
        docs: `${SITE}/api-docs`,
      }),
  },
];

function rpcResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}
function rpcError(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleRpc(msg: any): Promise<unknown | null> {
  const { id, method, params } = msg ?? {};
  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: "usdc-directory",
          version: "1.1.0",
          description:
            "USDC Directory — discover merchants and AI agents that accept USDC. Pay-per-call agent API via x402.",
        },
        instructions:
          "Free preview tools: list_agents, get_agent, search_merchants. Paid actions (submit_agent, boost_agent) return an x402 payment quote for the HTTP API.",
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
      try {
        const out = await tool.handler(params?.arguments ?? {});
        return rpcResult(id, out);
      } catch (e) {
        return rpcResult(id, {
          content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
          isError: true,
        });
      }
    }
    case "resources/list":
      return rpcResult(id, { resources: [] });
    case "prompts/list":
      return rpcResult(id, { prompts: [] });
    default:
      // Notifications (no id) require no response.
      if (id === undefined || id === null) return null;
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  // Some clients probe with GET; advertise the server instead of erroring.
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        name: "usdc-directory",
        transport: "streamable-http",
        protocolVersion: PROTOCOL_VERSION,
        tools: TOOLS.map((t) => t.name),
        docs: `${SITE}/api-docs`,
      }, null, 2),
      { headers: { ...cors, "content-type": "application/json" } },
    );
  }

  if (req.method === "DELETE") return new Response(null, { status: 204, headers: cors });

  if (req.method !== "POST") {
    return new Response(JSON.stringify(rpcError(null, -32600, "Method not allowed")), {
      status: 405,
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify(rpcError(null, -32700, "Parse error")), {
      status: 400,
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = (await Promise.all(messages.map(handleRpc))).filter((r) => r !== null);

  if (responses.length === 0) return new Response(null, { status: 202, headers: cors });

  const payload = Array.isArray(body) ? responses : responses[0];
  return new Response(JSON.stringify(payload), {
    headers: {
      ...cors,
      "content-type": "application/json",
      "mcp-session-id": crypto.randomUUID(),
    },
  });
});
