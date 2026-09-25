/**
 * Multichain listing payments — chain registry.
 *
 * The native gasless x402 path (EIP-3009 transferWithAuthorization) runs on
 * Base Mainnet only. Every other chain uses the "paste tx hash" alternative-
 * payment path: the submitter pays 3 USDC to our treasury on their own chain,
 * then submits the tx hash to `submit-listing`, which verifies the on-chain
 * transfer before inserting the listing.
 *
 * Treasuries:
 *  - EVM:    0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c (single address, all EVM chains)
 *  - Solana: 4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be
 *  - Sui:    0xa15979dcd7429463cdf01aae184cb32e33fcf15d3e46067238ccc384115f9979
 *  - Near:   b63a64053204d89290b73e3dbdce660a2f29d211cd1c400f4a499ac165f98171
 *
 * USDC contracts cover native + audited bridged variants. Backend uses this
 * same registry (duplicated in `supabase/functions/_shared/chains.ts`-style
 * inline maps) to verify transfers.
 */

export const LISTING_FEE_USDC = "3";
export const LISTING_FEE_BASE_UNITS = 3_000_000n; // 6 decimals

export const EVM_TREASURY = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c";
export const SOLANA_TREASURY = "4RsopWwQuDLjNC4AdCd3Uzq7w58i9FoE69EgNTB3d4Be";
export const SUI_TREASURY = "0xa15979dcd7429463cdf01aae184cb32e33fcf15d3e46067238ccc384115f9979";
export const NEAR_TREASURY = "b63a64053204d89290b73e3dbdce660a2f29d211cd1c400f4a499ac165f98171";

export type ChainFamily = "evm" | "solana" | "sui" | "near";

export interface ChainEntry {
  key: string;               // stable id used in backend / manifest
  label: string;             // human label for UI
  family: ChainFamily;
  treasury: string;
  usdc?: string;             // EVM USDC contract / Solana mint / Sui type / Near token contract
  usdcKind?: "native" | "bridged";
  explorerTx: (hash: string) => string;
  notes?: string;
}

export const PAYMENT_CHAINS: ChainEntry[] = [
  // ── EVM mainnets ────────────────────────────────────────────────
  {
    key: "base", label: "Base", family: "evm", treasury: EVM_TREASURY,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", usdcKind: "native",
    explorerTx: (h) => `https://basescan.org/tx/${h}`,
    notes: "Native x402 gasless path supported",
  },
  {
    key: "arc", label: "Arc Mainnet", family: "evm", treasury: EVM_TREASURY,
    usdc: "0x3600000000000000000000000000000000000000", usdcKind: "native",
    explorerTx: (h) => `https://explorer.arc.io/tx/${h}`,
    notes: "USDC is the native gas token. Settles in seconds.",
  },
  {
    key: "ethereum", label: "Ethereum", family: "evm", treasury: EVM_TREASURY,
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", usdcKind: "native",
    explorerTx: (h) => `https://etherscan.io/tx/${h}`,
  },
  {
    key: "arbitrum", label: "Arbitrum", family: "evm", treasury: EVM_TREASURY,
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", usdcKind: "native",
    explorerTx: (h) => `https://arbiscan.io/tx/${h}`,
  },
  {
    key: "optimism", label: "Optimism", family: "evm", treasury: EVM_TREASURY,
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", usdcKind: "native",
    explorerTx: (h) => `https://optimistic.etherscan.io/tx/${h}`,
  },
  {
    key: "polygon", label: "Polygon", family: "evm", treasury: EVM_TREASURY,
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", usdcKind: "native",
    explorerTx: (h) => `https://polygonscan.com/tx/${h}`,
  },
  {
    key: "avalanche", label: "Avalanche", family: "evm", treasury: EVM_TREASURY,
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", usdcKind: "native",
    explorerTx: (h) => `https://snowtrace.io/tx/${h}`,
  },
  {
    key: "bnb", label: "BNB Chain", family: "evm", treasury: EVM_TREASURY,
    usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", usdcKind: "bridged",
    explorerTx: (h) => `https://bscscan.com/tx/${h}`,
    notes: "Binance-Peg USDC (bridged)",
  },
  {
    key: "linea", label: "Linea", family: "evm", treasury: EVM_TREASURY,
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", usdcKind: "native",
    explorerTx: (h) => `https://lineascan.build/tx/${h}`,
  },
  {
    key: "monad", label: "Monad", family: "evm", treasury: EVM_TREASURY,
    usdc: "0xf817257fed379853cDe0fa4F97AB987181B1E5f3",
    usdcKind: "bridged",
    explorerTx: (h) => `https://explorer.monad.xyz/tx/${h}`,
    notes: "Bridged USDC via LayerZero OFT on Monad mainnet",
  },
  // ── Non-EVM mainnets ────────────────────────────────────────────
  {
    key: "solana", label: "Solana", family: "solana", treasury: SOLANA_TREASURY,
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", usdcKind: "native",
    explorerTx: (h) => `https://solscan.io/tx/${h}`,
  },
  {
    key: "sui", label: "Sui", family: "sui", treasury: SUI_TREASURY,
    usdc: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    usdcKind: "native",
    explorerTx: (h) => `https://suiscan.xyz/mainnet/tx/${h}`,
  },
  {
    key: "near", label: "Near", family: "near", treasury: NEAR_TREASURY,
    usdc: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    usdcKind: "native",
    explorerTx: (h) => `https://nearblocks.io/txns/${h}`,
  },
];

export function getChain(key: string): ChainEntry | undefined {
  return PAYMENT_CHAINS.find((c) => c.key === key);
}
