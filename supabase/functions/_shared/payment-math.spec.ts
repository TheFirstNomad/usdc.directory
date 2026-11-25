import { describe, it, expect } from "vitest";
import { toMicroUsdc, sumTransfersTo, paymentKey } from "./payment-math";

const TREASURY = "0x13FA78ab20762c8F49B58D44DBc177a2Adb94D7c";

describe("toMicroUsdc", () => {
  it("leaves 6-decimal amounts alone", () => {
    expect(toMicroUsdc(25_000_000n, 6)).toBe(25_000_000n);
  });
  it("scales BNB 18-decimal USDC down to 6-decimal units", () => {
    expect(toMicroUsdc(25n * 10n ** 18n, 18)).toBe(25_000_000n);
  });
  it("rejects invalid decimals", () => {
    expect(() => toMicroUsdc(1n, -1)).toThrow();
  });
});

describe("sumTransfersTo (BNB underpayment regression)", () => {
  const fee = 25_000_000n; // 25 USDC boost price in 6-decimal units

  it("a dust BNB transfer of 25_000_000 raw units does NOT meet a 25 USDC price", () => {
    // The old verifier compared raw 18-decimal units against 25_000_000 and accepted this.
    const { total } = sumTransfersTo(TREASURY, [{ from: "0xabc", to: TREASURY, value: 25_000_000n }], 18);
    expect(total).toBe(0n);
    expect(total >= fee).toBe(false);
  });

  it("a real 25 USDC BNB transfer meets the price", () => {
    const { total, payer } = sumTransfersTo(TREASURY, [{ from: "0xAbC", to: TREASURY.toLowerCase(), value: 25n * 10n ** 18n }], 18);
    expect(total >= fee).toBe(true);
    expect(payer).toBe("0xabc");
  });

  it("ignores transfers to other addresses and sums several to the treasury", () => {
    const { total } = sumTransfersTo(TREASURY, [
      { from: "0x1", to: "0x2", value: 99_000_000n },
      { from: "0x1", to: TREASURY, value: 10_000_000n },
      { from: "0x1", to: TREASURY, value: 15_000_000n },
    ]);
    expect(total).toBe(25_000_000n);
  });
});

describe("paymentKey", () => {
  it("lower-cases EVM hashes so case variants collide", () => {
    const a = paymentKey("Base", "0xABCDEF0123456789abcdef0123456789abcdef0123456789abcdef0123456789");
    const b = paymentKey("base", "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789");
    expect(a).toEqual(b);
  });
  it("keeps base58 signatures case-sensitive", () => {
    expect(paymentKey("solana", "AbC").tx_hash).toBe("AbC");
  });
});
