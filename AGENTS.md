# Architecture Rules

- Load the main application through `AppBootstrap` so module-initialization failures render recovery UI instead of leaving an empty root.
- Vite config hardcodes the public backend URL/publishable key as fallbacks and fails the build if the URL is not project ddhytszijvfejnymrwgd, because .env is not present in published builds.
- Reuse `BrandLogo` and the official Circle USDC artwork for app identity so visible and discovery branding remain consistent.
- Keep agent API prices, payment checks, self-listing and boost in `supabase/functions/_shared/agents-core.ts`, imported by both `agents-api` and `mcp`, so HTTP and MCP can never drift apart.
