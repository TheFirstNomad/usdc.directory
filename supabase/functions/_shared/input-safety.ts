/* eslint-disable no-control-regex -- control characters are matched on purpose to reject them */
// Pure input-hardening helpers shared by edge functions (no imports; vitest-tested).

/**
 * Returns a normalised http(s) URL or null. Bare domains get https://.
 * Rejects javascript:, data:, vbscript:, file: and anything with credentials.
 */
export function safeHttpUrl(raw: unknown, maxLen = 255): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s || s.length > maxLen) return null;
  if (/[\s\u0000-\u001f\u007f<>"'`\\]/.test(s)) return null;
  if (s.startsWith("/")) return null; // relative or protocol-relative
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return null; // other schemes
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    if (!u.hostname || !u.hostname.includes(".")) return null;
    return u.toString().length <= maxLen ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Free text: strips control characters and collapses whitespace. */
export function cleanText(raw: unknown, maxLen: number): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

/** Capability tags: short, lowercase, [a-z0-9 _-]. Duplicates removed. */
export function cleanCapabilities(raw: unknown, max = 5): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const c of raw) {
    const t = cleanText(c, 25).toLowerCase();
    if (/^[a-z0-9][a-z0-9 _-]{0,23}$/.test(t) && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Keeps only network names the directory knows about. */
export function cleanNetworks(raw: unknown, known: readonly string[], max = 10): string[] {
  if (!Array.isArray(raw)) return [];
  const allow = new Set(known.map((k) => k.toLowerCase()));
  const out: string[] = [];
  for (const n of raw) {
    const t = String(n ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (allow.has(t) && !out.includes(t)) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Best-effort client IP. Prefers headers set by the CDN/edge over the
 * client-controllable first X-Forwarded-For entry.
 */
export function clientIp(headers: Headers): string {
  const direct = headers.get("cf-connecting-ip") ?? headers.get("x-real-ip");
  if (direct && direct.trim()) return direct.trim().slice(0, 64);
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return "unknown";
}
