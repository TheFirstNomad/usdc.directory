/**
 * useListingPayment — shared hook for paying a listing fee via Circle App Kit.
 *
 * Replaces duplicated createViemAdapterFromWallet + payListingFee calls
 * in Submit.tsx, SubmitAIAgent.tsx, and EditListing.tsx.
 *
 * Usage:
 *   const { pay, isPaying, error } = useListingPayment();
 *   const { txHash, explorerUrl } = await pay({ chainId: 5042, amount: "3" });
 */

import { useState, useCallback } from "react";
import { useAppKitProvider } from "@reown/appkit/react";
import {
  createViemAdapterFromWallet,
  payListingFee,
  getExplorerUrl,
  type PaymentChainId,
} from "@/lib/arcAppKit";

export interface PayListingArgs {
  chainId?: PaymentChainId;
  amount?: string;
}

export interface PayListingResult {
  txHash: string;
  explorerUrl: string;
}

export function useListingPayment() {
  const { walletProvider } = useAppKitProvider("eip155");
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(
    async ({ chainId = 5042, amount = "3" }: PayListingArgs = {}): Promise<PayListingResult> => {
      setIsPaying(true);
      setError(null);
      try {
        const adapter = await createViemAdapterFromWallet(walletProvider);
        const result = await payListingFee(adapter, chainId, amount);
        return {
          txHash: result.txHash,
          explorerUrl: getExplorerUrl(chainId, result.txHash),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setIsPaying(false);
      }
    },
    [walletProvider]
  );

  return { pay, isPaying, error, clearError: () => setError(null) };
}
