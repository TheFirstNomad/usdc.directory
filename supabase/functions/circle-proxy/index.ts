/**
 * circle-proxy – Forwards requests to https://api.circle.com on behalf of
 * the browser, bypassing CORS restrictions the Circle API imposes on
 * custom domains.
 *
 * Hardened:
 *  - the bearer token must be a genuine project-issued token (signature
 *    verified server-side), not just any string that starts with "Bearer ";
 *  - per-caller quota so the ARC_KIT_KEY budget cannot be drained;
 *  - the path is locked to /v1/stablecoinKits/*.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { validateCirclePath, ALLOWED_METHODS } from "../_shared/proxy-path.ts";
import { clientIp } from "../_shared/input-safety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CIRCLE_BASE = "https://api.circle.com";
const RATE_LIMIT_MAX = 60; // requests per window
const RATE_WINDOW_MS = 60_000;

const unauthorized = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return unauthorized();
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return unauthorized();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verify the token is really issued by this project (signature + expiry).
  // Both signed-in user tokens and the app's own client token are accepted,
  // anything forged or from another project is rejected.
  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    console.warn("[circle-proxy] rejected caller: token failed verification");
    return unauthorized();
  }

  // Per-caller quota (subject when signed in, otherwise client IP).
  const subject =
    (claimsData.claims as Record<string, unknown>).sub as string | undefined;
  const ip = clientIp(req.headers);
  const bucketKey = `circle-proxy:${subject ?? ip}`;
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

  const { count } = await admin
    .from("agent_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("bucket_key", bucketKey)
    .eq("endpoint", "circle-proxy")
    .gte("created_at", since);

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please retry in a moment." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  await admin.from("agent_rate_limits").insert({ bucket_key: bucketKey, endpoint: "circle-proxy" });


  try {
    const kitKey = Deno.env.get("ARC_KIT_KEY");
    if (!kitKey) {
      return new Response(
        JSON.stringify({ error: "ARC_KIT_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = await req.json();
    const { method: rawMethod = "POST", path, body } = payload as {
      method?: string;
      path: string;
      body?: unknown;
    };
    const method = String(rawMethod).toUpperCase();

    // The path is normalised and locked to /v1/stablecoinKits/*; ".." and
    // encoded dots/slashes are rejected so the key can never reach other APIs.
    const safePath = validateCirclePath(path);
    if (!safePath) {
      return new Response(
        JSON.stringify({ error: "Only /v1/stablecoinKits/* endpoints are allowed" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!ALLOWED_METHODS.has(method)) {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const targetUrl = `${CIRCLE_BASE}${safePath}`;

    // Caller-supplied headers are never forwarded, so Authorization cannot be overridden.
    const fetchInit: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${kitKey}`,
      },
    };
    if (method !== "GET" && body !== undefined) {
      fetchInit.body = JSON.stringify(body);
    }

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15_000);
    fetchInit.signal = ac.signal;

    const upstream = await fetch(targetUrl, fetchInit);
    clearTimeout(timer);
    const responseBody = await upstream.text();

    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (err) {
    console.error("[circle-proxy] Error:", err);
    return new Response(
      JSON.stringify({ error: "Upstream request failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
