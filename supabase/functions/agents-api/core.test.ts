import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  PUBLIC_HOST, TREASURY, ROUTES, MCP_TOOLS, X402_GATEWAY_CHAINS, MERCHANT_MAX,
  paymentRequirements, paymentRequiredHeader, resourceFor, gatePayment, gatewayClient,
  normalizeWallet, validateSelfList, searchMerchants, type RouteKey,
} from "../_shared/agents-core.ts";

// Minimal chainable mock of the database client.
function mockDb(rows: unknown[] = []) {
  const log: Array<{ table: string; op: string; arg?: unknown }> = [];
  const builder = (table: string) => {
    let limitN = Infinity;
    const b: any = {
      select: () => b, eq: () => b, gte: () => b, contains: () => b, or: () => b, order: () => b,
      limit: (n: number) => { limitN = n; return b; },
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      insert: (arg: unknown) => { log.push({ table, op: "insert", arg }); return Promise.resolve({ error: null }); },
      update: (arg: unknown) => { log.push({ table, op: "update", arg }); return b; },
      delete: () => { log.push({ table, op: "delete" }); return b; },
      then: (res: any) => res({ data: rows.slice(0, limitN), error: null, count: 0 }),
    };
    return b;
  };
  return { from: builder, log };
}

const EXPECTED: Record<RouteKey, string> = {
  list_agents: "10000", search_agents: "10000", get_agent: "10000", search_merchants: "10000",
  self_list: "1000000", boost: "5000000",
};

for (const route of Object.keys(EXPECTED) as RouteKey[]) {
  Deno.test(`unpaid ${route} returns 402 with correct amount, payTo, host, schemas`, async () => {
    const resource = resourceFor(ROUTES[route].path);
    const g = await gatePayment(mockDb(), { ip: "1.1.1.1" }, route, resource, ROUTES[route].path);
    assertEquals(g.ok, false);
    if (g.ok) return;
    assertEquals(g.status, 402);
    for (const a of g.body.accepts) {
      assertEquals(a.amount, EXPECTED[route]);
      assertEquals(a.payTo, TREASURY);
      assertEquals(a.scheme, "exact");
      assert(a.resource.startsWith(PUBLIC_HOST));
      assert(a.outputSchema.input && a.outputSchema.output);
    }
    assertEquals(g.body.accepts.length, X402_GATEWAY_CHAINS.length);
    const header = JSON.parse(atob(paymentRequiredHeader(g.body)));
    assertEquals(header.x402Version, 2);
  });
}

Deno.test("treasury is the configured payout wallet", () => {
  assertEquals(TREASURY, "0x13fa78ab20762c8f49b58d44dbc177a2adb94d7c");
});

Deno.test("no raw backend host in requirements", () => {
  const s = JSON.stringify(paymentRequirements("list_agents", resourceFor("/agents")));
  assert(!s.includes("supabase.co"));
});

Deno.test("merchant search caps at 50", async () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({ id: String(i) }));
  const r = await searchMerchants(mockDb(rows), "coffee", "p", { limit: 500 });
  assertEquals(r.status, 200);
  assertEquals(r.body.count, MERCHANT_MAX);
});

Deno.test("wallet validation per chain format", () => {
  assertEquals(normalizeWallet("0xABCDEFabcdef0123456789abcdef0123456789AB"), "0xabcdefabcdef0123456789abcdef0123456789ab");
  assertEquals(normalizeWallet("4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be"), "4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be");
  const sui = "0xa15979dcd7429463cdf01aae184cb32e33fcf15d3e46067238ccc384115f9979";
  assertEquals(normalizeWallet(sui), sui);
  assertEquals(normalizeWallet("alice.near"), "alice.near");
  assertEquals(normalizeWallet("b63a64053204d89290b73e3dbdce660a2f29d211cd1c400f4a499ac165f98171"), "b63a64053204d89290b73e3dbdce660a2f29d211cd1c400f4a499ac165f98171");
  assertEquals(normalizeWallet("not a wallet!"), null);
  assertEquals(normalizeWallet("0x123"), null);
  assertEquals(validateSelfList({ name: "A", wallet_address: "bad!", description: "d" }).ok, false);
});

Deno.test("MCP lists six tools with prices", () => {
  assertEquals(MCP_TOOLS.map((t) => t.name), ["list_agents", "search_agents", "get_agent", "search_merchants", "submit_agent", "boost_agent"]);
  for (const t of MCP_TOOLS) assert(/USDC/.test(t.description));
});

Deno.test("mocked Gateway-paid call succeeds and records payment", async () => {
  const calls: string[] = [];
  const orig = gatewayClient.post;
  gatewayClient.post = (path: string) => {
    calls.push(path);
    return Promise.resolve(path.endsWith("verify") ? { isValid: true, payer: "0xpayer" } : { success: true, transaction: "0xtx" });
  };
  try {
    const db = mockDb();
    const payload = {
      x402Version: 2,
      accepted: { network: "eip155:8453" },
      payload: { signature: "0xsig", authorization: { from: "0xpayer", to: TREASURY, value: "10000", validAfter: "0", validBefore: "9999999999", nonce: "0xabc" } },
    };
    const g = await gatePayment(db, { xPayment: btoa(JSON.stringify(payload)) }, "list_agents", resourceFor("/agents"), "/agents");
    assertEquals(g.ok, true);
    assertEquals(calls, ["/v1/x402/verify", "/v1/x402/settle"]);
    assert(db.log.some((l) => l.table === "agent_api_payments" && l.op === "insert"));
  } finally { gatewayClient.post = orig; }
});

Deno.test("Gateway payment below route price is rejected without calling Gateway", async () => {
  let called = false;
  const orig = gatewayClient.post;
  gatewayClient.post = () => { called = true; return Promise.resolve({ isValid: true }); };
  try {
    const payload = { x402Version: 2, accepted: { network: "eip155:8453" }, payload: { signature: "0x", authorization: { from: "0xp", to: TREASURY, value: "10000", validAfter: "0", validBefore: "9999999999", nonce: "0x1" } } };
    const g = await gatePayment(mockDb(), { xPayment: btoa(JSON.stringify(payload)) }, "self_list", resourceFor("/agents"), "/agents");
    assertEquals(g.ok, false);
    assertEquals(called, false);
  } finally { gatewayClient.post = orig; }
});

Deno.test("Gateway verify failure serves nothing", async () => {
  const orig = gatewayClient.post;
  gatewayClient.post = () => Promise.resolve({ isValid: false, invalidReason: "invalid_signature" });
  try {
    const db = mockDb();
    const payload = { x402Version: 2, accepted: { network: "eip155:8453" }, payload: { signature: "0x", authorization: { from: "0xp", to: TREASURY, value: "10000", validAfter: "0", validBefore: "9999999999", nonce: "0x2" } } };
    const g = await gatePayment(db, { xPayment: btoa(JSON.stringify(payload)) }, "list_agents", resourceFor("/agents"), "/agents");
    assertEquals(g.ok, false);
    assertEquals(db.log.length, 0);
  } finally { gatewayClient.post = orig; }
});
