/**
 * Chain registry — single source of truth for supported networks.
 * Arc Mainnet is live (chain ID 5042, USDC as native gas token).
 */
export type ChainKey = "base" | "arc-mainnet";

export interface ChainEntry {
  id: number;
  key: ChainKey;
  label: string;
  network: string; // x402 network id
  rpc: string;
  usdc: `0x${string}`;
  explorer: string;
  enabled: boolean;
  appKitChain?: string; // Circle App Kit chain string
}

export const CHAINS: Record<ChainKey, ChainEntry> = {
  base: {
    id: 8453, key: "base", label: "Base Mainnet", network: "base",
    rpc: "https://mainnet.base.org",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org",
    enabled: true,
    appKitChain: "Base",
  },
  "arc-mainnet": {
    id: 5042, key: "arc-mainnet", label: "Arc Mainnet", network: "arc",
    rpc: "https://rpc.mainnet.arc.io",
    usdc: "0x3600000000000000000000000000000000000000",
    explorer: "https://explorer.arc.io",
    enabled: true,
    appKitChain: "Arc",
  },
};

export const ENABLED_CHAINS = Object.values(CHAINS).filter((c) => c.enabled);
export const isArcMainnetLive = () => CHAINS["arc-mainnet"].enabled;
