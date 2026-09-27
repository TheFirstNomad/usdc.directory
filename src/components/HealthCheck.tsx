/**
 * HealthCheck — admin diagnostic component.
 * Shows connected Supabase host, partners_public count, and last fetch error.
 * Accessible at /admin/health (no secrets exposed — only public metadata).
 */
import { useEffect, useState } from "react";
import { supabase, supabaseConnectedHost, supabaseConfigError } from "@/integrations/supabase/client";

interface HealthState {
  partnersCount: number | null;
  partnersPublicCount: number | null;
  submissionsCount: number | null;
  lastError: string | null;
  checked: boolean;
}

export default function HealthCheck() {
  const [health, setHealth] = useState<HealthState>({
    partnersCount: null,
    partnersPublicCount: null,
    submissionsCount: null,
    lastError: null,
    checked: false,
  });

  useEffect(() => {
    async function check() {
      try {
        const [pp, sub] = await Promise.all([
          supabase.from("partners_public" as any).select("id", { count: "exact", head: true }),
          supabase.from("submissions" as any).select("id", { count: "exact", head: true }),
        ]);
        setHealth({
          partnersCount: null, // requires admin key — skip
          partnersPublicCount: pp.count ?? 0,
          submissionsCount: sub.count ?? 0,
          lastError: pp.error?.message ?? sub.error?.message ?? null,
          checked: true,
        });
      } catch (e: unknown) {
        setHealth(s => ({ ...s, lastError: String(e), checked: true }));
      }
    }
    check();
  }, []);

  const ok = !supabaseConfigError && health.checked && !health.lastError;
  const hostCorrect = supabaseConnectedHost.includes("ddhytszijvfejnymrwgd");

  return (
    <div className="min-h-screen bg-background p-8 font-mono text-sm">
      <h1 className="text-xl font-bold text-foreground mb-6">usdc.directory — Health Check</h1>
      <div className="space-y-3 max-w-xl">
        <Row label="Status" value={ok ? "✅ OK" : "❌ Error"} ok={ok} />
        <Row label="Connected host" value={supabaseConnectedHost} ok={hostCorrect} />
        <Row label="Canonical host" value="ddhytszijvfejnymrwgd.supabase.co" ok={true} />
        <Row label="Host matches canonical" value={hostCorrect ? "YES" : "NO — WRONG PROJECT"} ok={hostCorrect} />
        <Row label="Config error" value={supabaseConfigError ?? "none"} ok={!supabaseConfigError} />
        <Row label="partners_public count" value={health.checked ? String(health.partnersPublicCount) : "checking…"} ok={(health.partnersPublicCount ?? 0) > 0} />
        <Row label="submissions count" value={health.checked ? String(health.submissionsCount) : "checking…"} ok={true} />
        <Row label="Last fetch error" value={health.lastError ?? "none"} ok={!health.lastError} />
      </div>
      {!hostCorrect && (
        <div className="mt-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg max-w-xl">
          <p className="text-destructive font-semibold mb-1">Wrong Supabase project connected</p>
          <p className="text-muted-foreground text-xs">
            Set <code className="text-primary">VITE_SUPABASE_URL=https://ddhytszijvfejnymrwgd.supabase.co</code> in
            Lovable project settings → Environment Variables and redeploy.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex gap-4">
      <span className="text-muted-foreground w-44 flex-shrink-0">{label}</span>
      <span className={ok ? "text-green-400" : "text-red-400"}>{value}</span>
    </div>
  );
}
