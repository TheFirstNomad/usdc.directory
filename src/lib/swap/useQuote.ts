import { useReadContract } from "wagmi";
import { parseUnits } from "viem";
import { UNISWAP_V3_QUOTER_V2, QUOTER_V2_ABI } from "./contracts";
import type { TokenInfo } from "./tokens";
import { WETH_ADDRESS, getPoolFee } from "./tokens";

export function useQuote({
  tokenIn,
  tokenOut,
  amountIn,
  chainId,
  enabled = true,
}: {
  tokenIn: TokenInfo | null;
  tokenOut: TokenInfo | null;
  amountIn: string;
  chainId: number;
  enabled?: boolean;
}) {
  const amountInParsed = (() => {
    try {
      const num = parseFloat(amountIn);
      if (!num || num <= 0 || !tokenIn) return 0n;
      return parseUnits(amountIn, tokenIn.decimals);
    } catch {
      return 0n;
    }
  })();

  const isBase = chainId === 8453;
  const isArc = chainId === 5042;

  // ── V3 quote (Base) ──
  const actualTokenInV3 = tokenIn?.address === "native" ? WETH_ADDRESS : (tokenIn?.address as `0x${string}`);
  const actualTokenOutV3 = tokenOut?.address === "native" ? WETH_ADDRESS : (tokenOut?.address as `0x${string}`);
  const poolFee = tokenIn && tokenOut ? getPoolFee(tokenIn.symbol, tokenOut.symbol) : 3000;

  const shouldFetchV3 =
    enabled && isBase && !!tokenIn && !!tokenOut &&
    amountInParsed > 0n && actualTokenInV3 !== actualTokenOutV3;

  const { data: v3Data, isLoading: v3Loading, error: v3Error } = useReadContract({
    address: UNISWAP_V3_QUOTER_V2,
    abi: QUOTER_V2_ABI,
    functionName: "quoteExactInputSingle",
    args: shouldFetchV3
      ? [{
          tokenIn: actualTokenInV3!,
          tokenOut: actualTokenOutV3!,
          amountIn: amountInParsed,
          fee: poolFee,
          sqrtPriceLimitX96: 0n,
        }]
      : undefined,
    chainId: 8453,
    query: { enabled: shouldFetchV3, refetchInterval: 15_000 },
  });

  // ── Arc Mainnet: Use 1:1 stablecoin estimate (no on-chain V2 liquidity available) ──
  // Arc Mainnet USDC/EURC swaps are executed via Circle App Kit's built-in swap,
  // so we provide an estimated quote here for display purposes.
  if (isArc) {
    const bothStable = tokenIn?.isStable && tokenOut?.isStable;
    // For USDC/EURC, approximate 1:1.08 rate (or inverse)
    let estimatedOut: bigint | null = null;
    if (amountInParsed > 0n && tokenIn && tokenOut && bothStable) {
      if (tokenIn.symbol === "USDC" && tokenOut.symbol === "EURC") {
        // 1 USDC ≈ 0.926 EURC (1/1.08)
        estimatedOut = (amountInParsed * 926n) / 1000n;
      } else if (tokenIn.symbol === "EURC" && tokenOut.symbol === "USDC") {
        // 1 EURC ≈ 1.08 USDC
        estimatedOut = (amountInParsed * 1080n) / 1000n;
      } else {
        estimatedOut = amountInParsed; // same stablecoin fallback
      }
    }
    return {
      amountOut: estimatedOut,
      gasEstimate: null,
      isLoading: false,
      error: null,
      poolFee: 3000,
      isEstimate: true, // flag that this is an estimate, not on-chain
    };
  }

  // Base V3
  const result = v3Data as readonly [bigint, bigint, number, bigint] | undefined;
  return {
    amountOut: result?.[0] ?? null,
    gasEstimate: result?.[3] ?? null,
    isLoading: shouldFetchV3 && v3Loading,
    error: v3Error,
    poolFee,
    isEstimate: false,
  };
}
