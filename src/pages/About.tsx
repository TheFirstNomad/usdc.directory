import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const stats = [
  { value: "$78B+", label: "Market Cap", desc: "In global circulation" },
  { value: "30+", label: "Blockchains", desc: "Native multichain support" },
  { value: "$69T+", label: "All-Time Volume", desc: "Transferred on-chain" },
  { value: "300+", label: "Partners", desc: "Circle Alliance members" },
];

const useCases = [
  {
    title: "Remittances",
    desc: "Send money across borders instantly with near-zero fees using USDC.",
    emoji: "🌍",
  },
  {
    title: "Payroll",
    desc: "Pay global teams in digital dollars — instant settlement, no intermediaries.",
    emoji: "💼",
  },
  {
    title: "Merchant Payments",
    desc: "Accept USDC at point-of-sale or online, then convert to local currency instantly.",
    emoji: "🛒",
  },
  {
    title: "DeFi & Yield",
    desc: "Earn yield on USDC through lending, liquidity provision, and structured products.",
    emoji: "📈",
  },
  {
    title: "AI Payments",
    desc: "Enable AI agents to make and receive instant micropayments via USDC.",
    emoji: "🤖",
  },
  {
    title: "Real-World Assets",
    desc: "Tokenize and settle real-world assets with the stability of USDC.",
    emoji: "🏢",
  },
];

const About = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="About USDC"
        description="Learn about USDC, the world's leading regulated digital dollar, backed 1:1 by cash and U.S. Treasuries, issued by Circle."
        path="/about"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About USDC",
          url: "https://usdc.directory/about",
          description: "Learn about USDC — the world's leading regulated digital dollar.",
        }}
      />
      <Header />

      <section className="bg-hero py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold text-hero-foreground mb-4">
            About USDC
          </h1>
          <p className="text-hero-muted text-lg max-w-2xl mx-auto leading-relaxed">
            USDC is the world's leading regulated digital dollar — fully backed 1:1 by cash and
            short-dated U.S. Treasuries, issued by{" "}
            <a href="https://www.circle.com/" target="_blank" rel="noopener noreferrer" className="underline text-hero-foreground">
              Circle Internet Financial
            </a>.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {stats.map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-5 text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-primary">{s.value}</div>
              <div className="font-semibold text-foreground text-sm mt-1">{s.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Why USDC */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-2">Why USDC?</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            USDC is the most transparent and regulated stablecoin. Every USDC token is backed by
            reserves held in segregated accounts at regulated U.S. financial institutions, with
            monthly attestations by a Big Four accounting firm. With native support on 30+
            blockchains and Cross-Chain Transfer Protocol (CCTP) for seamless bridging, USDC is
            the digital dollar of choice for enterprises, fintechs, and developers worldwide.
          </p>
        </div>

        {/* Use Cases */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-foreground mb-6">Featured Use Cases</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {useCases.map((uc) => (
              <div key={uc.title} className="bg-card border border-border rounded-xl p-5">
                <div className="text-3xl mb-3">{uc.emoji}</div>
                <h3 className="font-semibold text-foreground mb-1">{uc.title}</h3>
                <p className="text-sm text-muted-foreground">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="bg-hero rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-hero-foreground mb-3">
            Ready to build with USDC?
          </h2>
          <p className="text-hero-muted mb-6 max-w-lg mx-auto">
            Join the Circle Alliance or start integrating USDC into your product today.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="https://www.circle.com/usdc" target="_blank" rel="noopener noreferrer">
              <Button className="bg-hero-foreground text-hero hover:bg-hero-foreground/90">
                Get USDC <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
            <a href="https://partners.circle.com/" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-hero-foreground/30 text-hero-foreground hover:bg-hero-foreground/10">
                Join Alliance <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default About;
