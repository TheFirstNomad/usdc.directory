// Boost a listing for 30 days. Frontend pays 5 USDC on-chain first, then calls this.
// The payment transaction is verified on-chain (and de-duplicated) before the
// boost is applied — an unverified tx hash is never accepted.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyUsdcPayment, normalizeChainKey } from "../_shared/payment-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOOST_FEE_UNITS = 5_000_000n; // 5 USDC (6 decimals)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { partner_id, wallet_address, payment_tx, chain } = await req.json();
    if (!partner_id || !wallet_address || !payment_tx) {
      return json({ error: "partner_id, wallet_address, payment_tx required" }, 400);
    }
    if (typeof payment_tx !== "string" || payment_tx.length > 120) {
      return json({ error: "Invalid payment_tx" }, 400);
    }

    const chainKey = normalizeChainKey(chain ?? "arc");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Ownership check
    const { data: partner, error: pErr } = await supabase
      .from("partners")
      .select("id, wallet_address")
      .eq("id", partner_id)
      .single();

    if (pErr || !partner) return json({ error: "Listing not found" }, 404);

    // Reject a payment transaction that was already used for a boost
    const { data: existing } = await supabase
      .from("agent_boosts")
      .select("id")
      .eq("payment_id", payment_tx)
      .maybeSingle();
    if (existing) return json({ error: "This payment has already been used for a boost" }, 409);

    // Verify the on-chain USDC transfer to the treasury
    const verified = await verifyUsdcPayment(chainKey, payment_tx, BOOST_FEE_UNITS);
    if (!verified.ok) {
      console.warn("boost-listing payment verification failed:", verified.error);
      return json({ error: `Payment verification failed: ${verified.error}` }, 402);
    }

    // Authorisation is bound to the wallet that actually sent the funds on-chain.
    // The client-supplied wallet_address is never trusted for ownership.
    const verifiedPayer = String(verified.payer ?? "").toLowerCase();
    if (!verifiedPayer || verifiedPayer === "unknown") {
      return json({ error: "Could not determine the paying wallet from the transaction" }, 402);
    }
    if ((partner.wallet_address || "").toLowerCase() !== verifiedPayer) {
      return json({ error: "The paying wallet is not the owner of this listing" }, 403);
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error: bErr } = await supabase.from("agent_boosts").insert({
      partner_id,
      chain: chainKey,
      amount_usdc: 5_000_000,
      payment_id: payment_tx,
      expires_at: expiresAt,
    });
    if (bErr) {
      console.error("Boost record insert failed:", bErr.message);
      return json({ error: "Failed to apply boost" }, 500);
    }

    const { error: uErr } = await supabase
      .from("partners")
      .update({ boosted_until: expiresAt })
      .eq("id", partner_id);

    if (uErr) {
      console.error("Boost update failed:", uErr.message);
      return json({ error: "Failed to apply boost" }, 500);
    }

    return json({ id: partner_id, boosted_until: expiresAt });
  } catch (err) {
    console.error("boost-listing error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
