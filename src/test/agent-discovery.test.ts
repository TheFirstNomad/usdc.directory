import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "../../public", p), "utf8");
const FILES = ["llms.txt", "openapi.json", ".well-known/x402", ".well-known/agents.json", ".well-known/mcp.json", ".well-known/ai-plugin.json"];

describe("agent discovery files", () => {
  it.each(FILES)("%s never mentions the raw backend host or free previews", (f) => {
    const s = read(f);
    expect(s).not.toContain("supabase.co");
    expect(s.toLowerCase()).not.toContain("free preview");
  });

  it("openapi servers point at the stable API host and include merchant search", () => {
    const o = JSON.parse(read("openapi.json"));
    expect(o.servers[0].url).toBe("https://api.usdc.directory");
    expect(o.paths["/merchants/search"]).toBeTruthy();
  });

  it("mcp.json lists the six paid tools at the stable host", () => {
    const m = JSON.parse(read(".well-known/mcp.json"));
    expect(m.url).toBe("https://api.usdc.directory/mcp");
    expect(m.tools.map((t: { price_usdc: string }) => t.price_usdc)).toEqual(["0.01", "0.01", "0.01", "0.01", "1", "5"]);
  });
});
