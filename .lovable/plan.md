# Restore the live directory and prevent blank screens

## Confirmed cause

- `https://usdc.directory` returns the page shell, but its app root is empty.
- The published JavaScript throws `supabaseUrl is required` during startup.
- The cloud connection values are present in the current project and the current build passes, but the live site is serving a bundle that was built without them.
- The failure occurs while imported modules are being initialized, before the existing recovery screen can render. That is why visitors see a completely blank page.
- The earlier `AdminGuard` issue is already corrected in the current source and is not the active live-site failure.

## Fix

1. **Make startup failure-safe**
   - Mount a minimal app shell before loading the rest of the application.
   - Load the main application after the recovery boundary is active, so missing configuration, wallet-library failures, or damaged cached bundles show a useful recovery screen instead of an empty page.
   - Remove the unsafe assumption that the page root always exists.

2. **Improve the recovery screen**
   - Replace the extension-only explanation with an accurate general message.
   - Provide a reliable reload action and a clean branded fallback that works without the cloud connection or wallet system.

3. **Add regression coverage**
   - Test normal startup.
   - Simulate a failed application import and confirm the recovery screen appears rather than a blank root.

4. **Verify and restore the live site**
   - Confirm the current cloud connection values are included in the production build without exposing private credentials.
   - Check the homepage and listing page on desktop and mobile.
   - Publish the corrected build, then recheck `usdc.directory` for visible content and startup errors.

## Scope

No directory, listing, payment, wallet, or admin behavior will be redesigned. This change only restores reliable loading and prevents future startup errors from becoming blank screens.
