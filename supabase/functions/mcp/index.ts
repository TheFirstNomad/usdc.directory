// MCP server (Model Context Protocol) — Streamable HTTP transport.
// Exposes USDC Directory tools to Claude Desktop, Cursor, Continue, GPT, etc.
//
// Tools:
//   list_agents     – list AI agents in the directory (free preview, 10 max)
//   get_agent       – fetch one agent by id (free preview)
//   search_merchants – search USDC-accepting merchants
//   submit_agent    – returns instructions + 402 quote (agents must pay via /agents-api)
//   boost_agent     – returns instructions + 402 quote
//
// The free preview tools serve cached public data so any agent can discover
// the directory before paying. Paid actions point the caller at the x402
// endpoint with a clear quote.

import { Hono } from "https://esm.sh/hono@4.6.14";
import { McpServer, StreamableHttpTransport } from "https://esm.sh/mcp-lite@0.10.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const API_BASE = `https://${Deno.env.get("SUPABASE_URL")?.replace(/^https?:\/\//, "")}/functions/v1/agents-api`;
const SITE = "https://usdc.directory";

const mcp = new McpServer({
  name: "usdc-directory",
  version: "1.0.0",
  description:
    "USDC Directory — discover merchants and AI agents that accept USDC. Pay-per-call agent API via x402 on Base + Arc.",
});

mcp.tool({
  name: "list_agents",
  description: "List AI agents in the USDC Directory (free preview, max 20). For full + paid programmatic access use GET /agents-api/agents with x402.",
  inputSchema: {
    type: "object",
    properties: { limit: { type: "number", description: "1-20", default: 10 } },
  },
  handler: async (args: { limit?: number }) => {
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 20);
    const { data } = await supabase
      .from("partners_public")
      .select("id, name, description, website, categories, boosted_until, verified")
      .contains("categories", ["AI Agents"])
      .order("boosted_until", { ascending: false, nullsFirst: false })
      .limit(limit);
    return { content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, agents: data ?? [] }, null, 2) }] };
  },
});

mcp.tool({
  name: "get_agent",
  description: "Fetch one agent by UUID.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string" } },
    required: ["id"],
  },
  handler: async (args: { id: string }) => {
    const { data } = await supabase
      .from("partners_public")
      .select("*")
      .eq("id", args.id)
      .maybeSingle();
    return { content: [{ type: "text", text: data ? JSON.stringify(data, null, 2) : "not found" }] };
  },
});

mcp.tool({
  name: "search_merchants",
  description: "Search USDC-accepting merchants by category or query string.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "free-text match against name/description" },
      category: { type: "string" },
      limit: { type: "number", default: 20 },
    },
  },
  handler: async (args: { query?: string; category?: string; limit?: number }) => {
    const limit = Math.min(Math.max(Number(args.limit ?? 20) || 20, 1), 50);
    let q = supabase.from("partners_public").select("id, name, description, website, categories, region");
    if (typeof args.category === "string" && args.category.trim()) {
      q = q.contains("categories", [args.category.trim().slice(0, 64)]);
    }
    if (typeof args.query === "string" && args.query.trim()) {
      // Strip PostgREST filter metacharacters so raw input can't inject extra clauses/operators.
      const safe = args.query
        .trim()
        .slice(0, 100)
        .replace(/[,()."'\\*%:]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (safe) {
        q = q.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);
      }
    }
    const { data } = await q.limit(limit);

    return { content: [{ type: "text", text: JSON.stringify({ count: data?.length ?? 0, results: data ?? [] }, null, 2) }] };
  },
});

mcp.tool({
  name: "submit_agent",
  description: "Get instructions to self-list an AI agent. Costs 1 USDC via x402. Returns the POST endpoint + payment quote.",
  inputSchema: { type: "object", properties: {} },
  handler: async () => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          action: "POST",
          endpoint: `${API_BASE}/agents`,
          price: { amount_usdc: "1.000", asset: "USDC", networks: ["base", "arc"] },
          treasury: "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c",
          body_schema: { name: "string", wallet_address: "0x...", description: "string<=300", logo_url: "https?://... (optional)" },
          payment_methods: [
            "x402 header (EIP-3009 transferWithAuthorization, settled on-chain)",
            "On-chain prepaid: send USDC to treasury, then POST with X-Payment-TxHash + X-Payment-Chain",
          ],
          docs: `${SITE}/api-docs`,
        }, null, 2),
      }],
    };
  },
});

mcp.tool({
  name: "boost_agent",
  description: "Get instructions to boost an agent listing (30-day featured slot). Costs 5 USDC via x402.",
  inputSchema: {
    type: "object",
    properties: { id: { type: "string", description: "agent UUID" } },
    required: ["id"],
  },
  handler: async (args: { id: string }) => {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          action: "POST",
          endpoint: `${API_BASE}/agents/${args.id}/boost`,
          price: { amount_usdc: "5.000", asset: "USDC" },
          treasury: "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c",
          docs: `${SITE}/api-docs`,
        }, null, 2),
      }],
    };
  },
});

const transport = new StreamableHttpTransport();
const app = new Hono();

// CORS for browser-based MCP clients
app.use("*", async (c, next) => {
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Headers", "content-type, authorization, mcp-session-id");
  c.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  c.header("Access-Control-Expose-Headers", "mcp-session-id");
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

app.all("/*", async (c) => await transport.handleRequest(c.req.raw, mcp));

Deno.serve(app.fetch);
