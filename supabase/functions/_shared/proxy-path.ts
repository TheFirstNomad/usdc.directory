/* eslint-disable no-control-regex -- control characters are matched on purpose to reject them */
// Path allow-list for circle-proxy (pure; vitest-tested).
// The proxy attaches a secret Circle key, so the caller must never be able to
// steer the request outside /v1/stablecoinKits/ (for example with "..").

const ALLOWED_PREFIX = "/v1/stablecoinKits/";
export const ALLOWED_METHODS = new Set(["GET", "POST"]);

/** Returns the safe `pathname + search` to forward, or null if the path is not allowed. */
export function validateCirclePath(path: unknown): string | null {
  if (typeof path !== "string") return null;
  if (path.length === 0 || path.length > 512) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  // Reject anything that could be normalised or decoded into a different path.
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return null;
  if (/%(2e|2f|5c|00)/i.test(path)) return null;
  if (path.includes("..") || path.includes("//")) return null;
  let url: URL;
  try {
    url = new URL(path, "https://api.circle.com");
  } catch {
    return null;
  }
  if (url.origin !== "https://api.circle.com") return null;
  if (!url.pathname.startsWith(ALLOWED_PREFIX)) return null;
  if (url.pathname.length === ALLOWED_PREFIX.length) return null;
  return url.pathname + url.search;
}
