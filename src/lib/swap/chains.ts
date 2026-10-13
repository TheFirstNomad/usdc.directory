/**
 * Supported EVM chains for the USDC Directory swap and payment UI.
 * Arc is always the default chain (chain ID 5042).
 * Non-EVM chains (Solana, Sui, Near) are supported via the paste-tx-hash
 * payment path only and do not appear in the wallet modal.
 */

export type SupportedChainId =
  | 5042   // Arc Mainnet (default)
  | 8453   // Base
  | 1      // Ethereum
  | 42161  // Arbitrum One
  | 10     // Optimism
  | 137    // Polygon
  | 43114  // Avalanche C-Chain
  | 56     // BNB Chain
  | 59144; // Linea

export const CHAINS: Record<SupportedChainId, {
  name: string;
  shortName: string;
  explorer: string;
  dexName: string;
  subtitle: string;
  usdc: `0x${string}`;
  rpc: string;
}> = {
  5042: {
    name: "Arc",
    shortName: "Arc",
    explorer: "https://explorer.arc.io",
    dexName: "Circle App Kit",
    subtitle: "Default · USDC gas",
    usdc: "0x3600000000000000000000000000000000000000",
    rpc: "https://rpc.mainnet.arc.io",
  },
  8453: {
    name: "Base",
    shortName: "Base",
    explorer: "https://basescan.org",
    dexName: "Uniswap V3",
    subtitle: "Low fees · EVM",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    rpc: "https://mainnet.base.org",
  },
  1: {
    name: "Ethereum",
    shortName: "ETH",
    explorer: "https://etherscan.io",
    dexName: "Uniswap V3",
    subtitle: "Mainnet · EVM",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    rpc: "https://eth.llamarpc.com",
  },
  42161: {
    name: "Arbitrum",
    shortName: "Arb",
    explorer: "https://arbiscan.io",
    dexName: "Uniswap V3",
    subtitle: "Low fees · L2",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    rpc: "https://arb1.arbitrum.io/rpc",
  },
  10: {
    name: "Optimism",
    shortName: "OP",
    explorer: "https://optimistic.etherscan.io",
    dexName: "Uniswap V3",
    subtitle: "Low fees · L2",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    rpc: "https://mainnet.optimism.io",
  },
  137: {
    name: "Polygon",
    shortName: "MATIC",
    explorer: "https://polygonscan.com",
    dexName: "Uniswap V3",
    subtitle: "Low fees · EVM",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    rpc: "https://polygon-rpc.com",
  },
  43114: {
    name: "Avalanche",
    shortName: "AVAX",
    explorer: "https://snowscan.xyz",
    dexName: "Trader Joe",
    subtitle: "Fast finality · EVM",
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
  },
  56: {
    name: "BNB Chain",
    shortName: "BNB",
    explorer: "https://bscscan.com",
    dexName: "PancakeSwap",
    subtitle: "Low fees · EVM",
    usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    rpc: "https://bsc-dataseed.binance.org",
  },
  59144: {
    name: "Linea",
    shortName: "Linea",
    explorer: "https://lineascan.build",
    dexName: "Nile",
    subtitle: "ZK rollup · L2",
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    rpc: "https://rpc.linea.build",
  },
};

export const DEFAULT_CHAIN_ID: SupportedChainId = 5042;
