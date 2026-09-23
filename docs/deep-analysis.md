# USDC Directory — Deep Analysis Report
*Generated: September 2026*

---

## Executive Summary

The codebase is genuinely well-structured and battle-hardened. The routing, lazy-loading, React Query caching, payment verification, and multi-chain architecture are all solid. The gaps are in trust signals, UX friction, data completeness, the swap experience, and the listing ownership model. A smart contract is NOT required for listings — but it would unlock a trust tier that Supabase alone cannot provide.

---

## 1. Architecture Overview

| Layer | Technology | Assessment |
|---|---|---|
| Frontend | Vite + React 18 + TypeScript | Good. Lazy-loaded routes, HMR, proper code splitting |
| State | React Query (TanStack) | Good. `staleTime` / `gcTime` configured, 5-min cache |
| Web3 | Reown AppKit + wagmi v2 + viem | Good. Two chains (Base 8453, Arc 5042) wired cleanly |
| Payments | Direct USDC transfer + Circle App Kit | Good. Two-path (wagmi direct + paste-tx-hash) is smart |
| Backend | Supabase (Postgres + Edge Functions) | Good. Verification, storage, RPC, public view |
| Identity | Wallet address linked to listing row | Works but fragile (no signature, no claim proof) |
| Swap | Uniswap V3 (Base) + Circle App Kit (Arc) | Functional but has quote/UX issues |
| SEO | react-helmet-async + sitemap gen (1188 URLs) | Strong. Sitemap auto-generates from Supabase |

---

## 2. Listings Architecture — Should It Use a Smart Contract?

### Current model (Supabase + on-chain payment verification)
- User pays 1 USDC to treasury on any chain
- Backend (`submit-listing` edge function) verifies the on-chain Transfer event
- Listing inserted into Postgres (`partners` table, exposed via `partners_public` view)
- Ownership tracked by `wallet_address` column in Supabase

### What this model does well
- Fast to iterate, cheap to run, no gas cost for reads
- Multi-chain payment (13 chains including Solana, Sui, Near) — impossible with a single EVM contract
- Instant listing on payment confirmation
- Admin moderation remains possible

### What this model cannot do (the smart contract gap)
- **Tamper-proof proof of listing**: anyone can verify the listing onchain without trusting your Supabase instance
- **Composability**: other contracts/agents cannot read the directory registry onchain
- **Trustless ownership transfer**: no way to sell or transfer a listing without trusting the backend
- **Rug protection**: if Supabase goes down or the team changes policy, listings are gone
- **On-chain reputation**: USDC Score, verification tier, boost status cannot be read by other protocols

### Verdict on smart contract for listings
**You do NOT need to replace the current model.** It is the right choice for a 13-chain multi-ecosystem directory. However, you should ADD a thin "anchor" contract on Arc (or Base) that:

1. Stores a `keccak256(listingId)` → `wallet_address` mapping (proof of ownership)
2. Emits `ListingRegistered(bytes32 id, address owner, uint256 timestamp)` events (permanent, indexed, queryable)
3. Acts as the treasury receiver for EVM payments (replaces the EOA treasury address)

This gives you the trust story ("your listing is anchored onchain") without breaking multi-chain payments. The Supabase layer stays as the read-optimized cache. Cost: ~20k gas per registration (~$0.0005 on Base/Arc). This is the world-class upgrade path.

---

## 3. Bug Report

### Critical
| # | File | Issue |
|---|---|---|
| C1 | `src/lib/arcAppKit.ts:134` | `eth_requestAccounts` is called on EVERY swap/payment, even when wallet is already connected. Forces repeated wallet popups. |
| C2 | `src/components/ArcPaymentPanel.tsx:102` | `activeChainId` is hardcoded to Base if not Arc, regardless of the user's selected chain. Users on Arc who need to pay on Base get misrouted. |
| C3 | `src/pages/EditListing.tsx:69` | `is_listing_owner` RPC relies on `wallet_address` column match. If a listing was submitted via external tx hash path (no wallet connected), `wallet_address` is the payer's manually entered address, which may not match the connected wallet — effectively locking the owner out of editing. |
| C4 | `src/lib/swap/useQuote.ts:67-76` | Arc quote uses a hardcoded EURC/USDC rate (0.926/1.08). This rate drifts from the actual Circle App Kit price, causing the "minimum received" calculation to be wrong, which can cause slippage failures on large amounts. |

