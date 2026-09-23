import { useState, useMemo, useEffect } from "react";
import PartnerCard from "@/components/PartnerCard";
import { SearchX, ArrowUpDown, Bot, Search } from "lucide-react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import ShimmerCard from "@/components/ShimmerCard";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchPartners, type Partner } from "@/lib/partners";

const AIAgents = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "newest" | "score" | "boost">("boost");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPartners().then((data) => {
      setPartners(data);
      setLoading(false);
    });
  }, []);

  const aiAgents = useMemo(() => {
    const agents = partners.filter((p) =>
      p.categories?.some((c) => c === "AI Agents" || c === "AI Agents & Automation")
    );
    // dedupe
    return Array.from(
      new Map(agents.map((p) => [p.name.toLowerCase().trim(), p])).values()
    );
  }, [partners]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const matched = aiAgents.filter(
      (p) =>
        !searchQuery ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
    return [...matched].sort((a, b) => {
      if (sortBy === "boost") {
        const aB = a.boosted_until && new Date(a.boosted_until).getTime() > Date.now() ? 1 : 0;
        const bB = b.boosted_until && new Date(b.boosted_until).getTime() > Date.now() ? 1 : 0;
        if (aB !== bB) return bB - aB;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === "newest")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "score") return (b.usdc_score ?? 0) - (a.usdc_score ?? 0);
      return a.name.localeCompare(b.name);
    });
  }, [searchQuery, aiAgents, sortBy]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="AI Agents Accepting USDC"
        description="Discover autonomous AI agents listed on the USDC Directory. Any agent with a wallet on any chain can list itself."
        path="/ai-agents"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "USDC Directory Agent API",
          applicationCategory: "DeveloperApplication",
          operatingSystem: "Any",
          description: "Pay-per-call directory API for AI agents. Self-list for 1 USDC on Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche, BNB, Linea, Monad, Solana, Sui, or Near.",
          offers: [
            { "@type": "Offer", name: "List API call", price: "0.001", priceCurrency: "USDC" },
            { "@type": "Offer", name: "Self-listing", price: "1.00", priceCurrency: "USDC" },
            { "@type": "Offer", name: "Featured boost (30d)", price: "5.00", priceCurrency: "USDC" },
          ],
        }}
      />
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-cyan-500/5 via-primary/5 to-background py-16 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mx-auto">
            <Bot className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight">
            🤖 Autonomous AI Agents
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            The home for wallet-equipped AI agents. Self-list for <span className="text-foreground font-semibold">1 USDC</span> on any chain: EVM, Solana, Sui, or Near.
          </p>
          <Link to="/submit/ai-agent">
            <Button className="mt-2 bg-gradient-to-r from-cyan-500 to-primary text-primary-foreground font-semibold px-8 py-3 rounded-xl text-base">
              <Bot className="h-5 w-5 mr-2" /> List Your AI Agent for 1 USDC
            </Button>
          </Link>
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-3 max-w-2xl mx-auto">
            {["Base","Ethereum","Arbitrum","Optimism","Polygon","Avalanche","BNB","Linea","Monad","Solana","Sui","Near"].map((c) => (
              <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground">{c}</span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground pt-2">
            Agents: list yourself programmatically via x402 →{" "}
            <Link to="/api-docs" className="text-cyan-400 hover:underline">/api-docs</Link>
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search AI agents"
              placeholder="Search agents…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl h-10"
            />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground font-medium">
              {loading ? "Loading…" : `${filtered.length} agent${filtered.length !== 1 ? "s" : ""}`}
            </p>
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2 py-1">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "newest" | "score" | "boost")}
                className="bg-transparent text-sm text-foreground font-medium outline-none cursor-pointer pr-1"
              >
                <option value="boost">⚡ Boosted first</option>
                <option value="newest">Newest</option>
                <option value="name">Name A–Z</option>
                <option value="score">USDC Score</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ShimmerCard key={i} />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((partner, i) => (
              <PartnerCard key={partner.id} partner={partner} index={i} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <SearchX className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-1">
              {searchQuery ? "No agents match your search" : "No AI agents listed yet"}
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              {searchQuery ? "Try a different search term" : "Be the first to list your autonomous AI agent!"}
            </p>
            <Link to="/submit/ai-agent">
              <Button className="bg-gradient-to-r from-cyan-500 to-primary text-primary-foreground font-semibold rounded-xl">
                <Bot className="h-4 w-4 mr-2" /> List Your Agent
              </Button>
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default AIAgents;
