# Wallet warning + empty Admin list: root cause and fix

## What is really happening
Both screenshots are one problem, not two:

1. MetaMask (with its Blockaid safety checker) has put the whole `usdc.directory` domain on its "malicious site" list. That is why you see "Continue at your own risk" when connecting, and "Malicious site" when the admin page asks you to sign.
2. The Admin page needs one signature from the owner wallet before it can load listings. MetaMask blocks that signature behind the warning, so it never reaches the app. The backend admin sign-in has no requests logged at all, which confirms no signature got through.
3. Because the signature never arrives, the page stays stuck showing "0 total listings" and an empty grey box (the area your arrow points at). Your 1,180 listings are not gone; the page just never got permission to load them.

The code itself asks for nothing dangerous: no token approvals, no unlimited spending, just a plain text message. The flag is on the domain, not caused by a bug in the app.

## Fix plan
1. **Admin page stops looking broken.** When the signature is blocked, cancelled or fails, show a clear card instead of the empty box: "Wallet signature needed to load admin data" with a "Sign in again" button and a short note that a MetaMask warning may be blocking it. Apply the same to Payments, Featured and AI Agents admin pages.
2. **Clearer signature message.** Change the text you sign to plainly say it is a sign-in only, cannot move funds, and shows the site name, e.g. "usdc.directory admin sign-in. This does not authorize any transaction or spending." Update the backend check to match.
3. **Getting the flag removed (only you can submit these).** Re-use the ready reports already prepared for Blockaid, MetaMask's phishing list and Google Safe Browsing. Until they are reviewed you can tick "I have acknowledged the risk" to use the admin page.

## Technical details
- `src/lib/adminAuth.ts`: new message text; distinguish user-rejected vs. other errors.
- `supabase/functions/_shared/admin-auth.ts` / `admin-session`: accept the new message format; redeploy.
- `AdminListings`, `AdminPayments`, `AdminFeatured`, `AdminAgents`: add `authError` state and a retry card instead of the skeleton/empty state.
- Update `admin-session.test.ts` for the new message.
