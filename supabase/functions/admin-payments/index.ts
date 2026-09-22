import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-address, x-admin-timestamp, x-admin-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!(await verifyAdmin(req, supabase))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    // DELETE handler
    if (req.method === "DELETE") {
      const { id } = await req.json();
      if (!id || typeof id !== "string") {
        return new Response(JSON.stringify({ error: "Missing submission id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: sub } = await supabase
        .from("submissions")
        .select("partner_id")
        .eq("id", id)
        .single();

      if (sub?.partner_id) {
        await supabase.from("partners").delete().eq("id", sub.partner_id);
      }

      const { error: delError } = await supabase
        .from("submissions")
        .delete()
        .eq("id", id);

      if (delError) {
        console.error("Delete error:", delError);
        return new Response(JSON.stringify({ error: "Failed to delete submission" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET handler
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const { data: submissions, error } = await supabase
      .from("submissions")
      .select("*")
      .gte("created_at", sixtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Query error:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const paidStatuses = ["confirmed", "finished", "sending"];
    const pendingStatuses = ["awaiting_payment", "confirming"];

    const paid = submissions?.filter((s: any) => paidStatuses.includes(s.payment_status)) || [];
    const pending = submissions?.filter((s: any) => pendingStatuses.includes(s.payment_status)) || [];

    const LISTING_FEE = 1;

    const revenueMonth = paid
      .filter((s: any) => s.created_at >= monthStart).length * LISTING_FEE;

    const totalRevenue = paid.length * LISTING_FEE;

    const summary = {
      revenueToday: paid.filter((s: any) => s.created_at >= todayStart).length * LISTING_FEE,
      revenueMonth,
      totalRevenue,
      totalPaid: paid.length,
      pendingCount: pending.length,
    };

    return new Response(
      JSON.stringify({ submissions: submissions || [], summary }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
