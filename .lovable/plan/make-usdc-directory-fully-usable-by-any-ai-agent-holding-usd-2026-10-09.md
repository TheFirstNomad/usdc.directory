# Make usdc.directory fully usable by any AI agent holding USDC

Scope is exactly the uploaded spec. Treasury addresses and the 3 USDC business listing flow stay unchanged.

## A. Payments (agent API)
- One constant `PUBLIC_HOST = "https://api.usdc.directory"`. Every x402 resource URL is built from it, whether or not the proxy header is present. The raw backend URL won't appear anywhere.
- Gasless payments (`GatewayWalletBatched`): check and settle `X-PAYMENT` through Circle Gateway's seller verify/settle API, following Circle's Gateway Nanopayments docs. No data is returned and no rows are written until Gateway confirms the payment. The existing nonce replay protection stays.
- The direct EIP-3009 path stays only where it works today, and the `X-Payment-TxHash` + `X-Payment-Chain` fallback stays. Every path checks the amount quoted for the route being called, and any hardcoded 1 USDC check gets fixed.
- Networks: check each of the 9 current Gateway networks against Circle's supported mainnet list. Unsupported ones come out of `X402_GATEWAY_CHAINS` and every public file, with a comment saying they can return later. Arc, BNB, Linea, Monad, Solana, Sui and Near are on-chain fallback only.
- Every 402 keeps the base64 `PAYMENT-REQUIRED` header. Each accepts entry has scheme `exact`, the real USDC asset, the atomic amount, payTo `0x13FA…D7c` and a `PUBLIC_HOST` resource. It also adds input/output JSON schemas in x402 Bazaar format.

## B. HTTP routes
- Keep the 5 routes. HEAD behaves like GET.
- New `GET /merchants/search?q=` at 0.01 USDC, max 50 results, with the same payment gate.
- CORS allows `X-PAYMENT`, `X-Payment-TxHash` and `X-Payment-Chain`, and exposes `PAYMENT-REQUIRED` and `PAYMENT-RESPONSE`. HEAD is added to allowed methods.
- POST /agents: only EVM addresses get lowercased. Format checks: EVM, Solana base58 32–44, Sui 0x+64 hex, Near 64 hex or `*.near`. Bad addresses get a 400.

## C. MCP
- `initialize` and `tools/list` stay free. All free previews are removed.
- Six tools, with prices in their descriptions: list_agents, search_agents, get_agent, search_merchants (0.01 each), submit_agent (1), boost_agent (5).
- An unpaid `tools/call` returns JSON-RPC error 402 with the same payment requirements as HTTP. Payment is accepted on retry via `params._meta["x402/payment"]` or an `X-PAYMENT` header, and a paid retry runs the tool.
- Payment checks, self-listing and boost move into a shared module that both functions import, so the logic isn't duplicated.

## D. Manifests and docs
- `mcp.json`: lists all six tools with prices, and the free-preview text is removed.
- `x402` and `openapi.json`: add `/merchants/search`, servers set to `PUBLIC_HOST`, and only the kept networks.
- `agents.json`: matching prices, MCP URL and the 5 capabilities.
- `README.md`: updated prices. `llms.txt`: replaced with the spec's template, with networks filled in from the final code.
- Boost duration stays as it is in code (30 days) and the docs say the same.

## E. Tests and deploy
- Add the `@testing-library/dom` dev dependency so the startup test runs.
- New tests:
  - each paid route returns 402 with the right amount, payTo, host and schemas
  - merchants search is capped at 50
  - wallet format checks
  - MCP lists six tools
  - a mocked Gateway-paid call returns data
  - no public file contains "supabase.co" or "free preview"
- Deploy both functions, then run real live curls: unpaid `/agents` and `/merchants/search` return 402, and MCP `tools/list` returns 6 tools.
- You publish the site.

## Will report as unverified
- A real mainnet Gateway payment (only mocked).
- Any networks removed, listed by name.
