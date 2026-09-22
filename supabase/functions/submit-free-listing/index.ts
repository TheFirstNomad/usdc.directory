// Deprecated: free listings are no longer accepted.
// All listings now require 1 USDC payment on any supported mainnet (EVM, Solana, Sui, or Near).
// See /submit and /.well-known/x402 for current payment paths.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "Free listings have been discontinued. All listings now require a 1 USDC payment on any supported chain (EVM, Solana, Sui, or Near). Visit /submit to list your business or AI agent.",
      code: "FREE_LISTING_DEPRECATED",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
