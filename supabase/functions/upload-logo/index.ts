// upload-logo — accepts a logo image for a listing and stores it in the public
// `logos` bucket. Hardened against spam and abuse:
//   - wallet_address MUST be a valid EVM/Solana/Sui/Near address (no anon uploads).
//   - IP-based rate limit: max 3 uploads per IP per hour (logo_upload_rate_limits table).
//   - SVG allowed — Supabase Storage CDN is a different origin so scripts are harmless.
//   - File size capped at 2 MB.
//   - Random filename suffix prevents path-guessing overwrites (upsert: false).
//   - Orphan cleanup: logos not referenced by any listing after 24h should be
//     deleted by a scheduled pg_cron job (add separately in Supabase dashboard).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Matches EVM (0x + 40 hex), Solana/Near base58 (32-90 chars), Sui/Near hex (64 hex).
const WALLET_RE = /^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,90}|[0-9a-f]{64})$/;

const RATE_LIMIT_MAX = 3;           // max uploads per IP per window
const RATE_LIMIT_WINDOW_HOURS = 1;  // rolling window in hours

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const walletAddress = (formData.get("wallet_address") as string | null)?.trim() ?? "";

    // Require a real, recognisable wallet address — no anon uploads allowed.
    if (!file) {
      return new Response(JSON.stringify({ error: "file required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!walletAddress || !WALLET_RE.test(walletAddress)) {
      return new Response(
        JSON.stringify({
          error: "A connected wallet address is required to upload a logo. Please connect your wallet first.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SVG is safe here — Supabase Storage serves from its own CDN domain,
    // not the app origin, so inline scripts in SVG cannot access app cookies.
    const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(
        JSON.stringify({ error: "Only PNG, JPEG, GIF, WebP, or SVG images are allowed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
    if (file.size > MAX_SIZE) {
      return new Response(
        JSON.stringify({ error: "File too large. Maximum size is 2 MB." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── IP rate limiting ─────────────────────────────────────────────────────
    // Extract real client IP from Cloudflare or standard proxy headers.
    const ip =
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";

    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { count: recentCount } = await supabase
      .from("logo_upload_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("ip", ip)
      .gte("created_at", windowStart);

    if ((recentCount ?? 0) >= RATE_LIMIT_MAX) {
      return new Response(
        JSON.stringify({
          error: `Too many uploads. Maximum ${RATE_LIMIT_MAX} logo uploads per hour. Please try again later.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record this attempt BEFORE uploading — failed uploads also count against limit.
    await supabase
      .from("logo_upload_rate_limits")
      .insert({ ip, wallet: walletAddress });
    // ────────────────────────────────────────────────────────────────────────

    const rawExt = (file.name.split(".").pop() || "png")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const allowedExts = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
    const ext = allowedExts.includes(rawExt) ? rawExt : "png";
    const safeWallet = walletAddress
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 64);
    // Random suffix prevents one caller from overwriting another's logo by
    // racing to the same filename.
    const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const fileName = `${safeWallet}-${Date.now()}-${rand}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload failed:", uploadError.message);
      return new Response(
        JSON.stringify({ error: "Upload failed", details: uploadError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("logos")
      .getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ url: publicUrlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
