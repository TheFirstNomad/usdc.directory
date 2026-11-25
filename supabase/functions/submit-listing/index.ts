/**
 * submit-listing — Persists a new listing or update after on-chain payment.
 *
 * Accepts payments on ANY supported chain (EVM mainnets + Solana + Sui + Near).
 * Fees: 3 USDC standard listing, 28 USDC featured listing, 1 USDC to update a listing.
 * Verification and single-use claiming live in ../_shared/payment-verify.ts.
 *
 * POST body:
 *   {
 *     type: "listing" | "update",
 *     tx_hash: string,        // chain-specific format
 *     chain: string,          // "base" | "ethereum" | ... | "solana" | "sui" | "near"
 *     wallet_address: string, // payer wallet (any format)
 *     data: { company_name, description, website, categories, region, logo_url, contact_email?, partner_id? }
 *   }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyUsdcPayment, claimPayment, releasePayment, normalizeChainKey, EVM_CHAINS, NON_EVM_KEYS } from "../_shared/payment-verify.ts";
import { safeHttpUrl, cleanText } from "../_shared/input-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEE_STANDARD    = 3_000_000n;  // 3 USDC — standard listing
const FEE_FEATURED    = 28_000_000n; // 28 USDC — featured listing (standard + 25 USDC carousel slot)
const FEE_UPDATE      = 1_000_000n;  // 1 USDC — edit an existing listing



const SUPPORTED_CHAINS = new Set<string>([...Object.keys(EVM_CHAINS), ...NON_EVM_KEYS]);


const ALLOWED_CATEGORIES = new Set([
  "AI & Agentic Platforms","Bridge Apps","Bridge SDKs","DeFi Apps","Digital Wallets",
  "Due Diligence & Advisory","Ecommerce","Exchanges","Fintechs","Gaming",
  "Infrastructure Providers","Market Makers","Marketplaces","Neobanks","OTC Desks",
  "Payments","PR & Communications","Remittances","Security","AI Agents",
]);
const ALLOWED_REGIONS = new Set([
  "Global","Africa","Europe","Asia","North America","South America","Other",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateData(data: any): { ok: true; out: any } | { ok: false; error: string } {
  if (!data || typeof data !== "object") return { ok: false, error: "Missing data" };
  const company_name = cleanText(data.company_name, 81);
  const description = cleanText(data.description, 501);
  if (company_name.length < 1 || company_name.length > 80) return { ok: false, error: "company_name 1-80 chars" };
  if (description.length < 1 || description.length > 500) return { ok: false, error: "description 1-500 chars" };

  let website: string | null = null;
  if (data.website) {
    // Bare domains like "monast.io" get https://; javascript:/data: and other schemes are rejected.
    website = safeHttpUrl(data.website, 200);
    if (!website) return { ok: false, error: "Invalid website URL: use https://yoursite.com" };
  }
  let contact_email: string | null = null;
  if (data.contact_email) {
    const e = String(data.contact_email).trim();
    if (e.length > 255 || !EMAIL_RE.test(e)) return { ok: false, error: "Invalid contact_email" };
    contact_email = e;
  }
  const categories: string[] = Array.isArray(data.categories) ? data.categories.map(String) : [];
  if (categories.length > 5) return { ok: false, error: "Max 5 categories" };
  for (const c of categories) if (!ALLOWED_CATEGORIES.has(c)) return { ok: false, error: `Invalid category: ${c}` };

  const region = data.region ? String(data.region) : "Global";
  if (!ALLOWED_REGIONS.has(region)) return { ok: false, error: `Invalid region: ${region}` };

  let logo_url: string | null = null;
  if (data.logo_url) {
    logo_url = safeHttpUrl(data.logo_url, 500);
    if (!logo_url) return { ok: false, error: "Invalid logo_url" };
  }
  const partner_id = data.partner_id ? String(data.partner_id) : undefined;
  return { ok: true, out: { company_name, description, website, contact_email, categories, region, logo_url, partner_id } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { type, tx_hash, wallet_address, data } = body ?? {};
    const chain = normalizeChainKey(body?.chain);
    const tier = String(body?.tier ?? "standard").toLowerCase() === "featured" ? "featured" : "standard";

    if (type !== "listing" && type !== "update")
      return json({ error: "type must be 'listing' or 'update'" }, 400);
    if (typeof tx_hash !== "string" || tx_hash.length < 16 || tx_hash.length > 200)
      return json({ error: "Invalid tx_hash" }, 400);
    if (!SUPPORTED_CHAINS.has(chain))
      return json({ error: `Unsupported chain '${chain}'. Supported: ${[...SUPPORTED_CHAINS].join(", ")}` }, 400);
    if (typeof wallet_address !== "string" || wallet_address.trim().length < 1 || wallet_address.length > 256)
      return json({ error: "Invalid wallet_address" }, 400);

    // Required on-chain amount for this request.
    const requiredFee =
      type === "update" ? FEE_UPDATE : tier === "featured" ? FEE_FEATURED : FEE_STANDARD;

    const dv = validateData(data);
    if (!dv.ok) return json({ error: dv.error }, 400);
    const { company_name, description, website, contact_email, categories, region, logo_url, partner_id } = dv.out;
    if (type === "update" && !partner_id) return json({ error: "partner_id required for updates" }, 400);

    // Note: wallet_address from the client is only a hint (used by the Near
    // verifier to locate the tx); it is never trusted for authorisation.
    const now = new Date().toISOString();

    // Dedupe by tx hash (scoped per chain in case formats overlap)
    const dedupKey = `${chain}:${tx_hash}`;
    const { data: dup } = await supabase
      .from("submissions")
      .select("id")
      .eq("payment_id", dedupKey)
      .maybeSingle();
    if (dup) return json({ error: "Transaction hash already used" }, 409);

    // ── Verify the on-chain payment (shared verifier: normalised amounts, all chains) ──
    const verification = await verifyUsdcPayment(chain, tx_hash, requiredFee, { signerHint: wallet_address });
    if (!verification.ok) return json({ error: `Payment verification failed: ${verification.error}` }, 402);

    // The wallet that actually sent the funds on-chain is the only identity we
    // trust. A client-supplied wallet_address is never used for authorisation.
    const verifiedPayer = String(verification.payer ?? "").toLowerCase();
    if (!verifiedPayer || verifiedPayer === "unknown")
      return json({ error: "Could not determine the paying wallet from the transaction" }, 402);

    // Updates: check ownership BEFORE consuming the payment, so a wrong wallet never burns a transfer.
    if (type === "update") {
      const { data: owner, error: ownerErr } = await supabase
        .from("partners").select("id, wallet_address").eq("id", partner_id!).maybeSingle();
      if (ownerErr || !owner) return json({ error: "Partner not found" }, 404);
      if ((owner.wallet_address || "").toLowerCase() !== verifiedPayer)
        return json({ error: "The paying wallet is not the owner of this listing" }, 403);
    }

    // Consume the transaction exactly once across every paid feature.
    const claim = await claimPayment(supabase, chain, tx_hash, `submit-listing:${type}`);
    if (!claim.ok) {
      return claim.reason === "used"
        ? json({ error: "Transaction hash already used" }, 409)
        : json({ error: "Payment ledger unavailable, please retry shortly" }, 503);
    }

    try {
    if (type === "listing") {
      const isFeatured = tier === "featured";
      const boostedUntil = isFeatured
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: newPartner, error: partnerErr } = await supabase
        .from("partners")
        .insert({
          name: company_name, description, website, categories, region, logo_url,
          wallet_address: verifiedPayer,
          payment_status: "confirmed",
          payment_id: dedupKey,
          networks: [chain],
          featured: isFeatured,
          ...(boostedUntil ? { boosted_until: boostedUntil } : {}),
        })
        .select("id")
        .single();

      if (partnerErr) { console.error("Partner insert error:", partnerErr); throw partnerErr; }

      // Convert bigint fee units (6-decimal) to USDC for storage
      const paymentAmountUsdc = Number(requiredFee) / 1_000_000;

      await supabase.from("submissions").insert({
        company_name,
        contact_email: contact_email || "not-provided@usdc.directory",
        website: website || "https://usdc.directory",
        description, categories, region, logo_url,
        wallet_address: verifiedPayer,
        payment_id: dedupKey,
        payment_status: "confirmed",
        payment_amount: paymentAmountUsdc,
        status: "approved",
        networks: [chain],
        partner_id: newPartner.id,
      });

      return json({ success: true, partner_id: newPartner.id, chain, tier, featured: isFeatured, verified_payer: verification.payer });
    }

    // type === "update"
    const { data: existing, error: loadErr } = await supabase
      .from("partners")
      .select("id, wallet_address")
      .eq("id", partner_id!)
      .maybeSingle();
    if (loadErr || !existing) return json({ error: "Partner not found" }, 404);
    // Authorisation is bound to the wallet that actually paid on-chain.
    if ((existing.wallet_address || "").toLowerCase() !== verifiedPayer)
      return json({ error: "The paying wallet is not the owner of this listing" }, 403);

    const { error: updateErr } = await supabase
      .from("partners")
      .update({ description, website, categories, region, updated_at: now })
      .eq("id", partner_id!);
    if (updateErr) { console.error("Partner update error:", updateErr); throw updateErr; }

    await supabase.from("submissions").insert({
      company_name,
      contact_email: contact_email || "not-provided@usdc.directory",
      website: website || "https://usdc.directory",
      description, categories, region,
      wallet_address: verifiedPayer,
      payment_id: dedupKey,
      payment_status: "confirmed",
      payment_amount: Number(requiredFee) / 1_000_000,
      status: "approved",
      networks: [chain],
      partner_id: partner_id!,
    });

    return json({ success: true, partner_id, chain, verified_payer: verification.payer });
    } catch (inner) {
      // Delivery failed after the payment was claimed: hand the transaction back so the payer can retry.
      await releasePayment(supabase, chain, tx_hash);
      throw inner;
    }
  } catch (err) {
    console.error("submit-listing error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
