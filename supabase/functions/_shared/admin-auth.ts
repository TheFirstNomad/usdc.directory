// Shared admin verifier — used by all admin-* edge functions.
// Accepts either a short-lived admin session token (x-admin-session, issued by
// the admin-session function after one wallet signature) or a one-shot
// timestamped owner-wallet signature (replays rejected via admin_sig_nonces).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { recoverMessageAddress } from "https://esm.sh/viem@2.21.55";
import { verifyAdminSessionToken } from "./admin-session.ts";

export const OWNER_WALLET = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c".toLowerCase();
const MAX_AGE_MS = 5 * 60 * 1000;

export const ADMIN_CORS_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-admin-address, x-admin-timestamp, x-admin-signature, x-admin-session, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

/** Verifies a one-shot owner signature and consumes it (replay-protected). */
export async function verifyAdminSignature(
  req: Request, supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  const address = req.headers.get("x-admin-address")?.toLowerCase();
  const timestamp = req.headers.get("x-admin-timestamp");
  const signature = req.headers.get("x-admin-signature");

  if (!address || !timestamp || !signature || address !== OWNER_WALLET) return false;

  const ts = Number(timestamp);
  if (isNaN(ts) || Math.abs(Date.now() - ts) > MAX_AGE_MS) return false;

  let recovered: string;
  try {
    recovered = (await recoverMessageAddress({
      message: `USDC Directory Admin\nTimestamp: ${ts}`,
      signature: signature as `0x${string}`,
    })).toLowerCase();
  } catch {
    return false;
  }
  if (recovered !== OWNER_WALLET) return false;

  // Each signature can only be used once (unique PK on signature).
  const { error } = await supabase
    .from("admin_sig_nonces")
    .insert({ signature, admin_address: address });
  return !error;
}

export async function verifyAdmin(
  req: Request, supabase: ReturnType<typeof createClient>,
): Promise<boolean> {
  const session = req.headers.get("x-admin-session");
  if (session) {
    const headerAddr = req.headers.get("x-admin-address")?.toLowerCase();
    if (headerAddr && headerAddr !== OWNER_WALLET) return false;
    const secret = Deno.env.get("ADMIN_SESSION_SECRET") ?? "";
    return await verifyAdminSessionToken(secret, session, OWNER_WALLET);
  }
  return await verifyAdminSignature(req, supabase);
}
