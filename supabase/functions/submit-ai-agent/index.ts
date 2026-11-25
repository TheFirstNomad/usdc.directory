/**
 * submit-ai-agent: Self-list an AI agent for 1 USDC on any supported chain.
 *
 * AI agent fee is intentionally 1 USDC (vs 3 USDC for business listings).
 * Agents are the network effect: lower barrier = more autonomous agents listed.
 *
 * Supported chains: Arc, Base, Ethereum, Arbitrum, Optimism, Polygon,
 * Avalanche, BNB, Linea, Monad (EVM) + Solana, Sui, Near (non-EVM).
 *
 * The front-end pays via wagmi sendTransaction and posts the tx hash here.
 * Verification (normalised amounts) and single-use claiming of the transaction
 * live in ../_shared/payment-verify.ts, shared with every other paid feature.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { verifyUsdcPayment, claimPayment, releasePayment, normalizeChainKey, EVM_CHAINS, NON_EVM_KEYS } from "../_shared/payment-verify.ts";
import { safeHttpUrl, cleanText, cleanCapabilities, cleanNetworks } from "../_shared/input-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEE_BASE_UNITS = 1_000_000n; // 1 USDC (6-decimal base units)
const KNOWN_NETWORKS = [...Object.keys(EVM_CHAINS), ...NON_EVM_KEYS];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json();
    const { agent_name, wallet_address, description, logo_url, payment_tx, website, capabilities, networks } = body ?? {};
    const chain = normalizeChainKey(body?.chain ?? "base");

    const name = cleanText(agent_name, 101);
    const desc = cleanText(description, 301);
    if (!name || name.length > 100) return j({ error: "agent_name required (max 100)" }, 400);
    if (!wallet_address || typeof wallet_address !== "string" || wallet_address.trim().length === 0 || wallet_address.length > 256)
      return j({ error: "wallet_address required (max 256)" }, 400);
    if (!desc || desc.length > 300) return j({ error: "description required (max 300)" }, 400);
    if (!payment_tx || typeof payment_tx !== "string" || payment_tx.length < 16 || payment_tx.length > 200)
      return j({ error: "payment_tx required" }, 400);
    if (!KNOWN_NETWORKS.includes(chain)) return j({ error: `Unsupported chain '${chain}'. Supported: ${KNOWN_NETWORKS.join(", ")}` }, 400);

    // Links are rendered as hrefs / image sources: only real http(s) URLs are stored.
    let websiteUrl: string | null = null;
    if (website && typeof website === "string" && website.trim()) {
      websiteUrl = safeHttpUrl(website, 255);
      if (!websiteUrl) return j({ error: "website must be a valid http(s) URL" }, 400);
    }
    let logoUrl: string | null = null;
    if (logo_url && typeof logo_url === "string" && logo_url.trim()) {
      logoUrl = safeHttpUrl(logo_url, 500);
      if (!logoUrl) return j({ error: "logo_url must be a valid http(s) URL" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const dedupKey = `${chain}:${payment_tx}`;
    const { data: dup } = await supabase
      .from("partners").select("id").eq("payment_id", dedupKey).maybeSingle();
    if (dup) return j({ error: "Transaction hash already used" }, 409);

    const v = await verifyUsdcPayment(chain, payment_tx, FEE_BASE_UNITS, { signerHint: wallet_address });
    if (!v.ok) return j({ error: `Payment verification failed: ${v.error}` }, 402);

    // Consume the transaction exactly once across every paid feature.
    const claim = await claimPayment(supabase, chain, payment_tx, "submit-ai-agent");
    if (!claim.ok) {
      return claim.reason === "used"
        ? j({ error: "Transaction hash already used" }, 409)
        : j({ error: "Payment ledger unavailable, please retry shortly" }, 503);
    }

    // Capabilities stored as subcategory tags e.g. "AI: payments"
    const capTags = cleanCapabilities(capabilities, 5).map((c) => `AI: ${c}`);
    const declared = cleanNetworks(networks, KNOWN_NETWORKS);
    const agentNetworks = declared.length > 0 ? declared : [chain];

    const { data: partner, error: partnerError } = await supabase
      .from("partners")
      .insert({
        name,
        description: desc,
        website: websiteUrl,
        categories: ["AI Agents", ...capTags],
        region: "Global",
        networks: agentNetworks,
        // Ownership is bound to the wallet that actually paid.
        wallet_address: v.payer !== "unknown" ? v.payer : wallet_address.trim().toLowerCase(),
        logo_url: logoUrl,
        payment_status: "confirmed",
        payment_id: dedupKey,
      })
      .select()
      .single();

    if (partnerError) {
      console.error("Partner insert failed:", partnerError.message);
      await releasePayment(supabase, chain, payment_tx);
      return j({ error: "Failed to create listing. Your payment was not used; please retry." }, 500);
    }

    return j({ id: partner.id, name: partner.name, chain, verified_payer: v.payer });
  } catch (err) {
    console.error("submit-ai-agent error:", err);
    return j({ error: "Internal server error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
