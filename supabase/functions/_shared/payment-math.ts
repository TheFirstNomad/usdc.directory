// Pure payment arithmetic shared by every paid edge function.
// No imports on purpose: this file is unit-tested with vitest and loaded by Deno.

/** Base units are always 6-decimal USDC "micro" units (1 USDC = 1_000_000). */
export const USDC_BASE_DECIMALS = 6;

/**
 * Converts a raw token amount to 6-decimal USDC units.
 * Binance-Peg USDC on BNB Chain has 18 decimals, so a raw value must be scaled
 * down before it is compared with a USDC-denominated price. Skipping this
 * lets a dust transfer satisfy a multi-dollar price.
 */
export function toMicroUsdc(raw: bigint, tokenDecimals: number): bigint {
  if (!Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36) {
    throw new Error(`invalid token decimals: ${tokenDecimals}`);
  }
  if (tokenDecimals === USDC_BASE_DECIMALS) return raw;
  if (tokenDecimals > USDC_BASE_DECIMALS) return raw / 10n ** BigInt(tokenDecimals - USDC_BASE_DECIMALS);
  return raw * 10n ** BigInt(USDC_BASE_DECIMALS - tokenDecimals);
}

export type TransferLike = { from: string; to: string; value: bigint };

/**
 * Sums all transfers into `treasury` (case-insensitive) and returns the total in
 * 6-decimal USDC units plus the first sender.
 */
export function sumTransfersTo(
  treasury: string,
  transfers: TransferLike[],
  tokenDecimals = USDC_BASE_DECIMALS,
): { total: bigint; payer: string | null } {
  const want = treasury.toLowerCase();
  let total = 0n;
  let payer: string | null = null;
  for (const t of transfers) {
    if (String(t.to).toLowerCase() !== want) continue;
    if (t.value <= 0n) continue;
    total += toMicroUsdc(t.value, tokenDecimals);
    if (!payer) payer = String(t.from).toLowerCase();
  }
  return { total, payer };
}

/**
 * Canonical key for a payment transaction. EVM hashes are case-insensitive hex,
 * so they are lower-cased; base58 / other formats are case-sensitive and kept.
 */
export function paymentKey(chain: string, txHash: string): { chain: string; tx_hash: string } {
  const c = String(chain).trim().toLowerCase();
  const h = String(txHash).trim();
  return { chain: c, tx_hash: /^0x[0-9a-fA-F]+$/.test(h) ? h.toLowerCase() : h };
}
