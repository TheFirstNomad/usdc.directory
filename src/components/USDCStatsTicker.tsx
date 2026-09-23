/**
 * USDCStatsTicker — live USDC ecosystem stats bar.
 * Fetches circulating supply from CoinGecko public API (no key needed).
 * Falls back to known static values if the API is unavailable.
 */
import { useEffect, useState } from "react";
import { TrendingUp, Globe, DollarSign, Zap } from "lucide-react";

interface Stats {
  supply: string;
  volume24h: string;
  chains: string;
  partners: string;
}

const FALLBACK: Stats = {
  supply: "$78B+",
  volume24h: "$8B+",
  chains: "30+",
  partners: "300+",
};

function formatBillions(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T+`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B+`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M+`;
  return `$${n.toLocaleString()}`;
}

const STAT_ITEMS = (s: Stats) => [
  { icon: DollarSign, label: "USDC Supply", value: s.supply, color: "text-primary" },
  { icon: TrendingUp, label: "24h Volume", value: s.volume24h, color: "text-emerald-400" },
  { icon: Globe, label: "Blockchains", value: s.chains, color: "text-sky-400" },
  { icon: Zap, label: "Circle Partners", value: s.partners, color: "text-amber-400" },
];

export default function USDCStatsTicker() {
  const [stats, setStats] = useState<Stats>(FALLBACK);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      "https://api.coingecko.com/api/v3/coins/usd-coin?localization=false&tickers=false&community_data=false&developer_data=false",
      { signal: controller.signal, cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        const mktData = data?.market_data;
        if (!mktData) return;
        const supply = mktData.circulating_supply as number | undefined;
        const vol = mktData.total_volume?.usd as number | undefined;
        setStats({
          supply: supply ? formatBillions(supply) : FALLBACK.supply,
          volume24h: vol ? formatBillions(vol) : FALLBACK.volume24h,
          chains: FALLBACK.chains,
          partners: FALLBACK.partners,
        });
        setLive(true);
      })
      .catch(() => {
        // silently fall back to static values
      });
    return () => controller.abort();
  }, []);

  const items = STAT_ITEMS(stats);

  return (
    <div className="w-full border-b border-border/50 bg-card/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between overflow-x-auto scrollbar-hide gap-0 divide-x divide-border/40">
          {items.map(({ icon: Icon, label, value, color }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2.5 flex-1 min-w-[120px] flex-shrink-0"
            >
              <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${color}`} />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-none truncate">{label}</p>
                <p className={`text-sm font-bold leading-tight ${color}`}>{value}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-4 py-2.5 flex-shrink-0">
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${live ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{live ? "Live" : "Cached"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
