import { forwardRef } from "react";
import { safeHttpUrl } from "@/lib/safeUrl";
import { Partner, REGION_FLAGS, CATEGORY_EMOJIS } from "@/lib/partners";
import { Button } from "@/components/ui/button";
import { BadgeCheck } from "lucide-react";
import { Link } from "react-router-dom";

const categoryColors: Record<string, string> = {
  "AI & Agentic Platforms": "bg-cyan-500/10 text-cyan-400",
  "AI Agents": "bg-cyan-500/10 text-cyan-400",
  "Bridge Apps": "bg-indigo-500/10 text-indigo-400",
  "Bridge SDKs": "bg-blue-500/10 text-blue-400",
  "DeFi Apps": "bg-fuchsia-500/10 text-fuchsia-400",
  "DeFi": "bg-fuchsia-500/10 text-fuchsia-400",
  "Digital Wallets": "bg-violet-500/10 text-violet-400",
  "Due Diligence & Advisory": "bg-slate-500/10 text-slate-400",
  "Ecommerce": "bg-orange-500/10 text-orange-400",
  "Exchanges": "bg-amber-500/10 text-amber-400",
  "Fintechs": "bg-teal-500/10 text-teal-400",
  "Gaming": "bg-red-500/10 text-red-400",
  "Infrastructure Providers": "bg-slate-500/10 text-slate-400",
  "Market Makers": "bg-sky-500/10 text-sky-400",
  "Marketplaces": "bg-lime-500/10 text-lime-400",
  "Neobanks": "bg-indigo-500/10 text-indigo-400",
  "OTC Desks": "bg-purple-500/10 text-purple-400",
  "Onramp": "bg-emerald-500/10 text-emerald-400",
  "Offramp": "bg-pink-500/10 text-pink-400",
  "Payments": "bg-primary/10 text-primary",
  "PR & Communications": "bg-rose-500/10 text-rose-400",
  "Remittances": "bg-emerald-500/10 text-emerald-400",
  "Security": "bg-yellow-500/10 text-yellow-400",
  "Stablecoin Issuers": "bg-blue-500/10 text-blue-400",
  "Custody": "bg-zinc-500/10 text-zinc-400",
  "Analytics": "bg-sky-500/10 text-sky-400",
};

const BOT_LOGO = "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=";
const USDC_FALLBACK = "https://cryptologos.cc/logos/usd-coin-usdc-logo.png";

const PartnerCard = forwardRef<HTMLDivElement, { partner: Partner; index: number }>(({ partner, index }, ref) => {
  const isBoosted = !!partner.boosted_until && new Date(partner.boosted_until).getTime() > Date.now();
  const isAIAgent = partner.categories?.some((c) => c === "AI Agents" || c === "AI Agents & Automation");
  const safeLogo = safeHttpUrl(partner.logo_url);
  const hasOwnLogo = !!safeLogo && !safeLogo.includes("usd-coin-usdc-logo");
  // No third-party logo lookups: a listing without its own logo gets a neutral fallback,
  // so browsing the directory never leaks which merchants a visitor looks at.
  const logoUrl = isAIAgent && !hasOwnLogo
    ? `${BOT_LOGO}${encodeURIComponent(partner.name)}`
    : hasOwnLogo
      ? safeLogo!
      : USDC_FALLBACK;

  const isNew = partner.created_at
    ? Date.now() - new Date(partner.created_at).getTime() < 7 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div
      ref={ref}
      className={`partner-card group relative bg-card rounded-2xl overflow-hidden h-full flex flex-col border ${isBoosted ? "border-amber-400/60 shadow-amber-400/10 shadow-lg" : "border-border"} hover:border-primary/30 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}
      style={{ animationDelay: `${Math.min(index * 30, 500)}ms` }}
    >
      <Link to={`/merchant/${partner.id}`} className="flex flex-col h-full">
        <div className="h-36 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20 p-6 relative">
          {isBoosted && (
            <div className="absolute top-3 right-3 text-[10px] font-bold bg-amber-400/15 text-amber-500 px-2 py-0.5 rounded-full flex items-center gap-1">
              ⚡ Boosted
            </div>
          )}
          {partner.categories?.includes("AI Agents") && !isBoosted && (
            <div className="absolute top-3 right-3 text-[10px] font-bold bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              AI Agent
            </div>
          )}
          {partner.featured && (
            <div className="absolute top-3 left-3 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
              Featured
            </div>
          )}
          {isNew && !partner.featured && (
            <div className="absolute top-3 left-3 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1">
              ✨ New
            </div>
          )}
          <img
            src={logoUrl}
            alt={`${partner.name} logo`}
            width={96}
            height={96}
            className="h-24 w-24 object-contain rounded-xl bg-card p-2 shadow-md group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = isAIAgent
                ? `${BOT_LOGO}${encodeURIComponent(partner.name)}`
                : USDC_FALLBACK;
            }}
          />
        </div>

        <div className="p-5 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="font-bold text-lg tracking-tight text-foreground leading-tight truncate">
              {partner.name}
            </h3>
            {(partner.featured || partner.verified) && (
              <BadgeCheck className="h-[18px] w-[18px] text-primary flex-shrink-0" aria-label={partner.verified ? "Verified" : "Featured"} />
            )}
          </div>

          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
            <span>{REGION_FLAGS[partner.region] || "World"}</span>
            <span>{partner.region}</span>
            {partner.usdc_score && partner.usdc_score > 0 && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span className="text-primary font-medium">Score: {partner.usdc_score}</span>
              </>
            )}
          </div>

          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1 leading-relaxed">
            {partner.description}
          </p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {partner.categories.slice(0, 3).map((cat, i) => (
              <span
                key={i}
                className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full ${categoryColors[cat] || "bg-muted text-muted-foreground"}`}
              >
                {CATEGORY_EMOJIS[cat] ? `${CATEGORY_EMOJIS[cat]} ` : ""}{cat}
              </span>
            ))}
          </div>

          {/* No Visit button on cards anymore - users click the card to go to detail page */}
        </div>
      </Link>
    </div>
  );
});
PartnerCard.displayName = "PartnerCard";

export default PartnerCard;
