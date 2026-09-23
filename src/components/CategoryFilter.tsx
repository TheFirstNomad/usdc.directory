import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CATEGORIES, CATEGORY_EMOJIS, REGIONS, REGION_FLAGS } from "@/lib/partners";

interface CategoryFilterProps {
  selectedCategories: string[];
  onToggleCategory: (cat: string) => void;
  selectedRegions: string[];
  onToggleRegion: (region: string) => void;
  selectedNetworks: string[];
  onToggleNetwork: (network: string) => void;
  counts?: Record<string, number>;
}

const CategoryFilter = ({
  selectedCategories,
  onToggleCategory,
  selectedRegions,
  onToggleRegion,
  counts = {},
}: CategoryFilterProps) => {
  const [catOpen, setCatOpen] = useState(true);
  const [regOpen, setRegOpen] = useState(true);

  return (
    <div className="space-y-3">
      {/* Categories */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setCatOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
        >
          Categories
          {catOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {catOpen && (
          <div className="px-3 pb-3 space-y-0.5">
            {CATEGORIES.map((cat) => {
              const active = selectedCategories.includes(cat);
              const count = counts[cat];
              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory(cat)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>{CATEGORY_EMOJIS[cat] || "📦"}</span>
                    <span className="truncate">{cat}</span>
                  </span>
                  {count !== undefined && count > 0 && (
                    <span className={`ml-1 flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Regions */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setRegOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors"
        >
          Regions
          {regOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {regOpen && (
          <div className="px-3 pb-3 space-y-0.5">
            {REGIONS.map((r) => {
              const active = selectedRegions.includes(r);
              return (
                <button
                  key={r}
                  onClick={() => onToggleRegion(r)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span>{REGION_FLAGS[r] || "📍"}</span>
                  <span>{r}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
        <p className="text-xs font-medium text-foreground mb-1.5">Accept USDC?</p>
        <a href="/submit" className="text-xs text-primary font-semibold hover:underline">
          List your business for 1 USDC →
        </a>
      </div>
    </div>
  );
};

export default CategoryFilter;
