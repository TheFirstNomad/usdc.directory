import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyAdmin } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-address, x-admin-timestamp, x-admin-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("partners")
        .select("id, name, logo_url, logo_emoji, website, categories, region, featured, created_at")
        .order("name", { ascending: true });

      if (error) throw error;

      const featuredCount = (data || []).filter((p: any) => p.featured).length;
      return new Response(
        JSON.stringify({ partners: data || [], featuredCount }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (req.method === "POST") {
      const { partnerId, featured } = await req.json();

      if (!partnerId || typeof featured !== "boolean") {
        return new Response(
          JSON.stringify({ error: "partnerId and featured (boolean) required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (featured) {
        const { count } = await supabase
          .from("partners")
          .select("id", { count: "exact", head: true })
          .eq("featured", true);

        if ((count ?? 0) >= 8) {
          return new Response(
            JSON.stringify({ error: "Maximum 8 featured listings allowed. Unfeature one first." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const { error } = await supabase
        .from("partners")
        .update({ featured, updated_at: new Date().toISOString() })
        .eq("id", partnerId);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
