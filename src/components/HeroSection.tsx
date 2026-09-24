import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, CATEGORY_EMOJIS } from "@/lib/partners";
import { useState, useRef, useMemo, useEffect, forwardRef } from "react";

interface HeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: () => void;
  partnerCount: number;
  onCategorySelect: (cat: string) => void;
  selectedCategories: string[];
  partnerNames?: string[];
  countryCount?: number;
  networkCount?: number;
}

const AnimatedCounter = ({ target }: { target: number }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let start = 0;
    const duration = 1200;
    const step = Math.max(1, Math.floor(target / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{count}</span>;
};

const HeroSection = forwardRef<HTMLElement, HeroSectionProps>(({
  searchQuery,
  onSearchChange,
  onSearch,
  partnerCount,
  onCategorySelect,
  selectedCategories,
  partnerNames = [],
}, ref) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    const nameMatches = partnerNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 3);
    const catMatches = CATEGORIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 2);
    return [...new Set([...nameMatches, ...catMatches])].slice(0, 5);
  }, [searchQuery, partnerNames]);

  return (
    <section ref={ref} className="relative overflow-hidden pt-20 pb-14 sm:pt-28 sm:pb-20">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-background to-[hsl(275,80%,55%)]/[0.04]" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 0.5px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/[0.08] blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto text-center px-4 sm:px-6">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-foreground mb-5 leading-[1.08] tracking-tight">
          The #1 Directory for the Global{" "}
          <span className="bg-gradient-to-r from-primary via-[hsl(210,90%,55%)] to-[hsl(275,80%,55%)] bg-clip-text text-transparent">
            USDC Economy
          </span>
        </h1>

        <p className="text-muted-foreground text-base sm:text-lg mb-10 max-w-xl mx-auto leading-relaxed">
          Discover trusted merchants, B2B services, and AI-driven platforms accepting{" "}
          <span className="font-semibold text-foreground">USDC</span> worldwide. List your business for 3 USDC.
        </p>

        {/* Search bar */}
        <div className="relative max-w-xl mx-auto">
          <div className="search-input bg-card rounded-2xl border border-border/60 flex items-center px-5 py-2.5 gap-3 ring-1 ring-primary/[0.06]">
            <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              aria-label="Search merchants and services"
              placeholder={`Search ${partnerCount} merchants…`}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50 text-sm py-2"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
            />
            <Button
              size="sm"
              onClick={onSearch}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-6 font-semibold shadow-md"
            >
              Search
            </Button>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-20">
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="w-full text-left px-5 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                  onMouseDown={() => {
                    onSearchChange(s);
                    setShowSuggestions(false);
                  }}
                >
                  <Search className="inline h-3.5 w-3.5 text-muted-foreground mr-2" />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {partnerCount > 0 && (
          <div className="mt-7 flex items-center justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span><span className="font-semibold text-foreground"><AnimatedCounter target={partnerCount} />+</span> merchants</span>
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span><span className="font-semibold text-foreground">7</span> regions</span>
            <span className="text-muted-foreground/40">•</span>
            <span><span className="font-semibold text-foreground">15+</span> networks</span>
          </div>
        )}
      </div>
    </section>
  );
});
HeroSection.displayName = "HeroSection";

export default HeroSection;
