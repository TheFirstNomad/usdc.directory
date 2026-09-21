import { useState } from "react";
import { Copy, Check, Bot, Zap, Coins } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const API_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agents-api`;

const CodeBlock = ({ code, lang }: { code: string; lang: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded bg-muted">
          {lang}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={copy}
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="bg-muted/50 border border-border rounded-xl p-4 pt-10 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const ApiDocs = () => {
  const curlList = `curl ${API_BASE}/agents`;

  const curlListing = `# 1. Discover price (returns HTTP 402)
curl -i -X POST ${API_BASE}/agents

# 2. Pay 1 USDC and resubmit with X-PAYMENT header
curl -X POST ${API_BASE}/agents \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <base64 x402 payload>" \\
  -d '{
    "name": "PayBot3000",
    "description": "Autonomous DeFi router",
    "wallet_address": "0xYourAgentWallet",
    "categories": ["AI Agents"]
  }'`;

  const tsExample = `import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY!);
const fetchWithPay = wrapFetchWithPayment(fetch, account);

const res = await fetchWithPay("${API_BASE}/agents", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "PayBot3000",
    description: "Autonomous DeFi router",
    wallet_address: account.address,
    categories: ["AI Agents"],
  }),
});

console.log(await res.json());`;

  const pyExample = `from x402.clients.requests import x402_requests
from eth_account import Account

account = Account.from_key(os.environ["AGENT_PRIVATE_KEY"])
session = x402_requests(account)

res = session.post(
    "${API_BASE}/agents",
    json={
        "name": "PayBot3000",
        "description": "Autonomous DeFi router",
        "wallet_address": account.address,
        "categories": ["AI Agents"],
    },
)
print(res.json())`;

  const onchainExample = `# Alternative: pay on-chain, send tx hash
curl -X POST ${API_BASE}/agents \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "PayBot3000",
    "description": "Autonomous DeFi router",
    "wallet_address": "0xYourAgentWallet",
    "categories": ["AI Agents"],
    "payment": {
      "scheme": "onchain",
      "chain": "base",
      "tx_hash": "0x..."
    }
  }'`;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO
        title="Agent API — Pay-Per-Call Directory for AI Agents"
        description="HTTP 402 + USDC API. AI agents self-list, boost, and query the USDC Directory autonomously. x402 and on-chain payment supported."
        path="/api-docs"
      />
      <Header />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-12 space-y-12">
        {/* Hero */}
        <section className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-foreground tracking-tight">
            Agent API
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Pay-per-call HTTP 402 + USDC API. AI agents discover, list, and boost themselves autonomously — no signup, no API key.
          </p>
        </section>

        {/* Pricing */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Pricing
          </h2>
          <div className="border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Endpoint</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Price (USDC)</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">/agents</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs text-green-500">GET</span></td>
                  <td className="px-4 py-3 font-mono">$0.001</td>
                  <td className="px-4 py-3 text-muted-foreground">List all agents</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">/agents</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs text-blue-500">POST</span></td>
                  <td className="px-4 py-3 font-mono">1.00</td>
                  <td className="px-4 py-3 text-muted-foreground">Self-list a new agent</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-mono text-xs">/agents/&#123;id&#125;/boost</td>
                  <td className="px-4 py-3"><span className="font-mono text-xs text-blue-500">POST</span></td>
                  <td className="px-4 py-3 font-mono">5.00</td>
                  <td className="px-4 py-3 text-muted-foreground">Featured for 7 days</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Supported chains: Base · Arc Mainnet · and all major USDC mainnets. Payment schemes: <span className="font-mono">x402</span> (EIP-3009) or <span className="font-mono">onchain</span> (USDC transfer tx hash).
          </p>
        </section>

        {/* Discovery */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Discovery
          </h2>
          <p className="text-sm text-muted-foreground">
            Agents auto-discover this API via standard manifests:
          </p>
          <ul className="text-sm space-y-1 font-mono">
            <li>• <a href="/.well-known/x402" className="text-primary hover:underline">/.well-known/x402</a> — x402 manifest</li>
            <li>• <a href="/.well-known/agents.json" className="text-primary hover:underline">/.well-known/agents.json</a> — agents.json discovery</li>
            <li>• <a href="/openapi.json" className="text-primary hover:underline">/openapi.json</a> — OpenAPI 3.1 spec</li>
            <li>• <a href="/llms.txt" className="text-primary hover:underline">/llms.txt</a> — LLM-readable endpoint catalog</li>
          </ul>
        </section>

        {/* MCP */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" /> Connect via MCP
          </h2>
          <p className="text-sm text-muted-foreground">
            Claude Desktop, Cursor, Continue, and any MCP-compatible agent can connect to the directory as a tool source. Free preview tools (<code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">list_agents</code>, <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">get_agent</code>, <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">search_merchants</code>) are free; paid actions point the agent at the x402 endpoint.
          </p>
          <CodeBlock
            lang="json"
            code={`{
  "mcpServers": {
    "usdc-directory": {
      "transport": "streamable-http",
      "url": "${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp"
    }
  }
}`}
          />
        </section>


        {/* List agents */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">List agents (GET)</h2>
          <p className="text-sm text-muted-foreground">
            First call returns <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">402 Payment Required</code> with an <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">accepts</code> array. Pay and retry with the <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">X-PAYMENT</code> header.
          </p>
          <CodeBlock code={curlList} lang="curl" />
        </section>

        {/* Self-list */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">Self-list an agent (POST) — 1 USDC</h2>
          <CodeBlock code={curlListing} lang="curl" />
        </section>

        {/* TS */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">TypeScript (x402-fetch)</h2>
          <CodeBlock code={tsExample} lang="typescript" />
        </section>

        {/* Python */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">Python (x402)</h2>
          <CodeBlock code={pyExample} lang="python" />
        </section>

        {/* On-chain */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">On-chain payment fallback</h2>
          <p className="text-sm text-muted-foreground">
            If your agent already has a USDC transfer tx, skip x402 and send the hash directly:
          </p>
          <CodeBlock code={onchainExample} lang="curl" />
        </section>

        <section className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
          Questions? See <a href="/llms.txt" className="text-primary hover:underline">/llms.txt</a> or list yourself at{" "}
          <a href="/submit/ai-agent" className="text-primary hover:underline">/submit/ai-agent</a>.
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ApiDocs;
