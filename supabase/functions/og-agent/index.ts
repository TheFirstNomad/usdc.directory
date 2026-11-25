import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resvg, initWasm } from "https://esm.sh/@resvg/resvg-wasm";

let wasmReady: Promise<void> | null = null;
function ensureWasm() {
  if (!wasmReady) {
    wasmReady = fetch("https://esm.sh/@resvg/resvg-wasm/index_bg.wasm")
      .then((r) => r.arrayBuffer())
      .then((b) => initWasm(b));
  }
  return wasmReady;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string): string {
  return (s || "").replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!)
  );
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = (text || "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    } else {
      cur = (cur ? cur + " " : "") + w;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,3}$/, "…");
  }
  return lines;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id") || url.pathname.split("/").pop() || "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data } = await supabase
      .from("partners_public")
      .select("name, description, logo_emoji, categories, usdc_score")
      .eq("id", id)
      .maybeSingle();

    // Truncate BEFORE escaping so an entity (e.g. &amp;) is never cut in half.
    const name = escapeXml(String(data?.name || "USDC Directory").slice(0, 28));
    const emoji = escapeXml(String(data?.logo_emoji || "🤖").slice(0, 8));
    const cats = (data?.categories || []).slice(0, 3).join(" · ");
    const score = data?.usdc_score ?? 0;
    const descLines = wrap(data?.description || "Discover businesses, AI agents, and apps accepting USDC.", 60, 3);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a1628"/>
      <stop offset="100%" stop-color="#0d2845"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2775C9"/>
      <stop offset="100%" stop-color="#5cbdff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1050" cy="120" r="180" fill="#2775C9" opacity="0.15"/>
  <circle cx="120" cy="540" r="140" fill="#5cbdff" opacity="0.1"/>
  <text x="80" y="120" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="36" fill="#5cbdff" font-weight="600">USDC Directory</text>
  <text x="80" y="180" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="120">${emoji}</text>
  <text x="80" y="360" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="72" fill="#ffffff" font-weight="800">${name}</text>
  ${descLines.map((l, i) => `<text x="80" y="${430 + i * 44}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="30" fill="#cbd5e1">${escapeXml(l)}</text>`).join("\n  ")}
  <rect x="80" y="560" width="${Math.max(120, cats.length * 12 + 40)}" height="48" rx="24" fill="url(#accent)"/>
  <text x="${80 + Math.max(60, (cats.length * 12 + 40) / 2)}" y="592" font-family="system-ui, sans-serif" font-size="22" fill="#ffffff" text-anchor="middle" font-weight="600">${escapeXml(cats || "USDC")}</text>
  <text x="1120" y="592" font-family="system-ui, sans-serif" font-size="28" fill="#5cbdff" text-anchor="end" font-weight="700">Score ${score}</text>
</svg>`;

    const wantsSvg = url.searchParams.get("format") === "svg";
    if (wantsSvg) {
      return new Response(svg, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      });
    }

    await ensureWasm();
    const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
      .render()
      .asPng();

    return new Response(png, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (err) {
    console.error("og-agent error", err);
    return new Response("error", { status: 500, headers: corsHeaders });
  }
});
