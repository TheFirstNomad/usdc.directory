import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RefreshCw, Loader2, ExternalLink } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Dot,
} from "recharts";

interface CheckResult {
  url: string;
  checkedAt?: string;
  checked_at?: string;
  duration_ms?: number;
  durationMs?: number;
  status_code?: number;
  statusCode?: number;
  mount_success?: boolean;
  mountSuccess?: boolean;
  has_root?: boolean;
  hasRoot?: boolean;
  has_module_script?: boolean;
  hasModuleScript?: boolean;
  script_count?: number;
  scriptCount?: number;
  scripts?: string[];
  html_bytes?: number;
  htmlBytes?: number;
  error: string | null;
}

interface HistoryRow {
  id: string;
  checked_at: string;
  mount_success: boolean;
  duration_ms: number | null;
  status_code: number | null;
  error: string | null;
}

const TARGET_URL = "https://usdc.directory";

export default function DeploymentStatus() {
  const [result, setResult] = useState<CheckResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const runCheck = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-deployment", {
        body: { url: TARGET_URL },
      });
      if (error) throw error;
      const payload = data as CheckResult & { history?: HistoryRow[] };
      setResult(payload);
      if (Array.isArray(payload.history)) setHistory(payload.history);
    } catch (e) {
      setResult({
        url: TARGET_URL,
        checkedAt: new Date().toISOString(),
        durationMs: 0,
        mountSuccess: false,
        error: e instanceof Error ? e.message : "Failed to invoke check",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);


  const get = <T,>(camel?: T, snake?: T) => (camel !== undefined ? camel : snake);
  const ok = result ? (get(result.mountSuccess, result.mount_success) === true) : false;
  const checkedAt = result ? get(result.checkedAt, result.checked_at) : undefined;
  const durationMs = result ? get(result.durationMs, result.duration_ms) : undefined;
  const statusCode = result ? get(result.statusCode, result.status_code) : undefined;
  const hasRoot = result ? get(result.hasRoot, result.has_root) : undefined;
  const hasModule = result ? get(result.hasModuleScript, result.has_module_script) : undefined;
  const htmlBytes = result ? get(result.htmlBytes, result.html_bytes) : undefined;
  const scriptCount = result ? get(result.scriptCount, result.script_count) : undefined;

  const successRate = history.length
    ? Math.round((history.filter((h) => h.mount_success).length / history.length) * 100)
    : null;
  const avgDuration = history.length
    ? Math.round(
        history.filter((h) => h.duration_ms).reduce((a, h) => a + (h.duration_ms ?? 0), 0) /
          Math.max(1, history.filter((h) => h.duration_ms).length),
      )
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEO title="Deployment Status: USDC Directory" description="Live mount-status check for usdc.directory" />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Deployment Status</h1>
            <p className="text-muted-foreground mt-1">
              Auto-checked every 5 minutes ·{" "}
              <a
                href={TARGET_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                usdc.directory <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
          <Button onClick={runCheck} disabled={loading} variant="outline">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Re-check now
          </Button>
        </div>

        <Card className="p-6 mb-6">
          {!result && loading && (
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" /> Running first check…
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                {ok ? (
                  <CheckCircle2 className="w-12 h-12 text-success" />
                ) : (
                  <XCircle className="w-12 h-12 text-destructive" />
                )}
                <div>
                  <div className="text-2xl font-semibold">
                    {ok ? "App mounts successfully" : "Mount failure detected"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last checked {checkedAt ? new Date(checkedAt).toLocaleString() : "—"} · took {durationMs ?? "—"}ms
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
                <Stat label="HTTP status" value={statusCode ?? "—"} good={statusCode === 200} />
                <Stat label="HTML bytes" value={htmlBytes?.toLocaleString() ?? "—"} />
                <Stat label="Has root div" value={hasRoot ? "Yes" : "No"} good={hasRoot} />
                <Stat label="Module script" value={hasModule ? "Found" : "Missing"} good={hasModule} />
              </div>

              {result.error && (
                <div className="p-4 rounded-md bg-destructive/10 border border-destructive/30">
                  <div className="text-sm font-semibold text-destructive mb-1">Error details</div>
                  <div className="text-sm text-destructive/90 font-mono">{result.error}</div>
                </div>
              )}

              {result.scripts && result.scripts.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">
                    Detected script sources ({scriptCount ?? result.scripts.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.scripts.map((s, i) => (
                      <Badge key={i} variant="secondary" className="font-mono text-xs">
                        {s.length > 80 ? s.slice(0, 80) + "…" : s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">24-hour trend</h2>
              <p className="text-sm text-muted-foreground">
                {history.length} check{history.length === 1 ? "" : "s"} recorded
                {successRate !== null && ` · ${successRate}% success`}
                {avgDuration !== null && ` · avg ${avgDuration}ms`}
              </p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No checks recorded yet. The first scheduled run happens within 5 minutes.
            </div>
          ) : (
            <>
              {/* Line chart of duration over time, oldest left → newest right */}
              <div className="h-56 mb-4 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[...history].reverse().map((h) => ({
                      id: h.id,
                      ts: new Date(h.checked_at).getTime(),
                      time: new Date(h.checked_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                      checked_at: h.checked_at,
                      duration: h.duration_ms ?? 0,
                      mount_success: h.mount_success,
                      status_code: h.status_code,
                      error: h.error,
                    }))}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      stroke="hsl(var(--border))"
                      minTickGap={32}
                    />
                    <YAxis
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      stroke="hsl(var(--border))"
                      width={48}
                      tickFormatter={(v) => `${v}ms`}
                    />
                    <RTooltip content={<TrendTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }} />
                    <Line
                      type="monotone"
                      dataKey="duration"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      isAnimationActive={false}
                      dot={(props: { cx?: number; cy?: number; payload?: { mount_success?: boolean; id?: string } }) => {
                        const { cx, cy, payload } = props;
                        if (cx == null || cy == null) return <g key={payload?.id ?? `${cx}-${cy}`} />;
                        const ok = payload?.mount_success;
                        return (
                          <Dot
                            key={payload?.id ?? `${cx}-${cy}`}
                            cx={cx}
                            cy={cy}
                            r={3}
                            fill={ok ? "hsl(var(--success))" : "hsl(var(--destructive))"}
                            stroke="hsl(var(--background))"
                            strokeWidth={1}
                          />
                        );
                      }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Bar trend, oldest left → newest right */}
              <div className="flex items-end gap-[2px] h-16 mb-4 bg-muted/30 rounded p-2">
                {[...history].reverse().map((h) => (
                  <div
                    key={h.id}
                    title={`${new Date(h.checked_at).toLocaleString()} · ${
                      h.mount_success ? "OK" : "FAIL"
                    } · ${h.duration_ms ?? "?"}ms${h.error ? ` · ${h.error}` : ""}`}
                    className={`flex-1 min-w-[3px] rounded-sm ${
                      h.mount_success ? "bg-success" : "bg-destructive"
                    }`}
                    style={{
                      height: `${Math.min(100, Math.max(20, ((h.duration_ms ?? 200) / 1000) * 100))}%`,
                    }}
                  />
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-4">Time</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">HTTP</th>
                      <th className="py-2 pr-4">Duration</th>
                      <th className="py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 20).map((h) => (
                      <tr key={h.id} className="border-b border-border/50">
                        <td className="py-2 pr-4 text-muted-foreground">
                          {new Date(h.checked_at).toLocaleTimeString()}
                        </td>
                        <td className="py-2 pr-4">
                          {h.mount_success ? (
                            <Badge variant="secondary" className="bg-success/15 text-success border-success/30">
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive">FAIL</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4 font-mono">{h.status_code ?? "—"}</td>
                        <td className="py-2 pr-4 font-mono">{h.duration_ms ?? "—"}ms</td>
                        <td className="py-2 text-destructive/80 truncate max-w-[280px]">
                          {h.error ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value, good }: { label: string; value: React.ReactNode; good?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`text-lg font-semibold ${
          good === true ? "text-success" : good === false ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

interface TrendPoint {
  checked_at: string;
  duration: number;
  mount_success: boolean;
  status_code: number | null;
  error: string | null;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendPoint }> }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-foreground">
        {new Date(p.checked_at).toLocaleString()}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            p.mount_success ? "bg-success" : "bg-destructive"
          }`}
        />
        <span className={p.mount_success ? "text-success" : "text-destructive"}>
          {p.mount_success ? "Mount OK" : "Mount FAIL"}
        </span>
        <span className="text-muted-foreground">· HTTP {p.status_code ?? "—"}</span>
      </div>
      <div className="mt-1 font-mono text-muted-foreground">
        Duration: <span className="text-foreground">{p.duration}ms</span>
      </div>
      {p.error && (
        <div className="mt-1 max-w-[260px] text-destructive/90 break-words">{p.error}</div>
      )}
    </div>
  );
}
