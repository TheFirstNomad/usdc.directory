import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import { createAppKit } from "@reown/appkit/react";
import { type AppKitNetwork } from "@reown/appkit/networks";
import {
  base,
  mainnet,
  arbitrum,
  optimism,
  polygon,
  avalanche,
  bsc,
  linea,
  solana,
} from "@reown/appkit/networks";
import { type ReactNode } from "react";

const projectId =
  import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID ||
  "3592c16759a9b6907bc4eb5afd455b15";

// Arc Mainnet — custom chain (USDC is the native gas token)
const arcMainnet = {
  id: 5042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arc.io" },
  },
  testnet: false,
} as const;

// Arc is listed first — it becomes the default chain in the wallet modal
const networks = [
  arcMainnet,
  base,
  mainnet,
  arbitrum,
  optimism,
  polygon,
  avalanche,
  bsc,
  linea,
] as const;

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: networks as unknown as [AppKitNetwork, ...AppKitNetwork[]],
});

// Solana mainnet — Phantom, Solflare, Backpack for 1-click USDC listing payments
const solanaAdapter = new SolanaAdapter();

createAppKit({
  adapters: [wagmiAdapter, solanaAdapter],
  networks: [...networks, solana] as [AppKitNetwork, ...AppKitNetwork[]],
  defaultNetwork: arcMainnet as AppKitNetwork,
  projectId,
  metadata: {
    name: "USDC Directory",
    description:
      "The #1 directory of merchants and AI agents accepting USDC worldwide.",
    url:
      typeof window !== "undefined"
        ? window.location.origin
        : "https://usdc.directory",
    icons: ["https://usdc.directory/usdc-directory-logo.png"],
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "hsl(210, 79%, 55%)",
    "--w3m-border-radius-master": "2px",
  },
  features: {
    email: false,
    socials: false,
    swaps: false,
    send: false,
    receive: false,
    onramp: false,
    history: false,
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
