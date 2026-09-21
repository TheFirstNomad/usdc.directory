export type SupportedChainId = 8453 | 5042;

export const CHAINS: Record<SupportedChainId, {
  name: string;
  shortName: string;
  explorer: string;
  isTestnet: boolean;
  faucetUrl?: string;
  dexName: string;
}> = {
  8453: {
    name: "Base Mainnet",
    shortName: "Base",
    explorer: "https://basescan.org",
    isTestnet: false,
    dexName: "Uniswap V3",
  },
  5042: {
    name: "Arc Mainnet",
    shortName: "Arc",
    explorer: "https://explorer.arc.io",
    isTestnet: false,
    dexName: "Circle App Kit",
  },
};
