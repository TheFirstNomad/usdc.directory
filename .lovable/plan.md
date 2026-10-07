# Circle Marketplace readiness pass

## The one item Lovable cannot do: "api.usdc.directory"
Lovable custom domains only serve the website. They cannot forward requests to the backend API or return a 402 status, so `api.usdc.directory` (or `usdc.directory/agents`) can't host the paid API from inside Lovable. That needs an outside proxy service, which you said you don't want.

Decision in this plan: keep the backend address as the one official API host everywhere, and make every document agree on it. Circle's scorer already accepts it (95/100, the gap is unrelated to the host). This item is reported as unresolved, not faked.

## What gets fixed
1. **Challenge check** — capture a real unpaid `GET /agents` 402 and compare it with Circle's seller format (scheme exact, CAIP-2 network, real USDC contract, 6-decimal amount, payTo, maxTimeoutSeconds, resource URL). Fix any mismatch in the agents API.
2. **Network audit** — confirm every CAIP-2 id and USDC address against official sources. Gasless (Gateway) list limited to chains Circle Gateway actually supports; Arc, BNB, Linea, Monad, Solana, Sui, Near stay on pay-then-send-tx-hash. Confirm Monad's chain id before keeping it. Treasuries unchanged.
3. **Manifests agree** — llms.txt, agents.json, x402, openapi.json, API docs page: same host, same prices (GET 0.01, self-list 1, boost 5 / 30 days, business 3), same wallets, x402 resource URLs equal to OpenAPI `servers`.
4. **MCP** — add `/.well-known/mcp.json` (streamable HTTP). Make sure tools cover list, search, get, self-list, and that unpaid paid-tool calls return the payment challenge, not an error. If that can't be made reliable, remove MCP claims instead.
5. **Copy** — README and site: remove the "businesses list for 1 USDC" line; fees match everywhere.
6. **Marketplace blurb** — add a short seller blurb (category INFRASTRUCTURE, "pay-per-call directory of USDC-accepting AI agents; 0.01 USDC to query, 1 USDC to self-list"), linking OpenAPI and the endpoint. No claim that the merchant catalog is on the paid API.
7. **Verify with real calls** — live HTTP checks on the 402, paid MCP call, manifests; add tests that fail if prices or wallets drift between documents.

## For you at the end
Exact endpoint URL, OpenAPI URL, and payout wallet to paste into Circle's form (I won't submit it). Then you press Publish.

## Technical details
- Files: `supabase/functions/agents-api/index.ts`, `supabase/functions/mcp/index.ts`, `public/{llms.txt,openapi.json}`, `public/.well-known/{x402,agents.json,ai-plugin.json,mcp.json}`, `src/pages/ApiDocs.tsx`, `README.md`, new consistency test in `src/test/`.
- Backend functions redeployed after edits; MCP verified via JSON-RPC `tools/call` without payment.
