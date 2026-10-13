// Exchanges one fresh owner-wallet signature for a short-lived admin session token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { ADMIN_CORS_HEADERS, OWNER_WALLET, verifyAdminSignature } from "../_shared/admin-auth.ts";
import { createAdminSessionToken } from "../_shared/admin-session.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": ADMIN_CORS_HEADERS,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const secret = Deno.env.get("ADMIN_SESSION_SECRET");
    if (!secret) return json({ error: "Admin sessions not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    if (!(await verifyAdminSignature(req, supabase))) {
      return json({ error: "Unauthorized" }, 403);
    }
    const { token, expiresAt } = await createAdminSessionToken(secret, OWNER_WALLET);
    return json({ token, expiresAt });
  } catch (err) {
    console.error("admin-session error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
