/** Formatting helpers. Anything that cannot be derived returns null, never a stand-in zero. */

export function shortAddress(address?: string | null) {
  if (!address || address.length < 10) return null;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const UNITS: Array<[label: string, seconds: number]> = [
  ["d", 86_400],
  ["h", 3_600],
  ["m", 60],
];

/** "3h ago" from a unix timestamp. Returns null for the zero timestamp. */
export function timeAgo(unixSeconds: bigint | number | null | undefined, now = Date.now()) {
  if (unixSeconds === null || unixSeconds === undefined) return null;
  const seconds = Number(unixSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const elapsed = Math.max(0, Math.floor(now / 1000) - seconds);
  for (const [label, size] of UNITS) {
    if (elapsed >= size) return `${Math.floor(elapsed / size)}${label} ago`;
  }
  return "just now";
}

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 });
const PLAIN = new Intl.NumberFormat("en-US");

export function formatCount(value: bigint | number | null | undefined) {
  if (value === null || value === undefined) return null;
  return PLAIN.format(typeof value === "bigint" ? Number(value) : value);
}

/** Token amounts arrive as 18-decimal integers; show them the way anyone reads them. */
export function formatTokenAmount(raw: bigint | null | undefined, decimals = 18) {
  if (raw === null || raw === undefined) return null;
  return COMPACT.format(Number(raw / 10n ** BigInt(decimals)));
}

export function formatEth(wei: bigint | null | undefined) {
  if (wei === null || wei === undefined) return null;
  if (wei === 0n) return "0 ETH";
  const eth = Number(wei) / 1e18;
  return `${eth < 0.0001 ? eth.toExponential(2) : eth.toFixed(5).replace(/0+$/, "").replace(/\.$/, "")} ETH`;
}

/** A basis-point rate as a percentage: 400 -> "4%". */
export function formatBps(bps: bigint | number | null | undefined) {
  if (bps === null || bps === undefined) return null;
  return `${Number(bps) / 100}%`;
}
