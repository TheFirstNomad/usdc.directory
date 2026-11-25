import { ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown when the admin wallet signature was blocked, cancelled or failed, so the page never looks empty. */
export function AdminSignInNotice({ onRetry, loading }: { onRetry: () => void; loading?: boolean }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <ShieldAlert className="h-6 w-6 text-destructive shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="font-semibold text-foreground">Wallet signature needed to load admin data</p>
        <p className="text-sm text-muted-foreground">
          The sign-in was cancelled or blocked. If your wallet shows a security warning, it may be stopping the
          request. Signing is a sign-in only and cannot move funds. Your listings are safe.
        </p>
      </div>
      <Button onClick={onRetry} disabled={loading} className="gap-2">
        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Sign in again
      </Button>
    </div>
  );
}
