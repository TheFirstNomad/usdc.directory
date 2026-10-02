import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const pub = (p: string) => resolve(root, "public", p.replace(/^\//, ""));

// Reads width/height from a PNG header.
function pngSize(path: string) {
  const buf = readFileSync(path);
  expect(buf.subarray(1, 4).toString()).toBe("PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const manifest = JSON.parse(readFileSync(pub("manifest.webmanifest"), "utf8"));
const html = readFileSync(resolve(root, "index.html"), "utf8");

describe("web app manifest", () => {
  it("has required install fields", () => {
    expect(manifest.name).toBe("USDC Directory");
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("includes 192 and 512 icons for any and maskable", () => {
    for (const purpose of ["any", "maskable"]) {
      for (const size of ["192x192", "512x512"]) {
        expect(
          manifest.icons.some((i: any) => i.sizes === size && i.purpose === purpose),
          `${purpose} ${size}`,
        ).toBe(true);
      }
    }
  });

  it("every icon file exists with the declared size", () => {
    for (const icon of manifest.icons) {
      const file = pub(icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      if (icon.type === "image/png") {
        const [w, h] = icon.sizes.split("x").map(Number);
        expect(pngSize(file)).toEqual({ w, h });
      }
    }
  });
});

describe("USDC brand icons", () => {
  it("apple-touch-icon is 180x180", () => {
    expect(pngSize(pub("apple-touch-icon.png"))).toEqual({ w: 180, h: 180 });
  });
  it("favicon is the official USDC SVG", () => {
    expect(readFileSync(pub("favicon.svg"), "utf8")).toBe(
      readFileSync(pub("Circle_USDC_Logo.svg"), "utf8"),
    );
  });
});

describe("home-screen metadata in index.html", () => {
  it.each([
    'rel="manifest" href="/manifest.webmanifest"',
    'rel="apple-touch-icon"',
    'href="/apple-touch-icon.png"',
    'rel="icon" type="image/svg+xml" href="/favicon.svg"',
    'name="theme-color"',
    'name="apple-mobile-web-app-title"',
  ])("contains %s", (snippet) => {
    expect(html).toContain(snippet);
  });

  it("theme-color matches the manifest", () => {
    expect(html).toContain(`name="theme-color" content="${manifest.theme_color}"`);
  });
});
