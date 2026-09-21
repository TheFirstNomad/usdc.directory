import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import { base } from "@reown/appkit/networks";
import { type ReactNode } from "react";

const projectId = import.meta.env.VITE_WALLET_CONNECT_PROJECT_ID || "3592c16759a9b6907bc4eb5afd455b15";

// Arc Mainnet custom chain (USDC-native gas token)
const arcMainnet = {
  id: 5042,
  name: "Arc",
  // Arc uses USDC as native gas token — msg.value is in 18-decimal wei
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.arc.io" } },
  testnet: false,
} as any;

const networks = [base, arcMainnet] as const;

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: networks as any,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: networks as any,
  projectId,
  metadata: {
    name: "USDC Directory",
    description: "Discover businesses that accept USDC payments",
    url: typeof window !== "undefined" ? window.location.origin : "https://usdc-directory.lovable.app",
    icons: [],
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
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
