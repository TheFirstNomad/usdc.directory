# Stop the repeating admin wallet signature popups

## Why it keeps happening

1. **The Payments page refreshes itself every 30 seconds.** Every refresh asks MetaMask for a new signature, so while the page stays open the requests pile up. Your screenshot shows "1 of 4", which is about two minutes of the page being open.
2. **Every admin action needs a brand-new signature by design.** The backend accepts each signature only once and only for 5 minutes. Opening a page, refreshing, deleting, featuring or editing a listing, or moving between Payments, Listings, Agents and Featured each triggers another popup.

The last fix only stopped duplicate requests when a page first loads. It missed the 30-second timer and the one-signature-per-request rule.

## The fix: sign once per session

- When you open any admin page, MetaMask asks you to sign **once**.
- The backend checks that signature (owner wallet, fresh, never used before) and gives back a short-lived admin pass that lasts 8 hours.
- Every admin page, the automatic refresh, and all actions (delete, feature, edit, approve) use that pass with no more popups.
- The pass is kept only in this browser tab. It is cleared when you disconnect, switch to a different wallet, or close the tab. After 8 hours you sign once more.
- If two pages ask at the same moment, they share one signature request instead of stacking.
- The 30-second auto refresh stays, but it uses the pass and never opens MetaMask. If there is no valid pass, it skips that refresh quietly instead of asking you to sign.

Security stays the same: only the owner wallet can get a pass, the pass is cryptographically signed by the backend so it can't be forged or edited, and it expires automatically.

## Technical details

- New backend secret `ADMIN_SESSION_SECRET`, generated automatically and never shown to anyone.
- `_shared/admin-auth.ts`:
  - `issueAdminSession(req)` runs the existing signature + nonce check, then returns an HMAC-SHA256 token `base64url(payload).sig` with `{ addr, exp: now + 8h }`.
  - `verifyAdmin(req)` accepts `Authorization: Bearer <admin token>` in an `x-admin-session` header (constant-time HMAC compare, expiry, addr === OWNER_WALLET). It still falls back to the existing one-shot signature headers for compatibility.
- New edge function `admin-session` (POST): signature in, token out. Add `x-admin-session` to CORS allow-headers in all four admin functions, then redeploy all five.
- `src/lib/adminAuth.ts`:
  - `getAdminAuthHeaders(address, signMessage, { interactive })` reads the token from sessionStorage, keyed by the lowercased address and only while unexpired. Otherwise it reuses a single module-level in-flight promise, signs once, calls `admin-session`, and stores the token.
  - With `interactive: false` (the auto refresh), it throws instead of signing.
  - `clearAdminAuth()` deletes the stored token. It is called on disconnect or account change, and on any 401 so the next user action re-signs once.
- `AdminPayments.tsx`: the 30-second interval calls the fetch in non-interactive mode. Other admin pages need no structural change because they all go through `getAdminAuthHeaders`.
- Add a small test for the token rules: a valid token is accepted, and expired, tampered and wrong-wallet tokens are rejected.
- Verify after deploy by checking the `admin-session` endpoint, and confirm that admin functions reject a request with no token.
