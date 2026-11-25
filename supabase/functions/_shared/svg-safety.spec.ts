import { describe, it, expect } from "vitest";
import { checkSvg } from "./svg-safety";

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${inner}</svg>`;

describe("checkSvg", () => {
  it("accepts a plain vector logo", () => {
    expect(checkSvg(wrap('<circle cx="5" cy="5" r="4" fill="#2775C9"/><style>.a{fill:red}</style>'))).toBeNull();
    expect(checkSvg(wrap('<defs><linearGradient id="g"/></defs><rect fill="url(#g)" width="1" height="1"/><use href="#g"/>'))).toBeNull();
  });
  it.each([
    wrap("<script>alert(1)</script>"),
    wrap('<circle onclick="alert(1)" r="1"/>'),
    wrap('<a href="javascript:alert(1)"><rect/></a>'),
    wrap('<foreignObject><div/></foreignObject>'),
    wrap('<image href="https://evil.example/x.png"/>'),
    wrap('<rect style="fill:url(https://evil.example/x)"/>'),
    '<!DOCTYPE svg [<!ENTITY x "y">]><svg xmlns="http://www.w3.org/2000/svg"/>',
    "<html></html>",
  ])("rejects %#", (svg) => {
    expect(checkSvg(svg)).not.toBeNull();
  });
  it("rejects oversized files", () => {
    expect(checkSvg(wrap("<g/>".repeat(100_000)))).not.toBeNull();
  });
});
