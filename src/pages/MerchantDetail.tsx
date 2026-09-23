import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BadgeCheck, ExternalLink, ArrowLeft, Copy, Check, Share2, Send, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Partner } from "@/lib/partners";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const chainColors: Record<string, string> = {
  Ethereum: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  Base: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  Solana: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  Polygon: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Arbitrum: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  Noble: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Avalanche: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const regionFlags: Record<string, string> = {
  Global: "🌍", "North America": "🇺🇸", "Latin America": "🌎",
  Europe: "🇪🇺", Africa: "🌍", "Asia Pacific": "🌏",
  "Middle East": "🕌", "Emerging Markets": "🚀",
};

const categoryColors: Record<string, string> = {
  "AI & Agentic Platforms": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Bridge Apps": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "Bridge SDKs": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "DeFi Apps": "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  "Digital Wallets": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  "Due Diligence & Advisory": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  "Ecommerce": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "Exchanges": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "Fintechs": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  "Gaming": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  "Infrastructure Providers": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  "Market Makers": "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  "Marketplaces": "bg-lime-100 text-lime-700 dark:bg-lime-900/30 dark:text-lime-300",
  "Neobanks": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  "OTC Desks": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "Payments": "bg-primary/10 text-primary",
  "PR & Communications": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  "Remittances": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Security": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
};

const MerchantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentPending, setPaymentPending] = useState(false);
  const [copied, setCopied] = useState(false);


  useEffect(() => {
    if (!id) return;
    supabase
      .from("partners_public" as any)
      .select("id, name, description, website, logo_url, logo_emoji, categories, region, use_cases, featured, created_at, usdc_score, networks")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setPartner(data as unknown as Partner);
        setLoading(false);
      });
  }, [id]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: partner?.name, url });
      } catch {
        // user cancelled or browser denied — fall back to copy
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied!", description: url });
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: url });
    }
  };

  const handleShareX = () => {
    const text = encodeURIComponent(
      `Check out ${partner?.name} on USDC Directory — accepting USDC worldwide 💵`
    );
    const url = encodeURIComponent(window.location.href);
    window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener");
  };

  const handleCopyAddress = () => {
    return;
  };

  const logoUrl = partner?.logo_url && partner.logo_url !== ""
    ? partner.logo_url
    : `https://logo.clearbit.com/${partner?.website?.replace(/https?:\/\//, "").replace(/\/.*/, "") || "circle.com"}`;

  const score = (partner as any)?.usdc_score ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Merchant Not Found</h1>
            <p className="text-muted-foreground mb-4">This listing doesn't exist or has been removed.</p>
            <Link to="/">
              <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Directory</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title={partner.name}
        description={partner.description}
        path={`/merchant/${id}`}
        image={`https://ddhytszijvfejnymrwgd.supabase.co/functions/v1/og-agent?id=${id}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: partner.name,
          description: partner.description,
          url: partner.website || undefined,
          logo: logoUrl,
          areaServed: partner.region,
          knowsAbout: partner.categories,
        }}
      />

      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Directory
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid md:grid-cols-3 gap-8"
        >
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            {/* Hero card */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="h-32 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center relative">
                {score >= 70 && (
                  <div className="absolute top-4 right-4 bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
                    Score: {score}/100
                  </div>
                )}
                <img
                  src={logoUrl}
                  alt={partner.name}
                  className="h-20 w-20 object-contain rounded-2xl bg-card p-2 shadow-md"
                  onError={(e) => {
                    e.currentTarget.src = "https://cryptologos.cc/logos/usd-coin-usdc-logo.png";
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-foreground">{partner.name}</h1>
                  {partner.featured && (
                    <BadgeCheck className="h-6 w-6 text-primary flex-shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <span>{regionFlags[partner.region] || "🌍"}</span>
                  <span>{partner.region}</span>
                  {partner.featured && (
                    <>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="text-primary font-medium">Verified Partner</span>
                    </>
                  )}
                </div>
                <p className="text-muted-foreground leading-relaxed">{partner.description}</p>
              </div>
            </div>

            {/* Categories */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3 text-sm">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {partner.categories.map((cat, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${categoryColors[cat] || "bg-muted text-muted-foreground"}`}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            {/* Chains */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3 text-sm">Supported Networks</h2>
              <div className="flex flex-wrap gap-2">
                {(((partner as any).networks as string[]) || []).map((chain, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${chainColors[chain] || "bg-muted text-muted-foreground"}`}
                  >
                    {chain}
                  </span>
                ))}
                {(!((partner as any).networks as string[]) || ((partner as any).networks as string[]).length === 0) && (
                  <span className="text-sm text-muted-foreground">No network data available</span>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Actions */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              {partner?.website && partner.website.trim() !== "" && (
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  asChild
                >
                  <a href={partner.website} target="_blank" rel="noopener noreferrer">
                    Visit Site <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}

              {/* Pay with USDC */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Send className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Pay with USDC</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Send USDC directly to this merchant via Base or Arc Mainnet.
                </p>
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-primary to-[hsl(275,80%,55%)] text-primary-foreground font-semibold rounded-lg"
                  onClick={() => {
                    window.location.href = `/swap?to=${encodeURIComponent(partner?.name || "")}`;
                  }}
                >
                  Send USDC →
                </Button>
              </div>

              {/* Share */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={handleShare}
                >
                  <Share2 className="h-3.5 w-3.5" /> Share
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={handleShareX}
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                      Post
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share on X (Twitter)</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Score card */}
            {score > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-foreground text-sm">USDC Score</h2>
                  <Link to="/leaderboard" className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Trophy className="h-3 w-3" /> Leaderboard
                  </Link>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="28" fill="none" strokeWidth="4" className="stroke-muted" />
                      <circle
                        cx="32" cy="32" r="28" fill="none" strokeWidth="4"
                        className="stroke-primary"
                        strokeDasharray={`${(score / 100) * 176} 176`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
                      {score}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-0.5">
                      {score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Building"}
                    </p>
                    <p>USDC integration strength across 5 dimensions.</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${score}%` }} />
                </div>
              </div>
            )}

            {/* Info */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground mb-3 text-sm">Details</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Region</dt>
                  <dd className="text-foreground font-medium">{partner.region || "Global"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Listed</dt>
                  <dd className="text-foreground font-medium">
                    {new Date(partner.created_at).toLocaleDateString()}
                  </dd>
                </div>
                {partner.verified && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="text-primary font-medium flex items-center gap-1">
                      <BadgeCheck className="h-3.5 w-3.5" /> Verified
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

export default MerchantDetail;
