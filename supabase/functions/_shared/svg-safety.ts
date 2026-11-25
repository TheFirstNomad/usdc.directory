/* eslint-disable no-control-regex -- control characters are matched on purpose to reject them */
// Conservative SVG screening for logo uploads (pure; vitest-tested).
// Returns an error string when the SVG could carry script or external content,
// or null when it looks like a plain vector image.

const MAX_SVG_BYTES = 256 * 1024;

export function checkSvg(text: string): string | null {
  if (text.length > MAX_SVG_BYTES) return "SVG too large (max 256 KB).";
  const t = text.replace(/\u0000/g, "");
  if (!/<svg[\s>]/i.test(t)) return "Not a valid SVG file.";
  if (/<!ENTITY/i.test(t) || /<!DOCTYPE[^>]*\[/i.test(t)) return "SVG entities are not allowed.";
  if (/<\s*(script|foreignObject|iframe|object|embed|link|meta|audio|video|canvas|animate|set|handler)\b/i.test(t)) {
    return "SVG contains disallowed elements.";
  }
  if (/\son[a-z]+\s*=/i.test(t)) return "SVG contains event handlers.";
  if (/(javascript|vbscript)\s*:/i.test(t)) return "SVG contains script URLs.";
  if (/data\s*:\s*(text\/html|application\/|image\/svg)/i.test(t)) return "SVG contains embedded documents.";
  // href / xlink:href may only point at internal fragments or embedded raster images.
  const hrefs = t.matchAll(/(?:xlink:)?href\s*=\s*["']\s*([^"']*)["']/gi);
  for (const m of hrefs) {
    const v = m[1].trim();
    if (v.startsWith("#")) continue;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(v)) continue;
    return "SVG references external resources.";
  }
  if (/url\(\s*["']?\s*(https?:|\/\/)/i.test(t)) return "SVG references external resources.";
  if (/@import/i.test(t)) return "SVG references external resources.";
  return null;
}
