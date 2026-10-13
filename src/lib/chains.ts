/**
 * Chain registry — single source of truth for supported EVM networks.
 * Arc Mainnet is the default chain (USDC as native gas token).
 * Non-EVM chains (Solana, Sui, Near) use the paste-tx-hash path.
 */
export type ChainKey =
  | "arc-mainnet"
  | "base"
  | "ethereum"
  | "arbitrum"
  | "optimism"
  | "polygon"
  | "avalanche"
  | "bnb"
  | "linea";

export interface ChainEntry {
  id: number;
  key: ChainKey;
  label: string;
  network: string;
  rpc: string;
  usdc: `0x${string}`;
  explorer: string;
  enabled: boolean;
  appKitChain?: string;
}

export const CHAINS: Record<ChainKey, ChainEntry> = {
  "arc-mainnet": {
    id: 5042, key: "arc-mainnet", label: "Arc", network: "arc",
    rpc: "https://rpc.mainnet.arc.io",
    usdc: "0x3600000000000000000000000000000000000000",
    explorer: "https://explorer.arc.io",
    enabled: true, appKitChain: "Arc",
  },
  base: {
    id: 8453, key: "base", label: "Base", network: "eip155:8453",
    rpc: "https://mainnet.base.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org",
    enabled: true, appKitChain: "Base",
  },
  ethereum: {
    id: 1, key: "ethereum", label: "Ethereum", network: "eip155:1",
    rpc: "https://eth.llamarpc.com",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    explorer: "https://etherscan.io",
    enabled: true, appKitChain: "Ethereum",
  },
  arbitrum: {
    id: 42161, key: "arbitrum", label: "Arbitrum", network: "eip155:42161",
    rpc: "https://arb1.arbitrum.io/rpc",
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    explorer: "https://arbiscan.io",
    enabled: true, appKitChain: "Arbitrum",
  },
  optimism: {
    id: 10, key: "optimism", label: "Optimism", network: "eip155:10",
    rpc: "https://mainnet.optimism.io",
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    explorer: "https://optimistic.etherscan.io",
    enabled: true, appKitChain: "Optimism",
  },
  polygon: {
    id: 137, key: "polygon", label: "Polygon", network: "eip155:137",
    rpc: "https://polygon-rpc.com",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    explorer: "https://polygonscan.com",
    enabled: true, appKitChain: "Polygon",
  },
  avalanche: {
    id: 43114, key: "avalanche", label: "Avalanche", network: "eip155:43114",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    explorer: "https://snowscan.xyz",
    enabled: true, appKitChain: "Avalanche",
  },
  bnb: {
    id: 56, key: "bnb", label: "BNB Chain", network: "eip155:56",
    rpc: "https://bsc-dataseed.binance.org",
    usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    explorer: "https://bscscan.com",
    enabled: true, appKitChain: "BNB Smart Chain",
  },
  linea: {
    id: 59144, key: "linea", label: "Linea", network: "eip155:59144",
    rpc: "https://rpc.linea.build",
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
    explorer: "https://lineascan.build",
    enabled: true, appKitChain: "Linea",
  },
};

export const ENABLED_CHAINS = Object.values(CHAINS).filter((c) => c.enabled);
export const isArcMainnetLive = () => CHAINS["arc-mainnet"].enabled;
