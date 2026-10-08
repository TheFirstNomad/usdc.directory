import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { ExternalLink, FileJson, Radio, Wallet } from "lucide-react";

const X402_MANIFEST_URL = "https://usdc.directory/.well-known/x402";
const PAID_API_URL = "https://api.usdc.directory/agents";
const MCP_URL = "https://api.usdc.directory/mcp";
const OPENAPI_URL = "https://usdc.directory/openapi.json";

interface NetworkEntry {
  name: string;
  caip2: string;
  chainId: number;
  usdc: string;
  explorer: string;
}

/** The nine payment networks accepted by the live x402 manifest. */
const NETWORKS: NetworkEntry[] = [
  {
    name: "Base",
    caip2: "eip155:8453",
    chainId: 8453,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    explorer: "https://basescan.org",
  },
  {
    name: "Ethereum",
    caip2: "eip155:1",
    chainId: 1,
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    explorer: "https://etherscan.io",
  },
  {
    name: "Arbitrum",
    caip2: "eip155:42161",
    chainId: 42161,
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    explorer: "https://arbiscan.io",
  },
  {
    name: "Optimism",
    caip2: "eip155:10",
    chainId: 10,
    usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    explorer: "https://optimistic.etherscan.io",
  },
  {
    name: "Polygon",
    caip2: "eip155:137",
    chainId: 137,
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    explorer: "https://polygonscan.com",
  },
  {
    name: "Avalanche",
    caip2: "eip155:43114",
    chainId: 43114,
    usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    explorer: "https://snowtrace.io",
  },
  {
    name: "Unichain",
    caip2: "eip155:130",
    chainId: 130,
    usdc: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
    explorer: "https://uniscan.xyz",
  },
  {
    name: "World Chain",
    caip2: "eip155:480",
    chainId: 480,
    usdc: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1",
    explorer: "https://worldscan.org",
  },
  {
    name: "Sonic",
    caip2: "eip155:146",
    chainId: 146,
    usdc: "0x29219dd400f2Bf60E5a23d13Be72B486D4038894",
    explorer: "https://sonicscan.org",
  },
];

type CheckState = "checking" | "live" | "unreachable";

const StatusDot = ({ state }: { state: CheckState }) => (
  <span
    className={`h-2 w-2 rounded-full flex-shrink-0 ${
      state === "live"
        ? "bg-emerald-500 animate-pulse"
        : state === "checking"
        ? "bg-amber-500 animate-pulse"
        : "bg-amber-500"
    }`}
  />
);

const Status = () => {
  const [manifestState, setManifestState] = useState<CheckState>("checking");
  const [apiState, setApiState] = useState<CheckState>("checking");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // The x402 manifest is public: HTTP 200 means live.
      try {
        const res = await fetch("/.well-known/x402");
        if (!cancelled) setManifestState(res.ok ? "live" : "unreachable");
      } catch {
        if (!cancelled) setManifestState("unreachable");
      }
      // The paid API enforces x402: HTTP 402 (Payment Required) is its healthy state.
      try {
        const res = await fetch(PAID_API_URL, { method: "GET" });
        if (!cancelled) setApiState(res.status === 402 ? "live" : "unreachable");
      } catch {
        if (!cancelled) setApiState("unreachable");
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Network Status"
        description="Live status of the USDC Directory payment rails: nine supported USDC networks, the x402 payment manifest, and the paid agent API endpoint."
        path="/status"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "USDC Directory Network Status",
          url: "https://usdc.directory/status",
          description:
            "Nine supported USDC payment networks, the live x402 manifest, and the paid agent API endpoint.",
        }}
      />
      <Header />

      <section className="bg-hero py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold text-hero-foreground mb-4">
            Network Status
          </h1>
          <p className="text-hero-muted text-lg max-w-2xl mx-auto leading-relaxed">
            Every network, payment rail, and endpoint that powers USDC Directory
            listings and the x402 agent API — checked live from your browser.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        {/* Live endpoint checks */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          <div className="rounded-2xl border border-border bg-card p-5 flex items-start gap-4">
            <div className="mt-0.5">
              <StatusDot state={manifestState} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm mb-1">
                x402 Payment Manifest
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {manifestState === "live"
                  ? "Live — serving the current payment requirements."
                  : manifestState === "checking"
                  ? "Checking…"
                  : "Unreachable right now."}
              </p>
              <a
                href={X402_MANIFEST_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open manifest <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 flex items-start gap-4">
            <div className="mt-0.5">
              <StatusDot state={apiState} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm mb-1">
                Paid Agent API
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {apiState === "live"
                  ? "Live — enforcing x402 payment ($0.01 per call)."
                  : apiState === "checking"
                  ? "Checking…"
                  : "Unreachable right now."}
              </p>
              <a
                href={PAID_API_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Open endpoint <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Networks */}
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl font-bold text-foreground">
            Supported USDC Networks
          </h2>
          <span className="text-xs text-muted-foreground">
            {NETWORKS.length} networks
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {NETWORKS.map((n) => (
            <div
              key={n.caip2}
              className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-foreground text-sm">{n.name}</p>
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {n.caip2}
                </span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground truncate mb-3">
                {n.usdc}
              </p>
              <a
                href={`${n.explorer}/token/${n.usdc}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View USDC <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>

        {/* Developer rails */}
        <h2 className="text-xl font-bold text-foreground mb-5">
          Payment Rails & Discovery
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <a
            href={OPENAPI_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors group"
          >
            <FileJson className="h-5 w-5 text-primary mb-3" />
            <p className="font-semibold text-foreground text-sm mb-1">
              OpenAPI Specification
            </p>
            <p className="text-xs text-muted-foreground">
              Full API schema for the paid endpoints.
            </p>
          </a>
          <a
            href={MCP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors group"
          >
            <Radio className="h-5 w-5 text-primary mb-3" />
            <p className="font-semibold text-foreground text-sm mb-1">
              MCP Server
            </p>
            <p className="text-xs text-muted-foreground">
              Model Context Protocol endpoint for AI agents.
            </p>
          </a>
          <a
            href="/api-docs"
            className="rounded-2xl border border-border bg-card p-5 hover:border-primary/40 transition-colors group"
          >
            <Wallet className="h-5 w-5 text-primary mb-3" />
            <p className="font-semibold text-foreground text-sm mb-1">
              API Documentation
            </p>
            <p className="text-xs text-muted-foreground">
              How to pay, query, and self-list over x402.
            </p>
          </a>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Status;
