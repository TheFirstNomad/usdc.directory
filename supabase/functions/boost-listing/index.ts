// Get Featured: list your business in the Featured carousel for 30 days.
// Payment is 25 USDC on-chain. The transaction is verified on-chain (amounts
// normalised to 6-decimal USDC, so BNB's 18-decimal USDC cannot underpay), is
// consumed exactly once across ALL paid features, and only then is the boost
// applied. Paying sets featured=true automatically, no admin action needed.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyUsdcPayment, claimPayment, releasePayment, normalizeChainKey } from "../_shared/payment-verify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOOST_FEE_UNITS = 25_000_000n; // 25 USDC (6-decimal base units)
const MAX_FEATURED_SLOTS = 8;
const BOOST_DAYS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (typeof partner_id !== "string" || !UUID_RE.test(partner_id)) {
      return json({ error: "Invalid partner_id" }, 400);
    }
    if (typeof payment_tx !== "string" || payment_tx.length < 16 || payment_tx.length > 120) {
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
      .select("id, wallet_address, featured, boosted_until")
      .eq("id", partner_id)
      .single();
    if (pErr || !partner) return json({ error: "Listing not found" }, 404);

    // Cheap early rejection of an already-used boost payment.
    const { data: existing } = await supabase
      .from("agent_boosts")
      .select("id")
      .eq("payment_id", payment_tx)
      .maybeSingle();
    if (existing) return json({ error: "This payment has already been used for a boost" }, 409);

    // Active featured slots, not counting this listing (it may already hold one).
    const countActive = async () => {
      const now = new Date().toISOString();
      const { count } = await supabase
        .from("partners")
        .select("id", { count: "exact", head: true })
        .eq("featured", true)
        .neq("id", partner_id)
        .or(`boosted_until.is.null,boosted_until.gt.${now}`);
      return count ?? 0;
    };
    if ((await countActive()) >= MAX_FEATURED_SLOTS) {
      return json({ error: `All ${MAX_FEATURED_SLOTS} featured slots are currently taken. Check back soon or contact us.` }, 409);
    }

    // Verify the on-chain USDC transfer to the treasury
    const verified = await verifyUsdcPayment(chainKey, payment_tx, BOOST_FEE_UNITS, { signerHint: wallet_address });
    if (!verified.ok) {
      console.warn("boost-listing payment verification failed:", verified.error);
      return json({ error: `Payment verification failed: ${verified.error}` }, 402);
    }

    // Auth: the payer wallet must match the listing owner
    const verifiedPayer = String(verified.payer ?? "").toLowerCase();
    if (!verifiedPayer || verifiedPayer === "unknown") {
      return json({ error: "Could not determine the paying wallet from the transaction" }, 402);
    }
    if ((partner.wallet_address || "").toLowerCase() !== verifiedPayer) {
      return json({ error: "The paying wallet is not the owner of this listing" }, 403);
    }

    // Consume the transaction exactly once across every paid feature.
    const claim = await claimPayment(supabase, chainKey, payment_tx, "boost-listing");
    if (!claim.ok) {
      return claim.reason === "used"
        ? json({ error: "This transaction was already used for a paid action" }, 409)
        : json({ error: "Payment ledger unavailable, please retry shortly" }, 503);
    }

    // Re-check the slot cap now that the payment is claimed (closes the race window).
    if ((await countActive()) >= MAX_FEATURED_SLOTS) {
      await releasePayment(supabase, chainKey, payment_tx);
      return json({ error: "The last featured slot was just taken. Your payment was not used; retry later or contact us." }, 409);
    }

    // A boost on an already-boosted listing extends the window instead of resetting it.
    const currentEnd = partner.boosted_until ? new Date(partner.boosted_until).getTime() : 0;
    const base = Math.max(Date.now(), Number.isFinite(currentEnd) ? currentEnd : 0);
    const expiresAt = new Date(base + BOOST_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Record the boost (micro-USDC base units, same unit as the agent API).
    const { error: bErr } = await supabase.from("agent_boosts").insert({
      partner_id,
      chain: chainKey,
      amount_usdc: BOOST_FEE_UNITS.toString(),
      payment_id: payment_tx,
      expires_at: expiresAt,
    });
    if (bErr) {
      console.error("Boost record insert failed:", bErr.message);
      await releasePayment(supabase, chainKey, payment_tx);
      return json({ error: "Failed to apply boost. Your payment was not used; please retry." }, 500);
    }

    // Set featured=true and boosted_until: paying = carousel slot automatically
    const { error: uErr } = await supabase
      .from("partners")
      .update({ featured: true, boosted_until: expiresAt })
      .eq("id", partner_id);
    if (uErr) {
      console.error("Boost update failed:", uErr.message);
      await supabase.from("agent_boosts").delete().eq("payment_id", payment_tx);
      await releasePayment(supabase, chainKey, payment_tx);
      return json({ error: "Failed to apply boost. Your payment was not used; please retry." }, 500);
    }

    return json({ id: partner_id, boosted_until: expiresAt, featured: true });
  } catch (err) {
    console.error("boost-listing error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
