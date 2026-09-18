// The four numbers Quadpad is, in one place.
//
// A card printing "4%" is a claim about a contract, and it is worth exactly as
// much as the check behind it. Tollpad reads its rates straight out of
// `../contracts/src/` and refuses to render if they disagree. Quadpad has no
// contracts yet — the brand was drawn first, on purpose — so the numbers live
// here, and `assertAgainstContracts()` starts enforcing the same rule the day
// those files appear. Nothing about the art has to change on that day.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const contracts = join(here, "..", "contracts", "src");

export const SPEC = {
  /** 4% of everything paid into the pool, in either direction. */
  feeBps: 400,
  /** ...of which this much goes to whoever launched the token. */
  creatorBps: 8_000,
  /** The pool's own LP fee. Zero, so the hook's rate is the entire schedule. */
  lpFee: 0,
  /** One billion, fixed, minted once at launch. */
  supply: 1_000_000_000n * 10n ** 18n,
  /**
   * What the whole supply is worth at the tick the pool opens at, in wei.
   *
   * This is an implied valuation and not a deposit: the pool opens single-sided,
   * so there is no ETH in it until somebody buys. Every piece of copy in this
   * kit says "opens at", never "backed by" — see X-PROFILE.md.
   */
  openingMarketCapWei: 1_700_000_000_000_000_000n, // 1.7 ETH
};

/** The same numbers as strings, spelled the way the art prints them. */
export const RATE = {
  fee: `${SPEC.feeBps / 100}%`,
  creator: `${SPEC.creatorBps / 100}%`,
  treasury: `${(10_000 - SPEC.creatorBps) / 100}%`,
  supply: (SPEC.supply / 10n ** 18n).toLocaleString("en-US"),
  supplyShort: `${SPEC.supply / 10n ** 18n / 1_000_000_000n} billion`,
  marketCap: `${formatEth(SPEC.openingMarketCapWei)} ETH`,
};

/** Wei to a decimal string with no trailing zeroes — 1.7, not 1.700000. */
function formatEth(wei) {
  const whole = wei / 10n ** 18n;
  const fraction = (wei % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

/**
 * Reads a Solidity `constant` out of a contract source.
 *
 * Solidity writes `1_000_000_000e18`, so the exponent is part of the literal and
 * not optional to read: dropping it is how a supply of a billion prints as
 * nothing at all.
 */
function constantFrom(file, name) {
  const source = readFileSync(join(contracts, file), "utf8");
  const match = source.match(new RegExp(`constant\\s+${name}\\s*=\\s*([0-9_]+)(?:e(\\d+))?\\s*;`));
  if (!match) throw new Error(`${file} no longer declares ${name} — the cards cannot state a rate it does not have`);
  return BigInt(match[1].replaceAll("_", "")) * 10n ** BigInt(match[2] ?? 0);
}

/**
 * Holds the art to the contracts, once there are contracts.
 *
 * Until `../contracts/src/` exists this reports that it checked nothing, which
 * the render prints rather than hides — an unchecked number should look
 * unchecked to whoever runs this.
 */
export function assertAgainstContracts() {
  if (!existsSync(contracts)) return { checked: false, reason: "no contracts yet — the numbers above are the spec" };

  const found = {
    feeBps: Number(constantFrom("QuadHook.sol", "FEE_BPS")),
    creatorBps: Number(constantFrom("QuadHook.sol", "CREATOR_BPS")),
    supply: constantFrom("QuadpadFactory.sol", "FIXED_SUPPLY"),
    lpFee: Number(constantFrom("QuadpadFactory.sol", "LP_FEE")),
  };

  for (const [key, value] of Object.entries(found)) {
    if (value !== SPEC[key]) {
      throw new Error(`the contracts now say ${key} is ${value}, the art says ${SPEC[key]} — rewrite the copy before re-rendering`);
    }
  }

  // The locker's whole claim is a negative: there is no way out. A card saying
  // "locked permanently" cannot be allowed to outlive the contract that made it
  // true, so assert the absence rather than trusting it.
  const locker = readFileSync(join(contracts, "QuadLocker.sol"), "utf8");
  for (const pattern of [/function\s+withdraw/, /function\s+collect/, /function\s+rescue/, /liquidityDelta:\s*-/]) {
    if (pattern.test(locker)) throw new Error(`QuadLocker.sol now matches ${pattern} — the lock card would be a lie`);
  }

  return { checked: true, reason: "checked against ../contracts/src" };
}
