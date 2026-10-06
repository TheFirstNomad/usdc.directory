# Circle routing gap + OpenAPI schemas

## Task 1 — usdc.directory/agents (honest finding)

- Lovable hosting has **no Redirects/Rewrites setting** in project settings, and it ignores `_redirects`, `vercel.json`, `netlify.toml`, etc.
- Any path that isn't a real file gets the website (200 HTML). The website itself can't return a 402 status or forward POST bodies/headers, so adding an `/agents` page to the app **cannot** satisfy `curl -i https://usdc.directory/agents` → 402.
- `/ai-agents` and `/admin/agents` were checked and would not collide; nothing will be added to the app's pages, so they stay untouched.

**What will actually work (needs your action, outside Lovable):**
- Option A (recommended): put Cloudflare in front of usdc.directory (free plan) and add a small Cloudflare Worker on the route `usdc.directory/agents*` that forwards method, headers (incl. X-PAYMENT, PAYMENT-SIGNATURE, X-Payment-TxHash, X-Payment-Chain) and body to `https://ddhytszijvfejnymrwgd.supabase.co/functions/v1/agents-api/agents*`, and passes the 402 + PAYMENT-REQUIRED header back. I will write the Worker script and step-by-step clicks in the Cloudflare dashboard (saved to Files) — no code in this app.
- Option B: tell Circle's scorer/intake form to use the Supabase endpoint directly (already returns 402 correctly) and skip domain routing.

So for Task 1 nothing will be "ready to publish" from Lovable; it stays **unresolved** until the Worker is set up.

After the Worker is live, test:
- `curl -i https://usdc.directory/agents` → `HTTP 402` with a `PAYMENT-REQUIRED` header and JSON `accepts[]` (9 networks).
- `curl -i https://usdc.directory/ai-agents` → still 200 HTML (website).

## Task 2 — OpenAPI schemas (in app, ready to publish)

Add `components.schemas` to `public/openapi.json`, matching the agents-api function exactly:
- `Agent` — id, name, description, website, logo_url, categories, region, networks, verified, boosted_until, created_at (search results additionally include wallet_address → `AgentSearchResult`).
- `AgentList` — `{ count, agents: Agent[], paid }` (GET /agents).
- `AgentSearchResponse` — `{ q, count, agents, paid }`.
- `AgentResponse` — `{ agent, paid }` (GET /agents/{id}).
- `SelfListRequest` — required name (≤100), wallet_address (≤256), description (≤300); optional logo_url, website, networks, capabilities.
- `SelfListResponse` — `{ id, name, paid }` (201).
- `BoostResponse` — `{ id, boosted_until, paid }`. Boost takes **no request body** (function reads only the path id), so the spec will state that rather than invent one.
- `Error` — `{ error }`, used for 400/404/409/429/500; 402 documented with PAYMENT-REQUIRED header.

Wire every path's requestBody/responses to these via `$ref`. `servers` left untouched. Re-run tests and JSON validation.

After publishing: open https://usdc.directory/openapi.json and confirm `components.schemas` is present.
