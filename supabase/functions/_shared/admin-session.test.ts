import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createAdminSessionToken, verifyAdminSessionToken, ADMIN_SESSION_TTL_MS } from "./admin-session.ts";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";
const OWNER = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c";

Deno.test("admin session lasts 8 hours", () => {
  assertEquals(ADMIN_SESSION_TTL_MS, 8 * 60 * 60 * 1000);
});

Deno.test("valid owner token is accepted", async () => {
  const { token } = await createAdminSessionToken(SECRET, OWNER);
  assertEquals(await verifyAdminSessionToken(SECRET, token, OWNER), true);
});

Deno.test("expired token is rejected", async () => {
  const now = Date.now();
  const { token } = await createAdminSessionToken(SECRET, OWNER, now);
  assertEquals(await verifyAdminSessionToken(SECRET, token, OWNER, now + ADMIN_SESSION_TTL_MS + 1), false);
});

Deno.test("tampered token is rejected", async () => {
  const { token } = await createAdminSessionToken(SECRET, OWNER);
  const [, sig] = token.split(".");
  const forged = btoa(JSON.stringify({ addr: OWNER.toLowerCase(), exp: Date.now() + 10 ** 12 }))
    .replace(/=+$/, "") + "." + sig;
  assertEquals(await verifyAdminSessionToken(SECRET, forged, OWNER), false);
});

Deno.test("token signed with another secret is rejected", async () => {
  const { token } = await createAdminSessionToken("other-secret-xxxxxxxxxxxxxxxxxxxxxxxx", OWNER);
  assertEquals(await verifyAdminSessionToken(SECRET, token, OWNER), false);
});

Deno.test("token for a different wallet is rejected", async () => {
  const { token } = await createAdminSessionToken(SECRET, "0x0000000000000000000000000000000000000001");
  assertEquals(await verifyAdminSessionToken(SECRET, token, OWNER), false);
});
