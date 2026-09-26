# Fix blank screen on preview and usdc.directory

## Cause (confirmed from logs)
The main app file uses the admin page guard (`AdminGuard`) on the four admin pages, but the line that loads it was dropped during the last edit (swap removal). When the app starts, the browser hits "AdminGuard is not defined" and nothing renders.

## Fix
1. Add back the missing import of `AdminGuard` in `src/App.tsx`.
2. Confirm the build is clean and load `/`, `/submit`, `/ai-agents` and an `/admin/...` page in the browser to make sure everything renders.
3. Also fix the small type error in the `og-agent` backend function (`new Response(png)`) so backend deploys stay clean.
4. Remind the user to click Publish so usdc.directory gets the fix.