### Major
| # | File | Issue |
|---|---|---|
| M1 | `src/pages/Swap.tsx:59-61` | `wrongChain` is skipped for Arc, but `useSwap.ts` still calls Circle App Kit which may fail if the user is on a different chain. The skip is inconsistent: the wrong-chain UI warning disappears but the underlying error path survives. |
| M2 | `src/lib/arcAppKit.ts:226-297` | Global `fetch` patch is installed at module load time (import side-effect). It patches `globalThis.fetch` permanently even in SSR/worker contexts and leaks between test runs. Should be lazy-installed inside `swapViaKit`. |
| M3 | `src/pages/Submit.tsx:91-96` | Logo upload requires wallet connection; the error toast says "connect wallet to upload a logo, or skip it for now" but `nextStep()` returns early — the user cannot proceed to the next step even if they want to skip the logo. Should only block if they actually uploaded a file. |
| M4 | `src/lib/swap/useSwap.ts:293-299` | `reset()` does not clear `txHash`. After a successful swap, if the user enters a new amount and then resets, the previous `txHash` persists in state, potentially triggering the success modal on the next swap attempt. |
| M5 | `src/pages/MerchantDetail.tsx:219` | `(partner as any).networks` is cast away from the Partner type. `networks` is already in the `Partner` interface in `lib/partners.ts`. This is a stale type inconsistency that hides a real field. |

### Minor
| # | File | Issue |
|---|---|---|
| m1 | `src/components/ArcPaymentPanel.tsx:390` | ERC-8021 calldata debug panel is shown inline in the payment UI to end users. This is dev tooling and should be hidden behind an env flag or removed from production. |
| m2 | `src/lib/swap/tokens.ts:18-19` | AERO and DEGEN both use `/tokens/eth.png` as their logo. Dedicated logos would improve UX. |
| m3 | `src/pages/SubmitAIAgent.tsx` | Duplicate payment logic copy-pasted from `Submit.tsx`. Both pages independently call `buildBaseUsdcTransferCalldata` and `waitForTransactionReceipt`. Should share a `useUsdcPayment` hook. |
| m4 | `src/lib/arcAppKit.ts:18-23` | `VITE_ARC_KIT_KEY` console error fires on every page load even when the swap feature is not used (the module is eagerly imported). Move this check inside `getAppKit()`. |
| m5 | `src/contexts/ChainContext.tsx` | Not read — state not verified, but the context exists and drives both Header's ChainDropdown and Swap's chain selector. A chain change in the dropdown does not update the swap's default token pair, only the global ID. This creates a subtle desync. |
| m6 | `src/pages/MapView.tsx` | Region coords map uses `"Latin America"`, `"Asia Pacific"`, `"Middle East"`, `"Emerging Markets"` as region keys, but `lib/partners.ts:REGIONS` defines `"South America"`, `"Asia"`, and `"Other"`. Regions never match — the map always shows zero pins for real data. |
| m7 | `supabase/functions/submit-listing/index.ts:87` | Monad payments are accepted in the UI but the backend returns an error for them. The frontend shows Monad as a payment option with no warning that verification will fail. |

---

## 4. What to Improve (not new features — existing code)

### Swap Page
1. **Arc quote accuracy**: Replace the hardcoded EURC/USDC rate with a live Circle App Kit `estimateSwap` call so the displayed rate matches what will actually execute.
2. **Wrong-chain UX consistency**: Either fully skip the wrong-chain guard for Arc (since App Kit handles it) or properly surface a chain switch prompt — not both half-baked.
3. **Token logos**: Add dedicated AERO and DEGEN logo files to `/public/tokens/`.
4. **Quote freshness**: The 15-second refetch interval on `useQuote` is shown with a `QuoteTimer` but the timer doesn't visually warn when the quote is stale/expired before a swap fires.
5. **Fiat prices hardcoded**: `FIAT_PRICES` in `Swap.tsx` (ETH: 3450, cbBTC: 96500) are compile-time constants. They will drift. Replace with a single lightweight CoinGecko fetch on mount.

