# Make the official USDC logo visible everywhere today

## What will change
- Keep the new multi-size `/favicon.ico` as the primary browser and marketplace icon, with the official USDC SVG and PNG icons as fallbacks.
- Add a release version to browser, social-sharing, PWA, OpenAPI, x402, and agent-discovery logo URLs so services fetch the new artwork instead of an older cached Lovable icon.
- Extend the automated branding checks to cover the ICO file and every public discovery document, preventing future releases from restoring or referencing the Lovable logo.
- Publish the completed release today so the production domain serves the official mark at every standard icon URL.

## Verification
- Confirm the production domain returns the official USDC artwork from `/favicon.ico`, `/favicon.svg`, `/usdc-logo.png`, Apple touch, and PWA icon URLs.
- Check the live site on desktop and mobile, including the browser tab and install metadata.
- Re-run the Circle score after publishing and inspect the icon sources Circle uses.
- Confirm all automated tests pass and the latest build is clean before publishing.

## Same-day expectation
- The site and all direct logo URLs will update as soon as the deployment completes.
- Circle, Google, or DuckDuckGo may retain an older cached icon temporarily. The versioned metadata and direct `/favicon.ico` provide the strongest immediate refresh signal, but third-party cache timing cannot be guaranteed.

## Technical details
- Use one explicit brand asset version consistently across HTML metadata and machine-readable discovery files.
- Preserve merchant and AI-agent uploaded logos; only USDC Directory's own identity changes.
- Do not alter payments, listings, networks, pricing, or API behavior.
