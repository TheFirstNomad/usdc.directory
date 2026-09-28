# Bring the listings back on usdc.directory

## What I found
- Your listings are safe. The database still holds 1,180 listings, and 1,178 of them are approved for public display. Visitors are allowed to read them.
- The live site is running a version that was built without the address of your database. It tries to load listings from a placeholder address, fails with "Failed to fetch", and shows an empty directory.
- The preview works because it has the database address. The published version does not.

## Fix
1. Build the public database address and public key (both safe to publish) into the app, so every published version connects to your real database. Nothing will depend on hidden settings anymore.
2. Add a check to the build that fails if it points at a placeholder or any database other than yours, so a broken version can't go live.
3. Publish, then open usdc.directory and confirm the listings appear, with no loading errors, on desktop and mobile.

No listing data is changed, re-imported or deleted.

## Technical details
- Live bundle logs `VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is missing` and requests `placeholder.supabase.co` (ERR_NAME_NOT_RESOLVED).
- In `vite.config.ts`, add `define` fallbacks for `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` using project ref `ddhytszijvfejnymrwgd` and its anon key, used only when the env values are missing. The generated client file stays unchanged.
- Add a build-time assertion that the resolved URL contains `ddhytszijvfejnymrwgd`.
- Record the rule in AGENTS.md.
