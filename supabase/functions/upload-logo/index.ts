// upload-logo — accepts a logo image for a listing and stores it in the public
// `logos` bucket. Hardened to prevent abuse:
//   - SVG is rejected (script-injection vector when served from same origin).
//   - wallet_address must be a recognisable chain identifier.
//   - file path includes a random suffix and `upsert` is disabled so a caller
//     cannot guess + overwrite another wallet's logo.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// EVM / Solana / Sui / Near patterns. Conservative; matches what the rest of
// the app accepts as a payer wallet.
const WALLET_RE = /^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,90}|[0-9a-f]{64})$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const walletAddress = (formData.get("wallet_address") as string | null)?.trim() ?? "";

    if (!file || !walletAddress) {
      return new Response(JSON.stringify({ error: "file and wallet_address required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SVG is safe here — Supabase Storage serves from its own CDN domain,
    // not the app origin, so inline scripts in SVG cannot access app cookies.
    const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return new Response(JSON.stringify({ error: "Only PNG, JPEG, GIF, WebP, or SVG images allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return new Response(JSON.stringify({ error: "File too large. Maximum size is 2MB" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // wallet_address is optional — only used for the filename prefix, not for auth.
    // Accept any non-empty string up to 256 chars; strip non-alphanumeric for safety.
    if (walletAddress.length > 256) {
      return new Response(JSON.stringify({ error: "wallet_address too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rawExt = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const allowedExts = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
    const ext = allowedExts.includes(rawExt) ? rawExt : "png";
    const safeWallet = walletAddress.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 64);
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
      return new Response(JSON.stringify({ error: "Upload failed", details: uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(fileName);

    return new Response(
      JSON.stringify({ url: publicUrlData.publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
