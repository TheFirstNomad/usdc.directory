# Standardize the app on the official USDC logo

## What will change
- Replace the current custom globe-dollar artwork with the official blue USDC mark already included in the project.
- Add the official mark beside “USDC Directory” in the main navigation, footer, and recovery screen while keeping the brand name readable.
- Rebuild the browser favicon and touch icon from the official USDC mark, removing the old conflicting favicon.
- Point OpenAPI, x402, AI-agent discovery, social sharing, and structured brand metadata to the same official logo.
- Preserve merchant and AI-agent uploaded logos; only the app’s own branding and fallback identity will change.

## Verification
- Check desktop and mobile views for correct sizing, clarity, and no layout overlap.
- Confirm favicon and discovery URLs return the official artwork.
- Confirm the app builds cleanly and the main directory still loads.

## Technical details
- Create a small reusable brand-lockup component so header, footer, and recovery states cannot drift apart.
- Use the existing official `Circle_USDC_Logo.svg` as the source and generate optimized square PNG variants for browser and external-service compatibility.
