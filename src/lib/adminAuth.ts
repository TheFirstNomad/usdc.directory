/**
 * Admin authentication via cryptographic wallet signature.
 *
 * The owner wallet signs ONE fresh timestamped message per session. The
 * `admin-session` backend function verifies it (owner wallet, fresh, never
 * used before) and returns a short-lived signed admin pass. All admin
 * requests then send that pass, so MetaMask is not asked again until the
 * pass expires, the wallet changes, or the tab closes.
 */

import { FUNCTIONS_BASE } from "@/lib/functionsUrl";

/** The owner wallet that controls all admin edge functions. Must match OWNER_WALLET in _shared/admin-auth.ts. */
export const OWNER_WALLET = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c";

const STORAGE_KEY = "usdc-directory-admin-session";
/** Refresh slightly before the server-side expiry. */
const EXPIRY_MARGIN_MS = 60_000;

interface StoredSession {
  addr: string;
  token: string;
  expiresAt: number;
}

/** Returns stored admin-pass headers without prompting the wallet, or null. */
export function getStoredAdminHeaders(): Record<string, string> | null {
  const s = readSession(OWNER_WALLET);
  return s ? { "x-admin-session": s.token, "x-admin-address": OWNER_WALLET } : null;
}

export function buildAdminMessage(timestamp: number): string {
  return `USDC Directory Admin\nTimestamp: ${timestamp}`;
}

function readSession(address: string): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StoredSession;
    if (s.addr !== address.toLowerCase()) return null;
    if (!s.token || s.expiresAt - EXPIRY_MARGIN_MS <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function sessionHeaders(address: string, token: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-admin-address": address,
    "x-admin-session": token,
  };
}

let inflight: { addr: string; promise: Promise<StoredSession> } | null = null;

async function createSession(
  address: string,
  signMessage: (args: any) => Promise<string>,
): Promise<StoredSession> {
  const timestamp = Date.now();
  const signature = await signMessage({ message: buildAdminMessage(timestamp) });
  const res = await fetch(`${FUNCTIONS_BASE}/admin-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-address": address,
      "x-admin-timestamp": String(timestamp),
      "x-admin-signature": signature,
    },
  });
  if (!res.ok) throw new Error("Admin sign-in failed");
  const data = await res.json();
  const session: StoredSession = {
    addr: address.toLowerCase(),
    token: data.token,
    expiresAt: Number(data.expiresAt),
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable — pass stays valid for this request only */
  }
  return session;
}

/**
 * Returns admin auth headers. Reuses the stored admin pass when valid;
 * otherwise asks the wallet to sign once (concurrent callers share the same
 * signature request). With `interactive: false` it never opens the wallet.
 */
export async function getAdminAuthHeaders(
  address: string,
  signMessage: (args: any) => Promise<string>,
  opts: { interactive?: boolean } = {},
): Promise<Record<string, string>> {
  const existing = readSession(address);
  if (existing) return sessionHeaders(address, existing.token);

  if (opts.interactive === false) throw new Error("Admin session required");

  const key = address.toLowerCase();
  if (!inflight || inflight.addr !== key) {
    const promise = createSession(address, signMessage);
    inflight = { addr: key, promise };
    promise.finally(() => {
      if (inflight?.promise === promise) inflight = null;
    }).catch(() => {});
  }
  const session = await inflight.promise;
  return sessionHeaders(address, session.token);
}

/** Forget the stored admin pass (on disconnect, wallet change, or rejection). */
export function clearAdminAuth() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  inflight = null;
}

/** Clears the admin pass if the backend rejected it, so the next action signs once again. */
export function handleAdminResponse(res: Response) {
  if (res.status === 401 || res.status === 403) clearAdminAuth();
}
