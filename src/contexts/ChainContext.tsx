import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { SupportedChainId } from "@/lib/swap/chains";
import { CHAINS } from "@/lib/swap/chains";

interface ChainContextValue {
  chainId: SupportedChainId;
  setChainId: (id: SupportedChainId) => void;
  chainConfig: (typeof CHAINS)[SupportedChainId];
  isArcTestnet: boolean;
}

const ChainContext = createContext<ChainContextValue | null>(null);

const STORAGE_KEY = "usdcdir:lastChainId";
const DEFAULT_CHAIN: SupportedChainId = 5042;

const readStoredChain = (): SupportedChainId => {
  if (typeof window === "undefined") return DEFAULT_CHAIN;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHAIN;
    const parsed = Number(raw) as SupportedChainId;
    return parsed in CHAINS ? parsed : DEFAULT_CHAIN;
  } catch {
    return DEFAULT_CHAIN;
  }
};

export const ChainProvider = ({ children }: { children: ReactNode }) => {
  const [chainId, setChainIdState] = useState<SupportedChainId>(readStoredChain);

  const setChainId = useCallback((id: SupportedChainId) => {
    setChainIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // ignore
    }
  }, []);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const parsed = Number(e.newValue) as SupportedChainId;
        if (parsed in CHAINS) setChainIdState(parsed);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const chainConfig = CHAINS[chainId];
  const isArcTestnet = chainId === 5042;

  return (
    <ChainContext.Provider value={{ chainId, setChainId, chainConfig, isArcTestnet }}>
      {children}
    </ChainContext.Provider>
  );
};

export const useChainContext = () => {
  const ctx = useContext(ChainContext);
  if (!ctx) throw new Error("useChainContext must be used within ChainProvider");
  return ctx;
};
