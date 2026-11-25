import { describe, it, expect } from "vitest";
import { validateCirclePath, ALLOWED_METHODS } from "./proxy-path";

describe("validateCirclePath", () => {
  it("accepts stablecoin kit paths and keeps the query string", () => {
    expect(validateCirclePath("/v1/stablecoinKits/quote?x=1")).toBe("/v1/stablecoinKits/quote?x=1");
    expect(validateCirclePath("/v1/stablecoinKits/swap")).toBe("/v1/stablecoinKits/swap");
  });
  it.each([
    "/v1/stablecoinKits/../wallets",
    "/v1/stablecoinKits/%2e%2e/wallets",
    "/v1/stablecoinKits/%2E%2E/wallets",
    "/v1/stablecoinKits/..%2fwallets",
    "/v1/stablecoinKits/a\\..\\b",
    "//evil.example/v1/stablecoinKits/x",
    "https://evil.example/v1/stablecoinKits/x",
    "/v1/wallets",
    "/v1/stablecoinKits/",
    "/v1/stablecoinKits",
    "v1/stablecoinKits/x",
    "",
  ])("rejects %s", (p) => {
    expect(validateCirclePath(p)).toBeNull();
  });
  it("rejects non-strings and oversized paths", () => {
    expect(validateCirclePath(undefined)).toBeNull();
    expect(validateCirclePath({})).toBeNull();
    expect(validateCirclePath("/v1/stablecoinKits/" + "a".repeat(600))).toBeNull();
  });
  it("only allows GET and POST", () => {
    expect(ALLOWED_METHODS.has("GET")).toBe(true);
    expect(ALLOWED_METHODS.has("POST")).toBe(true);
    expect(ALLOWED_METHODS.has("DELETE")).toBe(false);
  });
});
