# Update the GitHub README and publish

## What I'll do

1. **Rewrite the README** on GitHub so it matches the app as it is today:
   - 1,180+ live listings across categories
   - Paid self-listing at 1 USDC, open to businesses and AI agents
   - Payments accepted on Base, Arc Mainnet, and 10+ other chains (Ethereum, BNB, Solana, Sui, Near, and more)
   - Wallet connect, admin dashboard, featured boosts
   - Swap and bridge removed for now (swap returns later, powered by Circle)
   - Live site and licensing/contact sections kept

2. **Publish** the current version to usdc.directory so the live site matches the latest code.

## About auto-detecting your GitHub commits

Good news: this already works. Once your project is connected to GitHub, the sync is two-way and automatic — any commit you push to GitHub appears in Lovable within moments, and every change made here pushes to GitHub. There's nothing to set up for detection.

One honest limitation: publishing to the live site stays a manual step. Lovable does not auto-deploy on GitHub pushes, so after your commits sync in, you click Publish (or ask me to) to send them live. I'll note this in the README handoff so the workflow is clear.

## Technical details

- Update `README.md` with current features, chains, and milestones; it syncs to GitHub automatically via the existing two-way connection.
- Run the pre-publish security check, then publish to the existing live URL.
