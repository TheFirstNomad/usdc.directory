/**
 * Link safety for user-supplied URLs (merchant websites, logos).
 * Only http(s) URLs are ever rendered as links or image sources; javascript:,
 * data:, vbscript: and similar schemes return null.
 */
export function safeHttpUrl(raw: unknown, maxLen = 500): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s || s.length > maxLen) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f<>"'`\\]/.test(s)) return null;
  if (s.startsWith("/")) return null; // relative or protocol-relative
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Neutral local fallback shown when a listing has no usable logo (no third-party lookups). */
export const FALLBACK_LOGO = "/tokens/usdc.png";

/** A logo URL that is safe to put in <img src>, or the local fallback. */
export function safeLogoUrl(raw: unknown): string {
  return safeHttpUrl(raw) ?? FALLBACK_LOGO;
}
