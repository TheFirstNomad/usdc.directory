/**
 * Base-direct USDC listing-fee payment with ERC-8021 builder code attribution.
 *
 * Sends a plain USDC `transfer(treasury, amount)` via wagmi's
 * `sendTransaction`, then appends our ERC-8021 suffix so the transfer's
 * "Input Data" is attributed to our builder code on base.dev / BaseScan.
 *
 * Arc Mainnet payments continue to flow through Circle App Kit (kit.send) —
 * this helper is Base-mainnet only.
 */
import { encodeFunctionData, parseUnits } from "viem";
import { withAttribution, DATA_SUFFIX } from "@/lib/builderCode";
import { TREASURY_ADDRESS } from "@/lib/arcAppKit";

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

// Base mainnet USDC (native, Circle-issued)
export const BASE_USDC_ADDRESS: `0x${string}` =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const BASE_CHAIN_ID = 8453 as const;

export type BasePaymentDebug = {
  to: `0x${string}`;
  raw: `0x${string}`;
  attributed: `0x${string}`;
  suffix: `0x${string}`;
};

export function buildBaseUsdcTransferCalldata(amountUsdc: string): BasePaymentDebug {
  const amount = parseUnits(amountUsdc, 6);
  const raw = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [TREASURY_ADDRESS, amount],
  });
  const attributed = withAttribution(raw);
  return {
    to: BASE_USDC_ADDRESS,
    raw,
    attributed,
    suffix: DATA_SUFFIX,
  };
}

export function getBaseScanTxUrl(txHash: string) {
  return `https://basescan.org/tx/${txHash}`;
}

export function getBaseScanInputDataUrl(txHash: string) {
  // BaseScan auto-shows Input Data tab; this anchor jumps users to it
  return `https://basescan.org/tx/${txHash}#statechange`;
}
