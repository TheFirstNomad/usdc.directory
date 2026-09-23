import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, BadgeCheck, TrendingUp, Info } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { fetchPartners, type Partner, CATEGORY_EMOJIS } from "@/lib/partners";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SCORE_DIMS = [
  { label: "USDC Integration depth", weight: 30 },
  { label: "Verification status", weight: 25 },
  { label: "Regional reach", weight: 20 },
  { label: "Listing age & activity", weight: 15 },
  { label: "Category breadth", weight: 10 },
];

const medalColor = (rank: number) => {
  if (rank === 1) return "text-yellow-400";
  if (rank === 2) return "text-slate-300";
  if (rank === 3) return "text-amber-600";
  return "text-muted-foreground";
};

const scoreTier = (s: number) => {
  if (s >= 80) return { label: "Excellent", color: "text-emerald-400 bg-emerald-500/10" };
  if (s >= 60) return { label: "Good", color: "text-sky-400 bg-sky-500/10" };
  if (s >= 40) return { label: "Building", color: "text-amber-400 bg-amber-500/10" };
  return { label: "New", color: "text-muted-foreground bg-muted" };
};

export default function Leaderboard() {
  const { data: partners = [], isLoading } = useQuery<Partner[]>({
    queryKey: ["partners"],
    queryFn: fetchPartners,
    staleTime: 5 * 60 * 1000,
  });

  const ranked = useMemo(
    () =>
      [...partners]
        .filter((p) => (p.usdc_score ?? 0) > 0)
        .sort((a, b) => (b.usdc_score ?? 0) - (a.usdc_score ?? 0))
        .slice(0, 100),
    [partners]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="USDC Score Leaderboard"
        description="Top-ranked USDC merchants by integration score. See which businesses lead the USDC economy."
        path="/leaderboard"
      />
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden py-14 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-background to-amber-500/[0.04]" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Trophy className="h-7 w-7 text-amber-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-3 tracking-tight">
            USDC Score{" "}
            <span className="bg-gradient-to-r from-amber-400 to-primary bg-clip-text text-transparent">
              Leaderboard
            </span>
          </h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto">
            Merchants ranked by their USDC integration depth. Updated in real-time from the directory.
          </p>

          {/* Score breakdown tooltip */}
          <div className="mt-5 inline-flex items-center gap-2 text-xs text-muted-foreground bg-card border border-border rounded-xl px-4 py-2">
            <Info className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span>Score is calculated across {SCORE_DIMS.length} dimensions</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-primary underline underline-offset-2 cursor-help">How?</button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs p-3 space-y-1.5">
                {SCORE_DIMS.map((d) => (
                  <div key={d.label} className="flex justify-between gap-4 text-xs">
                    <span>{d.label}</span>
                    <span className="font-semibold text-primary">{d.weight}%</span>
                  </div>
                ))}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </section>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 pb-12">
        {/* Top 3 podium */}
        {!isLoading && ranked.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[ranked[1], ranked[0], ranked[2]].map((p, i) => {
              const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
              const tier = scoreTier(p.usdc_score ?? 0);
              const logoUrl = p.logo_url && p.logo_url !== ""
                ? p.logo_url
                : `https://logo.clearbit.com/${p.website?.replace(/https?:\/\//, "").replace(/\/.*/, "") || p.name.toLowerCase() + ".com"}`;
              return (
                <Link
                  key={p.id}
                  to={`/merchant/${p.id}`}
                  className={`flex flex-col items-center bg-card border rounded-2xl p-4 text-center hover:border-primary/40 hover:shadow-lg transition-all ${
                    rank === 1 ? "border-amber-400/40 shadow-amber-400/10 shadow-md order-2" : "border-border order-1"
                  } ${i === 2 ? "order-3" : ""}`}
                >
                  <div className={`text-2xl font-black mb-2 ${medalColor(rank)}`}>
                    {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                  </div>
                  <img
                    src={logoUrl}
                    alt={p.name}
                    className="w-12 h-12 rounded-xl object-contain bg-muted/50 p-1 mb-2"
                    onError={(e) => { e.currentTarget.src = "https://cryptologos.cc/logos/usd-coin-usdc-logo.png"; }}
                  />
                  <p className="font-bold text-sm text-foreground truncate w-full">{p.name}</p>
                  <span className={`mt-1 text-xs px-2 py-0.5 rounded-full font-semibold ${tier.color}`}>
                    {p.usdc_score}/100
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Full table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Top {ranked.length} Merchants
            </h2>
            <span className="text-xs text-muted-foreground">{partners.length} total in directory</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : (
            <ul className="divide-y divide-border/50">
              {ranked.map((p, idx) => {
                const tier = scoreTier(p.usdc_score ?? 0);
                const logoUrl = p.logo_url && p.logo_url !== ""
                  ? p.logo_url
                  : `https://logo.clearbit.com/${p.website?.replace(/https?:\/\//, "").replace(/\/.*/, "") || p.name.toLowerCase() + ".com"}`;
                return (
                  <motion.li
                    key={p.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                  >
                    <Link
                      to={`/merchant/${p.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                    >
                      <span className={`w-7 text-sm font-bold text-right flex-shrink-0 ${medalColor(idx + 1)}`}>
                        #{idx + 1}
                      </span>
                      <img
                        src={logoUrl}
                        alt={p.name}
                        className="w-9 h-9 rounded-lg object-contain bg-muted/50 p-0.5 flex-shrink-0"
                        onError={(e) => { e.currentTarget.src = "https://cryptologos.cc/logos/usd-coin-usdc-logo.png"; }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-foreground truncate">{p.name}</span>
                          {(p.featured || p.verified) && <BadgeCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.categories.slice(0, 2).map((c) => `${CATEGORY_EMOJIS[c] || ""}${c}`).join(" · ")}
                        </p>
                      </div>
                      {/* Score bar */}
                      <div className="hidden sm:flex items-center gap-2 flex-shrink-0 w-32">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${p.usdc_score ?? 0}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${tier.color}`}>
                          {p.usdc_score}
                        </span>
                      </div>
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
