// Stateless admin session tokens: base64url(JSON{addr,exp}).hex(HMAC-SHA256).
// Issued once after a verified wallet signature so admin pages don't need a
// new MetaMask signature for every request.

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const enc = new TextEncoder();

function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createAdminSessionToken(
  secret: string, addr: string, now = Date.now(), ttlMs = ADMIN_SESSION_TTL_MS,
): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = now + ttlMs;
  const payload = b64urlEncode(JSON.stringify({ addr: addr.toLowerCase(), exp: expiresAt }));
  const sig = await hmacHex(secret, payload);
  return { token: `${payload}.${sig}`, expiresAt };
}

/** Returns true only if the token is authentic, unexpired and issued to `expectedAddr`. */
export async function verifyAdminSessionToken(
  secret: string, token: string, expectedAddr: string, now = Date.now(),
): Promise<boolean> {
  if (!secret || !token || typeof token !== "string" || token.length > 1024) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = await hmacHex(secret, payload);
  if (!safeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(b64urlDecode(payload));
    if (typeof data?.addr !== "string" || typeof data?.exp !== "number") return false;
    if (data.addr !== expectedAddr.toLowerCase()) return false;
    if (data.exp <= now) return false;
    return true;
  } catch {
    return false;
  }
}
