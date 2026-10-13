import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyAdmin, ADMIN_CORS_HEADERS } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    ADMIN_CORS_HEADERS,
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (!(await verifyAdmin(req, supabase))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const [{ data: payments }, { data: boosts }] = await Promise.all([
    supabase.from("agent_api_payments").select("*").order("paid_at", { ascending: false }).limit(500),
    supabase.from("agent_boosts").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const paymentsList = payments || [];
  const boostsList = boosts || [];
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const sumUsdc = (rows: any[]) => rows.reduce((acc, r) => acc + Number(r.amount_usdc || 0), 0) / 1_000_000;

  const summary = {
    callsTotal: paymentsList.length,
    callsToday: paymentsList.filter((p: any) => new Date(p.paid_at).getTime() >= dayAgo).length,
    revenueApiTotal: sumUsdc(paymentsList),
    revenueApiMonth: sumUsdc(paymentsList.filter((p: any) => new Date(p.paid_at).getTime() >= monthStart)),
    boostsActive: boostsList.filter((b: any) => new Date(b.expires_at).getTime() > now).length,
    revenueBoostsTotal: sumUsdc(boostsList),
  };

  return new Response(JSON.stringify({ payments: paymentsList, boosts: boostsList, summary }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