### Listings / Submit Flow
6. **Logo upload gating**: The step progression bug (M3) needs fixing so users can proceed without a logo.
7. **Ownership link on Supabase-only path**: The external tx hash path stores `wallet_address` as a free-text field. Add a wallet-signature step ("sign this message to prove ownership") so edits always work.
8. **Duplicate code**: Extract a `useUsdcPayment()` hook used by `Submit.tsx`, `SubmitAIAgent.tsx`, and `EditListing.tsx`.
9. **Region mismatch in MapView**: Align `MapView.tsx` region keys to match `lib/partners.ts:REGIONS` exactly.

### Partner Card / Detail Page
10. **`networks` type cast**: Remove `(partner as any).networks` — it's already in the `Partner` interface.
11. **USDC Score tooltip**: The score (0-100) is displayed with no explanation of what the dimensions are. Users don't know if 72 is good. Add a hover tooltip with the scoring breakdown.
12. **Merchant detail "Pay" CTA**: There is a "Visit Site" button but no "Pay with USDC" action on the merchant detail page, even though `ArcPaymentPanel` and the payment stack exist. This is the most obvious missing connection.

### Backend / Edge Functions
13. **Monad payment gap**: Either remove Monad from the payment chain list or add RPC verification for it. Don't accept a payment you can't verify.
14. **`is_listing_owner` RPC fragility**: Should fall back to checking `wallet_address` case-insensitively and also match against any EVM address variant (mixed case, checksum).
15. **`submit-listing` rate limiting**: No rate limit on the edge function. A malicious actor could spam listing attempts with fake tx hashes at no cost — add a per-IP or per-wallet rate limit in the edge function.

### UX / Design
16. **No loading states on merchant detail**: There's a skeleton for loading but no error boundary if the Supabase fetch fails — the page goes blank silently.
17. **Admin routes are public**: `/admin/listings`, `/admin/payments` etc. are only protected by the `isOwner` nav guard in the Header. If someone navigates directly to `/admin/payments` they see the page. Server-side or component-level auth check is needed.
18. **`CalldataDebugPanel` in production**: The ERC-8021 calldata panel renders for all users on Base. Wrap in `import.meta.env.DEV` or remove from the payment panel.
19. **`VITE_ARC_KIT_KEY` error on every page**: Eagerly importing `arcAppKit.ts` fires a console error for all users without the env var. Move validation inside the function.
20. **Theme persistence**: `ThemeProvider` sets the class on `document.documentElement` but there's no `localStorage` persistence key — theme resets on refresh. Add `key="theme"` to localStorage.

---

## 5. What to Remove

| Item | Reason |
|---|---|
| `CalldataDebugPanel` (production render) | Dev tooling visible to all users. Hide behind `DEV` flag or move to a separate debug route. |
| `AERO` / `DEGEN` token logos referencing `/tokens/eth.png` | Misleading — shows ETH logo for non-ETH tokens. Remove the tokens or add real logos. |
| Hardcoded `FIAT_PRICES` in `Swap.tsx` | Stale prices within weeks. Replace with live fetch. |
| `Bridge.tsx` references in `findings.txt` | This file mentions `Bridge.tsx` but it was removed per a plan file. Clean up `findings.txt`. |
| `lovable-tagger` dev dependency | `componentTagger()` in `vite.config.ts` is a Lovable IDE plugin — not relevant in Arc Studio or production builds. It's harmless but dead weight. |
| `DeploymentStatus` page | `/deployment-status` appears to be a platform meta-page with no content — verify and remove if unused. |
| `previewAuthStorage.ts` | Supabase preview-environment auth shim — only needed for Lovable preview. Can be replaced with standard auth in production. |
| `.lovable/` directory | All plan and memory files from the Lovable editor — not needed in the repo. |

---

## 6. What to Add (World-Class Upgrades)

### Tier 1 — Highest leverage

**A. Anchor Smart Contract on Base/Arc**
A thin Registry contract that:
- Emits `ListingAnchored(bytes32 indexed listingId, address indexed owner)` on payment
- Stores owner mapping for trustless verification
- Replaces the treasury EOA with a contract address (more trustworthy, auditable)
- Does NOT replace Supabase — is an additional trust layer

**B. Live USDC Stats Ticker**
Real-time strip under the hero: circulating supply, 24h on-chain volume, active chains. Source from CoinGecko `/coins/usd-coin` or Circle's public API. Shows the site is alive and credible.

