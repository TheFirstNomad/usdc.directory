/**
 * CommandPalette — ⌘K / Ctrl+K global search.
 * Powered by cmdk (already installed). Searches partners by name, category, region.
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, BadgeCheck, ArrowRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CATEGORY_EMOJIS } from "@/lib/partners";
import type { Partner } from "@/lib/partners";

interface CommandPaletteProps {
  partners: Partner[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ partners, open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Reset query on open
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenChange]);

  const results = useCallback(() => {
    if (!query || query.length < 1) return partners.slice(0, 8);
    const q = query.toLowerCase();
    return partners
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.categories.some((c) => c.toLowerCase().includes(q)) ||
          p.region.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [query, partners])();

  const go = (id: string) => {
    navigate(`/merchant/${id}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden rounded-2xl border-border/60 shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/60">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search merchants, categories, regions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
            onKeyDown={(e) => {
              if (e.key === "Escape") onOpenChange(false);
              if (e.key === "Enter" && results.length > 0) go(results[0].id);
            }}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border text-[10px] text-muted-foreground font-mono">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[380px] overflow-y-auto overscroll-contain">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No merchants found for "{query}"
            </div>
          ) : (
            <ul>
              {results.map((p) => {
                const logoUrl =
                  p.logo_url && p.logo_url !== ""
                    ? p.logo_url
                    : `https://logo.clearbit.com/${p.website?.replace(/https?:\/\//, "").replace(/\/.*/, "") || p.name.toLowerCase().replace(/\s+/g, "") + ".com"}`;
                const primaryCat = p.categories[0];
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => go(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
                    >
                      <img
                        src={logoUrl}
                        alt=""
                        className="w-8 h-8 rounded-lg object-contain bg-muted/50 p-0.5 flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = "https://cryptologos.cc/logos/usd-coin-usdc-logo.png";
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground truncate">{p.name}</span>
                          {p.featured && <BadgeCheck className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {primaryCat && `${CATEGORY_EMOJIS[primaryCat] || ""}  ${primaryCat} · `}{p.region}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border/60 px-4 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border font-mono">↵</kbd> open</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-border font-mono">esc</kbd> close</span>
          <span className="ml-auto">{results.length} result{results.length !== 1 ? "s" : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
