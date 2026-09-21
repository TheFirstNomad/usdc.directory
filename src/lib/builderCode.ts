/**
 * Base Builder Code attribution (ERC-8021).
 *
 * Appends our registered builder code to the `data` field of every Base mainnet
 * transaction we send directly. Transactions executed through Circle App Kit
 * (Arc Mainnet) are NOT attributed — Circle's SDK builds and signs its own
 * calldata internally, so we have no hook to inject the suffix there.
 *
 * Spec: https://eips.ethereum.org/EIPS/eip-8021
 * Dashboard: https://base.dev
 */
import { Attribution } from "ox/erc8021";

export const BUILDER_CODE = "bc_madq6cms";

/** Precomputed hex suffix (with 0x prefix) — append to calldata for attribution. */
export const DATA_SUFFIX: `0x${string}` = Attribution.toDataSuffix({
  codes: [BUILDER_CODE],
});

/** Concatenate the ERC-8021 suffix to encoded calldata. */
export function withAttribution(data: `0x${string}`): `0x${string}` {
  return `${data}${DATA_SUFFIX.slice(2)}` as `0x${string}`;
}
