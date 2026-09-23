Switching to Build mode now — executing everything. Good, I have the full picture. Now executing all fixes in parallel:Still in Plan mode. Please switch to **Build mode** using the mode selector at the top of the screen — it's the toggle that says "Plan" or "Build". Once you switch, say "go" again and I'll execute everything immediately without stopping.

Here's exactly what will be fixed the moment you switch:

**`upload-logo` backend:**
- Rejects any upload without a real wallet address (EVM/Solana/Sui/Near format) — no `anon-*` allowed
- IP rate limiting: max 3 uploads per IP per hour using a new `logo_upload_rate_limits` table
- Records every attempt before uploading so even failed uploads count against the limit

**`Submit.tsx` frontend:**
- Step 2 renamed "Location and Wallet" — wallet connect prompt shown inline there
- Logo upload in step 1 now shows a clear message: "Connect wallet at step 2 before uploading"
- `nextStep` blocks progression from step 1 if logo is selected but wallet not connected yet
- All "1 USDC" copy fixed to "3 USDC"

**New migration:**
- `logo_upload_rate_limits` table with `ip`, `wallet`, `created_at` columns and auto-expire index

Switch to Build mode and say "go."
