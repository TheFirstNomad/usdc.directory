// Admin Manage Listings edge function — full CRUD for the partners table
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyAdmin, OWNER_WALLET, ADMIN_CORS_HEADERS } from "../_shared/admin-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    ADMIN_CORS_HEADERS,
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
    const adminAddress = req.headers.get("x-admin-address")!.toLowerCase();
    const url = new URL(req.url);

    // GET — list partners, or audit log via ?resource=audit
    if (req.method === "GET") {
      if (url.searchParams.get("resource") === "audit") {
        const partnerId = url.searchParams.get("partner_id");
        let q = supabase
          .from("admin_audit_log")
          .select("id, admin_address, action, partner_id, partner_name, reason, metadata, created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        if (partnerId) q = q.eq("partner_id", partnerId);
        const { data, error } = await q;
        if (error) throw error;
        return new Response(JSON.stringify({ entries: data || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("partners")
        .select("id, name, description, logo_url, logo_emoji, website, categories, region, featured, payment_status, created_at, networks, wallet_address")
        .order("name", { ascending: true })
        .range(0, 2999);

      if (error) throw error;
      return new Response(
        JSON.stringify({ partners: data || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST — bulk actions: { ids: string[], action: "approve"|"reject"|"delete", reason?: string }
    if (req.method === "POST") {
      const { ids, action, reason } = await req.json();
      if (!Array.isArray(ids) || ids.length === 0 || !action) {
        return new Response(JSON.stringify({ error: "ids[] and action required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!["approve", "reject", "delete"].includes(action)) {
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (action === "reject" && (!reason || !String(reason).trim())) {
        return new Response(JSON.stringify({ error: "reason required for reject" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Look up names for audit log
      const { data: rows } = await supabase.from("partners").select("id, name").in("id", ids);
      const nameMap = new Map((rows || []).map((r: any) => [r.id, r.name]));

      if (action === "delete") {
        await supabase.from("submissions").delete().in("partner_id", ids);
        const { error } = await supabase.from("partners").delete().in("id", ids);
        if (error) throw error;
      } else {
        const newStatus = action === "approve" ? "confirmed" : "rejected";
        const { error } = await supabase.from("partners")
          .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
          .in("id", ids);
        if (error) throw error;
        const subUpdate: Record<string, unknown> = { status: action === "approve" ? "approved" : "rejected" };
        if (action === "reject") subUpdate.reject_reason = String(reason).trim().slice(0, 500);
        await supabase.from("submissions").update(subUpdate).in("partner_id", ids);
      }

      const auditRows = ids.map((id: string) => ({
        admin_address: adminAddress,
        action: `bulk_${action}`,
        partner_id: id,
        partner_name: nameMap.get(id) || null,
        reason: action === "reject" ? String(reason).trim().slice(0, 500) : null,
        metadata: { count: ids.length },
      }));
      await supabase.from("admin_audit_log").insert(auditRows);

      return new Response(JSON.stringify({ success: true, affected: ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT — update a partner
    if (req.method === "PUT") {
      const { id, name, description, website, categories, region, featured, payment_status, action, reason } = await req.json();
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing partner id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (website !== undefined) updates.website = website;
      if (categories !== undefined) updates.categories = categories;
      if (region !== undefined) updates.region = region;
      if (featured !== undefined) updates.featured = featured;
      if (payment_status !== undefined) updates.payment_status = payment_status;

      let auditAction: string | null = null;
      let auditReason: string | null = null;

      if (action === "approve") {
        updates.payment_status = "confirmed";
        await supabase.from("submissions").update({ status: "approved", reject_reason: null }).eq("partner_id", id);
        auditAction = "approve";
      }
      if (action === "reject") {
        if (!reason || !String(reason).trim()) {
          return new Response(JSON.stringify({ error: "reason required for reject" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        auditReason = String(reason).trim().slice(0, 500);
        updates.payment_status = "rejected";
        await supabase.from("submissions").update({ status: "rejected", reject_reason: auditReason }).eq("partner_id", id);
        auditAction = "reject";
      }

      console.log("[admin-listings] PUT id:", id, "updates:", JSON.stringify(updates));
      const { data: partnerRow } = await supabase.from("partners").select("name").eq("id", id).maybeSingle();
      const { error, data: updateData } = await supabase.from("partners").update(updates).eq("id", id).select("id");
      console.log("[admin-listings] PUT result:", JSON.stringify({ error, updateData }));
      if (error) throw error;

      if (!auditAction) {
        if (featured !== undefined) auditAction = featured ? "feature" : "unfeature";
        else if (name !== undefined || description !== undefined || website !== undefined || categories !== undefined || region !== undefined) auditAction = "edit";
      }

      if (auditAction) {
        await supabase.from("admin_audit_log").insert({
          admin_address: adminAddress,
          action: auditAction,
          partner_id: id,
          partner_name: partnerRow?.name || null,
          reason: auditReason,
          metadata: { fields: Object.keys(updates).filter((k) => k !== "updated_at") },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE — delete a partner
    if (req.method === "DELETE") {
      const { id } = await req.json();
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing partner id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: partnerRow } = await supabase.from("partners").select("name").eq("id", id).maybeSingle();
      await supabase.from("submissions").delete().eq("partner_id", id);
      const { error } = await supabase.from("partners").delete().eq("id", id);
      if (error) throw error;

      await supabase.from("admin_audit_log").insert({
        admin_address: adminAddress,
        action: "delete",
        partner_id: id,
        partner_name: partnerRow?.name || null,
        reason: null,
        metadata: null,
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[admin-listings] Error:", err, (err as Error)?.message, (err as Error)?.stack);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
