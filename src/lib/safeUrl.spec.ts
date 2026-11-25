import { describe, it, expect } from "vitest";
import { safeHttpUrl, safeLogoUrl, FALLBACK_LOGO } from "./safeUrl";

describe("safeHttpUrl (frontend)", () => {
  it("allows http(s) and bare domains", () => {
    expect(safeHttpUrl("https://example.com")).toBe("https://example.com/");
    expect(safeHttpUrl("example.com/path")).toBe("https://example.com/path");
  });
  it.each(["javascript:alert(1)", "data:text/html,x", "vbscript:x", "//evil.example", "", null, undefined])("rejects %s", (u) => {
    expect(safeHttpUrl(u as string)).toBeNull();
  });
  it("safeLogoUrl falls back locally for unsafe values", () => {
    expect(safeLogoUrl("javascript:alert(1)")).toBe(FALLBACK_LOGO);
    expect(safeLogoUrl(null)).toBe(FALLBACK_LOGO);
    expect(safeLogoUrl("https://cdn.example.com/l.png")).toBe("https://cdn.example.com/l.png");
  });
});
