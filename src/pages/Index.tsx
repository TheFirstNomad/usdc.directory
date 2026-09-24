import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SearchX, ArrowUpDown, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import ShimmerCard from "@/components/ShimmerCard";
import FeaturedCarousel from "@/components/FeaturedCarousel";
import CategoryFilter from "@/components/CategoryFilter";

import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import HeroSection from "@/components/HeroSection";
import PartnerCard from "@/components/PartnerCard";
import { fetchPartners, type Partner } from "@/lib/partners";
import USDCStatsTicker from "@/components/USDCStatsTicker";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "newest" | "score">("newest");

  // React Query caches partners across routes so revisits are instant.
  const { data: partners = [], isLoading: loading } = useQuery<Partner[]>({
    queryKey: ["partners"],
    queryFn: fetchPartners,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const uniquePartners = useMemo(() => {
    return Array.from(
      new Map(partners.map((p) => [p.name.toLowerCase().trim(), p])).values()
    );
  }, [partners]);

  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  const toggleRegion = (region: string) =>
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  const toggleNetwork = (network: string) =>
    setSelectedNetworks((prev) =>
      prev.includes(network) ? prev.filter((n) => n !== network) : [...prev, network]
    );

  const featuredPartners = useMemo(() => uniquePartners.filter((p) => p.featured), [uniquePartners]);
  const partnerNames = useMemo(() => uniquePartners.map((p) => p.name), [uniquePartners]);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    uniquePartners.forEach((p) => {
      p.categories.forEach((c) => {
        counts[c] = (counts[c] ?? 0) + 1;
      });
    });
    return counts;
  }, [uniquePartners]);

  const filteredPartners = useMemo(() => {
    const filtered = uniquePartners.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.categories.some((c) => c.toLowerCase().includes(q)) ||
        p.region.toLowerCase().includes(q);
      const matchesCategory =
        selectedCategories.length === 0 ||
        p.categories.some((c) => selectedCategories.includes(c));
      const matchesRegion =
        selectedRegions.length === 0 || selectedRegions.includes(p.region);
      const matchesNetwork =
        selectedNetworks.length === 0 ||
        p.use_cases.some((uc) => selectedNetworks.includes(uc));
      return matchesSearch && matchesCategory && matchesRegion && matchesNetwork;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "score") return (b.usdc_score ?? 0) - (a.usdc_score ?? 0);
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, selectedCategories, selectedRegions, selectedNetworks, uniquePartners, sortBy]);

  const clearAll = () => {
    setSelectedCategories([]);
    setSelectedRegions([]);
    setSelectedNetworks([]);
    setSearchQuery("");
  };

  const hasFilters =
    selectedCategories.length > 0 ||
    selectedRegions.length > 0 ||
    selectedNetworks.length > 0 ||
    searchQuery.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO path="/" />
      <Header partners={uniquePartners} />
      <USDCStatsTicker partnerCount={uniquePartners.length} />
      <HeroSection
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearch={() => {}}
        partnerCount={uniquePartners.length}
        onCategorySelect={toggleCategory}
        selectedCategories={selectedCategories}
        partnerNames={partnerNames}
      />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        <FeaturedCarousel partners={featuredPartners} />

        <Link to="/submit/ai-agent" className="block mt-4">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500/10 via-primary/10 to-violet-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-all p-6 md:p-8 group">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-7 w-7 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-xl font-bold text-foreground">🤖 The Home for Autonomous AI Agents</h2>
                <p className="text-sm text-muted-foreground mt-0.5">List yourself in seconds: any chain, any wallet, instant approval</p>
              </div>
              <div className="hidden sm:block">
                <span className="inline-flex items-center gap-2 bg-cyan-500/10 text-cyan-400 font-semibold text-sm px-5 py-2.5 rounded-xl group-hover:bg-cyan-500/20 transition-colors">
                  List AI Agent →
                </span>
              </div>
            </div>
          </div>
        </Link>

        <div className="flex flex-col lg:flex-row gap-8 mt-4">
          <aside className="lg:w-60 flex-shrink-0">
            <CategoryFilter
              selectedCategories={selectedCategories}
              onToggleCategory={toggleCategory}
              selectedRegions={selectedRegions}
              onToggleRegion={toggleRegion}
              selectedNetworks={selectedNetworks}
              onToggleNetwork={toggleNetwork}
              counts={categoryCounts}
            />
          </aside>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-muted-foreground font-medium">
                {loading ? "Loading…" : `${filteredPartners.length} merchants`}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg pl-2.5">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as "name" | "newest" | "score")}>
                    <SelectTrigger className="h-8 border-0 bg-transparent text-sm font-medium focus:ring-0 focus:ring-offset-0 px-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="name">Name A-Z</SelectItem>
                      <SelectItem value="score">USDC Score</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasFilters && (
                  <button onClick={clearAll} className="text-xs text-primary hover:underline font-medium">
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <ShimmerCard key={i} />
                ))}
              </div>
            ) : filteredPartners.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredPartners.map((partner, i) => (
                  <PartnerCard key={partner.id} partner={partner} index={i} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <SearchX className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold text-foreground mb-1">No merchants found</p>
                <p className="text-sm text-muted-foreground mb-5">Try adjusting your search or filters</p>
                <Button variant="outline" onClick={clearAll}>Clear Filters</Button>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
