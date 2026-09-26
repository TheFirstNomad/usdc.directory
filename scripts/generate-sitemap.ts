// Runs before vite dev/build via predev/prebuild; writes public/sitemap.xml
// with every confirmed merchant + static routes pulled from Supabase.
import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://usdc.directory";
const SUPABASE_URL = "https://ddhytszijvfejnymrwgd.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkaHl0c3ppanZmZWpueW1yd2dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTEwNjAsImV4cCI6MjA4ODk4NzA2MH0.P6qgW1Zx75tJs4BxnE82sGoxdSOhsJMNANGSj9dfgtw";

const STATIC: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/about", priority: "0.7", changefreq: "monthly" },
  { path: "/submit", priority: "0.8", changefreq: "monthly" },
  { path: "/submit/ai-agent", priority: "0.7", changefreq: "monthly" },
  { path: "/ai-agents", priority: "0.8", changefreq: "weekly" },
  { path: "/api-docs", priority: "0.7", changefreq: "monthly" },
  { path: "/insights", priority: "0.7", changefreq: "weekly" },
  { path: "/map", priority: "0.6", changefreq: "monthly" },
  { path: "/acquire", priority: "0.6", changefreq: "monthly" },
  { path: "/license", priority: "0.6", changefreq: "monthly" },
];

interface Row {
  id: string;
  updated_at?: string | null;
  created_at?: string | null;
}

async function fetchAllMerchants(): Promise<Row[]> {
  const PAGE = 1000;
  const out: Row[] = [];
  for (let from = 0; from < 20000; from += PAGE) {
    const url = `${SUPABASE_URL}/rest/v1/partners_public?select=id,updated_at,created_at&order=created_at.desc&offset=${from}&limit=${PAGE}`;
    const res = await fetch(url, {
      headers: { apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) {
      console.warn(`sitemap: page ${from} failed (${res.status})`);
      break;
    }
    const rows = (await res.json()) as Row[];
    if (!rows.length) break;
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function entry(loc: string, lastmod: string, changefreq: string, priority: string) {
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

async function main() {
  const now = new Date().toISOString();
  let merchants: Row[] = [];
  try {
    merchants = await fetchAllMerchants();
  } catch (err) {
    console.warn("sitemap: fetch failed, writing static-only sitemap", err);
  }

  const lines: string[] = [];
  for (const s of STATIC) lines.push(entry(`${BASE_URL}${s.path}`, now, s.changefreq, s.priority));
  for (const m of merchants) {
    const lastmod = m.updated_at || m.created_at || now;
    lines.push(entry(`${BASE_URL}/merchant/${m.id}`, lastmod, "weekly", "0.6"));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lines.join("\n")}\n</urlset>\n`;
  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`sitemap.xml written: ${STATIC.length} static + ${merchants.length} merchants = ${STATIC.length + merchants.length} URLs`);
}

main().catch((err) => {
  console.error("sitemap generation failed:", err);
  process.exit(0); // never block build
});
