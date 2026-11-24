// Fetches a target URL server-side, checks whether the HTML mounts a React app,
// and persists the result to public.deployment_checks.
//
// SSRF-hardened: only public, hard-coded hosts are allowed. Arbitrary URLs are
// rejected so the function cannot be used as a request-forwarder against the
// internal Supabase / cloud network.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAdminSessionToken } from "../_shared/admin-session.ts";

const OWNER = "0x13fa78ab20762c8f49b58d44dbc177a2adb94d7c";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-session, x-admin-address",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_HOST_SUFFIXES = [
  "usdc.directory",
  "www.usdc.directory",
  ".lovable.app",
  ".lovable.dev",
];

function isAllowedUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  // Block private/loopback hostnames defensively.
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^127\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^::1$/.test(host) ||
    /^fc00:/i.test(host) ||
    /^fe80:/i.test(host)
  ) return false;
  return ALLOWED_HOST_SUFFIXES.some((s) =>
    s.startsWith(".") ? host.endsWith(s) : host === s,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  let target = "https://usdc.directory";

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.url && typeof body.url === "string") target = body.url;
    }

    if (!isAllowedUrl(target)) {
      return new Response(
        JSON.stringify({ error: "URL not in allowlist" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Bound the upstream request so a slow target can't hold the isolate open.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8_000);
    const res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0 (DeploymentStatusBot)" },
      redirect: "follow",
      signal: ac.signal,
    });
    clearTimeout(timer);
    const html = await res.text();
    const durationMs = Date.now() - startedAt;

    const scriptMatches = Array.from(
      html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi),
    ).map((m) => m[1]);
    const hasRoot = /<div\s+id=["']root["']\s*>/i.test(html);
    const hasModuleScript = /<script[^>]*type=["']module["'][^>]*src=/i.test(html);
    const mountSuccess = res.ok && hasRoot && hasModuleScript;

    let error: string | null = null;
    if (!res.ok) error = `HTTP ${res.status} ${res.statusText}`;
    else if (!hasRoot) error = 'Missing <div id="root"> in HTML';
    else if (!hasModuleScript) error = "No module script tag found — React bundle not loaded";

    const record = {
      url: target,
      status_code: res.status,
      mount_success: mountSuccess,
      has_root: hasRoot,
      has_module_script: hasModuleScript,
      script_count: scriptMatches.length,
      html_bytes: html.length,
      duration_ms: durationMs,
      error,
    };

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: insertError } = await supabase.from("deployment_checks").insert(record);
    if (insertError) console.error("Insert failed:", insertError.message);

    // Opportunistic cleanup of old rows (caps table growth).
    supabase.rpc("cleanup_deployment_checks").then(() => {}).catch(() => {});

    // History is not client-readable (RLS denies anon/authenticated); serve it here.
    // Only the owner (valid admin pass) receives check history.
    const pass = req.headers.get("x-admin-session") ?? "";
    const isAdmin = pass
      ? await verifyAdminSessionToken(Deno.env.get("ADMIN_SESSION_SECRET") ?? "", pass, OWNER)
      : false;
    const { data: history } = isAdmin
      ? await supabase
        .from("deployment_checks")
        .select("id, checked_at, mount_success, duration_ms, status_code, error")
        .order("checked_at", { ascending: false })
        .limit(288)
      : { data: [] };

    return new Response(
      JSON.stringify({
        ...record,
        checkedAt: new Date().toISOString(),
        scripts: scriptMatches.slice(0, 10),
        history: history ?? [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
      await supabase.from("deployment_checks").insert({
        url: target,
        mount_success: false,
        duration_ms: Date.now() - startedAt,
        error: message,
      });
    } catch (_) { /* swallow */ }

    return new Response(
      JSON.stringify({
        url: target,
        checkedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        mountSuccess: false,
        error: message,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
