import { Link } from "react-router-dom";
import { BadgeCheck, Star } from "lucide-react";
import type { Partner } from "@/lib/partners";
import { CATEGORY_EMOJIS } from "@/lib/partners";

const FeaturedCarousel = ({ partners }: { partners: Partner[] }) => {
  if (partners.length === 0) return null;

  const uniquePartners = Array.from(
    new Map(partners.map((p) => [p.name.toLowerCase().trim(), p])).values()
  );

  return (
    <section className="py-6">
      <div className="flex items-center mb-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          Featured Listings
        </h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide -mx-1 px-1">
        {uniquePartners.map((p) => {
          const logoUrl =
            p.logo_url && p.logo_url !== ""
              ? p.logo_url
              : `https://logo.clearbit.com/${p.website?.replace(/https?:\/\//, "").replace(/\/.*/, "") || p.name.toLowerCase().replace(/\s+/g, "") + ".com"}`;
          const isBoosted = !!p.boosted_until && new Date(p.boosted_until).getTime() > Date.now();
          const primaryCat = p.categories[0];

          return (
            <Link
              key={p.id}
              to={`/merchant/${p.id}`}
              className="snap-start flex-shrink-0 w-56 bg-card border border-border rounded-xl p-4 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 group relative overflow-hidden"
            >
              {isBoosted && (
                <div className="absolute top-2 right-2 text-[9px] font-bold bg-amber-400/15 text-amber-500 px-1.5 py-0.5 rounded-full">
                  ⚡ Boosted
                </div>
              )}
              <div className="flex items-center gap-2.5 mb-2.5">
                <img
                  src={logoUrl}
                  alt={`${p.name} logo`}
                  width={36}
                  height={36}
                  className="w-9 h-9 object-contain rounded-lg bg-muted/40 p-0.5 flex-shrink-0 group-hover:scale-105 transition-transform"
                  loading="lazy"
                  decoding="async"
                  onError={(e) => {
                    e.currentTarget.src = "https://cryptologos.cc/logos/usd-coin-usdc-logo.png";
                  }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <h3 className="font-semibold text-foreground text-xs truncate">{p.name}</h3>
                    {(p.featured || p.verified) && (
                      <BadgeCheck className="h-3 w-3 text-primary flex-shrink-0" />
                    )}
                  </div>
                  {primaryCat && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {CATEGORY_EMOJIS[primaryCat] || ""} {primaryCat}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">
                {p.description}
              </p>
              {p.usdc_score && p.usdc_score > 0 && (
                <div className="mt-2.5 flex items-center gap-1.5">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${p.usdc_score}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-primary">{p.usdc_score}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default FeaturedCarousel;
