/**
 * useFiatPrices — fetches live token prices from CoinGecko public API.
 *
 * Falls back to compile-time constants if the fetch fails so the swap UI
 * always has something to show. Refreshes every 60 seconds.
 *
 * Used by Swap.tsx to replace the hardcoded FIAT_PRICES constant.
 * Also exposes the live EURC/USDC rate for useQuote.ts.
 */

import { useState, useEffect, useRef } from "react";

// Compile-time fallbacks — updated manually when they become too stale.
const FALLBACK: Record<string, number> = {
  ETH: 3450, WETH: 3450,
  USDC: 1, DAI: 1, USDbC: 1,
  cbBTC: 96500,
  AERO: 0.75, DEGEN: 0.008,
  EURC: 1.08,
  BTC: 96500, WBTC: 96500,
};

// CoinGecko IDs for the tokens we care about.
const COINGECKO_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "weth",
  USDC: "usd-coin",
  DAI: "dai",
  cbBTC: "coinbase-wrapped-btc",
  AERO: "aerodrome-finance",
  DEGEN: "degen-base",
  EURC: "euro-coin",
};

const COINGECKO_URL =
  `https://api.coingecko.com/api/v3/simple/price?ids=${Object.values(COINGECKO_IDS).join(",")}&vs_currencies=usd`;

export function useFiatPrices() {
  const [prices, setPrices] = useState<Record<string, number>>(FALLBACK);
  const [isLive, setIsLive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(COINGECKO_URL, { signal: ac.signal });
        if (!res.ok) return;
        const data: Record<string, { usd: number }> = await res.json();
        const next: Record<string, number> = { ...FALLBACK };
        for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
          if (data[id]?.usd) next[symbol] = data[id].usd;
        }
        // Mirror WETH = ETH, USDbC = USDC
        next.WETH = next.ETH;
        next.USDbC = next.USDC;
        setPrices(next);
        setIsLive(true);
      } catch {
        // AbortError or network failure — keep fallback prices
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60_000);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, []);

  return { prices, isLive };
}

/**
 * Compute EURC/USDC rate from live prices.
 * Returns { usdcPerEurc, eurcPerUsdc } as multipliers for bigint math.
 * e.g. usdcPerEurc = 1080n means 1 EURC = 1.080 USDC (multiply by 1080, divide by 1000).
 */
export function eurcRateFromPrices(prices: Record<string, number>): {
  usdcPerEurc: bigint;
  eurcPerUsdc: bigint;
} {
  const eurcUsd = prices.EURC ?? 1.08;
  const usdcUsd = prices.USDC ?? 1;
  // Express as integer multipliers over 10000 for bigint math
  const usdcPerEurc = BigInt(Math.round((eurcUsd / usdcUsd) * 10000));
  const eurcPerUsdc = BigInt(Math.round((usdcUsd / eurcUsd) * 10000));
  return { usdcPerEurc, eurcPerUsdc };
}