**C. Merchant "Pay with USDC" button**
On every MerchantDetail page, a prominent "Pay this merchant" CTA that opens a USDC send flow (amount input → wagmi `sendTransaction`). This is the core value prop of the directory — a business's USDC address, not just their website.

**D. World Map (real implementation)**
Replace the SVG pin-map with `react-simple-maps` or a lightweight Mapbox embed. Map merchants by country (not just region) once the `country` field in the submit form is populated. The infrastructure is already there — just needs a real map library.

**E. USDC Score Explanation + Leaderboard**
Add a `/leaderboard` route ranking merchants by `usdc_score` with a clear definition of the 5 scoring dimensions. Add a tooltip on every score display. This is a differentiator — no other directory does USDC-specific scoring.

### Tier 2 — Strong additions

**F. `useUsdcPayment()` shared hook**
Refactor payment logic out of `Submit.tsx`, `SubmitAIAgent.tsx`, and `EditListing.tsx` into a single reusable hook. Reduces 3x duplicated code to one testable unit.

**G. Wallet-signature ownership proof**
On the external tx-hash path, require the user to `eth_sign` a nonce message before their listing is saved. Stores signature hash so `is_listing_owner` works reliably even for external payers.

**H. Live fiat price feed**
Replace hardcoded `FIAT_PRICES` in `Swap.tsx` with a `useTokenPrices()` hook that calls CoinGecko (or a Supabase edge function proxy) on mount and refreshes every 60 seconds.

**I. ⌘K Global Search**
A `cmdk`-powered command palette (the `cmdk` dependency is already installed) that searches merchants, categories, and AI agents from any page. Expected UX on modern directories.

**J. Merchant social proof / reviews**
A simple 5-star + text review per merchant, stored in Supabase, gated by a valid USDC transaction from the reviewer to the merchant. Prevents fake reviews and turns every payment into a verified review.

**K. Farcaster Frame share**
"Share on Farcaster" button on every merchant card generating a cast URL with the OG image. The `og-agent` Supabase function already exists — extend it for regular merchants.

**L. x402 paid search API (agents)**
The `public/.well-known/x402` file is already in place. Wire the `/api/search` endpoint to charge 0.001 USDC per query via the x402 protocol so AI agents can pay-per-call. The builder code and treasury are already set up.

### Tier 3 — Polish

**M. `localStorage` theme persistence** — one-line fix, theme resets on refresh currently.

**N. Admin route auth guards** — component-level `isOwner` check so direct URL navigation is blocked.

**O. Monad verification** — add Monad RPC to the backend or remove it from the payment options.

**P. Error boundaries on merchant detail** — a `<ErrorBoundary>` wrapping the MerchantDetail fetch so a Supabase failure shows a friendly message instead of a blank page.

**Q. Category count badges** — `CategoryFilter` sidebar already receives `counts` as a prop but does not display them inline. One-line addition per filter item.

**R. "Newest" real-time feed** — a horizontal scroll strip on the homepage showing the last 5 merchants added (already sorted by `created_at` in the query).

---

## 7. The Listing Model — Final Verdict

| Question | Answer |
|---|---|
| Is the current Supabase + payment verification model sound? | Yes. It is pragmatic, multi-chain, and fast. |
| Should it be replaced with a smart contract? | No. Multi-chain (Solana/Sui/Near) payments are impossible from a single EVM contract. |
| Should a smart contract be ADDED? | Yes. A thin anchor registry on Arc/Base adds permanent onchain proof of existence and ownership without breaking anything. |
| Is the current ownership model (wallet address column) sufficient? | No for the long term. It breaks on external payment paths. Add wallet-signature proof. |
| Is 1 USDC the right listing fee? | Reasonable. Consider a tiered model: 1 USDC self-list (unverified), 10 USDC verified (on-chain scored), 5 USDC monthly boost. Fee constants already exist in `web3.ts`. |

---

## 8. Priority Build Order

1. Fix bugs C1–C4 and M1–M5 (stability)
2. Anchor Registry smart contract (trust)
3. `useUsdcPayment()` shared hook + wallet-signature ownership (DX + reliability)
4. "Pay with USDC" button on merchant detail (core product)
5. Live USDC stats ticker (authority)
6. Real world map (visual differentiation)
7. USDC Score leaderboard + tooltip (stickiness)
8. ⌘K command palette (power-user UX)
9. Live fiat prices in swap (accuracy)
10. x402 agent API monetization (ecosystem)
