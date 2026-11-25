import { describe, it, expect } from "vitest";
import { safeHttpUrl, cleanText, cleanCapabilities, cleanNetworks, clientIp } from "./input-safety";

describe("safeHttpUrl", () => {
  it("normalises bare domains to https", () => {
    expect(safeHttpUrl("monast.io")).toBe("https://monast.io/");
  });
  it("keeps http(s) URLs", () => {
    expect(safeHttpUrl("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(safeHttpUrl("http://example.com")).toBe("http://example.com/");
  });
  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "https://exa mple.com",
    "https://example.com/<script>",
    "localhost",
    "",
  ])("rejects %s", (u) => {
    expect(safeHttpUrl(u)).toBeNull();
  });
  it("rejects non-strings and overlong values", () => {
    expect(safeHttpUrl(42)).toBeNull();
    expect(safeHttpUrl("https://example.com/" + "a".repeat(300), 255)).toBeNull();
  });
});

describe("cleaners", () => {
  it("cleanText strips control characters and collapses whitespace", () => {
    expect(cleanText("  a\u0000b \n\t c  ", 50)).toBe("ab c");
    expect(cleanText("x".repeat(20), 5)).toBe("xxxxx");
  });
  it("cleanCapabilities keeps short lowercase tags only", () => {
    expect(cleanCapabilities(["Payments", "payments", "<img>", "trading bot", "x".repeat(40)])).toEqual(["payments", "trading bot"]);
    expect(cleanCapabilities("nope")).toEqual([]);
  });
  it("cleanNetworks keeps only known networks", () => {
    expect(cleanNetworks(["Base", "arc", "evil", "BNB Chain"], ["base", "arc", "bnb_chain"])).toEqual(["base", "arc", "bnb_chain"]);
  });
});

describe("clientIp", () => {
  it("prefers the CDN header over a client-controlled X-Forwarded-For", () => {
    const h = new Headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 1.2.3.4" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });
  it("falls back to the first forwarded address, then unknown", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
