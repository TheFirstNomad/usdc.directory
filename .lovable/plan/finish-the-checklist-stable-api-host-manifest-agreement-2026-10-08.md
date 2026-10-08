# Finish the checklist: stable API host + manifest agreement

## Where the build stands right now (verified live)

**Working:**
- `https://usdc.directory/` — website live (200)
- `https://api.usdc.directory/agents` — 402 with the official `PAYMENT-REQUIRED` header, 9 Gateway networks, treasury `0x13FA...D7c`
- `https://usdc.directory/openapi.json` — 200, all schemas present
- Website can never serve the API at `usdc.directory/agents` (it serves the site HTML) — that is expected; the canonical API host is `api.usdc.directory`

**Not done yet (gaps against the checklist):**
1. `openapi.json` `servers` still points at the raw backend URL — must be `https://api.usdc.directory`
2. `llms.txt` still advertises the raw backend URL (line 22)
3. `.well-known/x402` has 46 raw backend URL references, 0 stable-host references
4. `.well-known/agents.json` MCP URL is the raw backend URL
5. `/.well-known/mcp.json` does not exist (404)
6. The 402 challenge itself advertises resource URLs on the raw backend host (the API function builds the resource URL from its own host, and the proxy doesn't pass the public host through)
7. `api.usdc.directory/mcp` returns 404 — the proxy only forwards `/agents*`, so MCP can't be reached on the stable host yet
8. `HEAD /agents` returns 404 (only GET/POST handled)
9. README still says businesses self-list at 1 USDC (business fee is 3 USDC)

## Changes

### 1. Agent API function (`supabase/functions/agents-api/index.ts`)
- Build the 402 resource URL from the public origin: prefer the `x-forwarded-host` header the proxy forwards (falling back to current behavior) so challenges advertise `https://api.usdc.directory/...`
- Handle `HEAD` the same as `GET` (402 challenge instead of 404)
- Deploy the updated function

### 2. Proxy Worker — updated script for you to paste in Cloudflare
- Keep the `/agents*` forwarding exactly as it works today
- Add forwarding for `/mcp` → the MCP function so `https://api.usdc.directory/mcp` works
- Pass the original host through so the 402 resource URLs show the stable host
- I will give you the full replacement code and exact clicks (Edit code → paste → Deploy)

### 3. Discovery files (in the app, ready to publish)
- `public/openapi.json`: `servers[0].url` → `https://api.usdc.directory` (schemas untouched)
- `public/llms.txt`: base URL → `https://api.usdc.directory`
- `public/.well-known/x402`: replace all 46 raw backend URLs with `https://api.usdc.directory` equivalents
- `public/.well-known/agents.json`: MCP URL → `https://api.usdc.directory/mcp`
- New `public/.well-known/mcp.json`: valid streamable-HTTP MCP descriptor pointing at `https://api.usdc.directory/mcp`

### 4. Copy + intake metadata
- README: businesses 3 USDC, agents 1 USDC, queries 0.01 USDC, boost 5 USDC
- Add a short "Circle intake" note (also saved to Files): endpoint `https://api.usdc.directory/agents`, OpenAPI `https://usdc.directory/openapi.json`, payout wallet `0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c`, category INFRASTRUCTURE, seller blurb: "Pay-per-call directory of USDC-accepting AI agents; 0.01 USDC to query, 1 USDC to self-list."

## Not doing
- Not submitting the Circle form or the DoraHacks form (yours to do)
- Not changing treasury addresses or fees

## Done when (verified with real curl, not just tests)
- Unpaid `GET https://api.usdc.directory/agents` → 402, `PAYMENT-REQUIRED` header parses, resource URL = `https://api.usdc.directory/agents`
- `GET https://api.usdc.directory/mcp` → server descriptor (200), not 404
- `openapi.json` servers = stable host; llms.txt, agents.json, x402 manifest, mcp.json all use the stable host
- Zero raw backend URLs in public agent-facing docs
- You publish, I re-run the live checks, then you rerun the Circle score at agents.circle.com/sell/score
