// The four numbers Quadpad is, in one place.
//
// A card printing "4%" is a claim about a contract, and it is worth exactly as
// much as the check behind it. So every figure below is read back out of
// `../contracts/src/` on every render, and the render fails rather than
// shipping a number the contracts do not agree with.
//
// This file was written before those contracts existed, holding the numbers as
// a specification and reporting `checked: false` on every render. The contracts
// have since landed and none of the art changed — the checking simply started,
// which is the order it was meant to happen in.
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
   * The tick every pool opens at, and the top of its range.
   *
   * The market cap follows from this rather than the other way round: ticks are
   * discrete, so 1.7 ETH is a target and 201936 is the tick nearest it.
   */
  openingTick: 201936,

  /** The bottom of the range, and the spacing both ends sit on. */
  tickLower: 155904,
  tickSpacing: 336,

  /**
   * What the whole supply is worth at the tick the pool opens at, in wei.
   *
   * 1.700080239474970520, computed from `openingTick` below rather than typed:
   * a second copy of a number is a number that can drift.
   *
   * It is an implied valuation and not a deposit — the pool opens single-sided,
   * so there is no ETH in it until somebody buys. Every piece of copy in this
   * kit says "opens at", never "backed by". See X-PROFILE.md.
   */
  get openingMarketCapWei() {
    return marketCapAtTick(this.openingTick, this.supply);
  },
};

/** Q64.96, the fixed-point form a v4 pool keeps its price in. */
const Q96 = 2n ** 96n;

/**
 * v4's TickMath.getSqrtPriceAtTick, transliterated.
 *
 * The same constants the pool manager uses, so the price this file computes is
 * the price the chain will report — not an approximation of it. `1.0001 ** tick`
 * in floating point is off by enough to move the last few digits of a market
 * cap, which is exactly the figure this file exists to be precise about.
 */
function sqrtPriceAtTick(tick) {
  const MAGIC = [
    [0x1n, 0xfffcb933bd6fad37aa2d162d1a594001n],
    [0x2n, 0xfff97272373d413259a46990580e213an],
    [0x4n, 0xfff2e50f5f656932ef12357cf3c7fdccn],
    [0x8n, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
    [0x10n, 0xffcb9843d60f6159c9db58835c926644n],
    [0x20n, 0xff973b41fa98c081472e6896dfb254c0n],
    [0x40n, 0xff2ea16466c96a3843ec78b326b52861n],
    [0x80n, 0xfe5dee046a99a2a811c461f1969c3053n],
    [0x100n, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
    [0x200n, 0xf987a7253ac413176f2b074cf7815e54n],
    [0x400n, 0xf3392b0822b70005940c7a398e4b70f3n],
    [0x800n, 0xe7159475a2c29b7443b29c7fa6e889d9n],
    [0x1000n, 0xd097f3bdfd2022b8845ad8f792aa5825n],
    [0x2000n, 0xa9f746462d870fdf8a65dc1f90e061e5n],
    [0x4000n, 0x70d869a156d2a1b890bb3df62baf32f7n],
    [0x8000n, 0x31be135f97d08fd981231505542fcfa6n],
    [0x10000n, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
    [0x20000n, 0x5d6af8dedb81196699c329225ee604n],
    [0x40000n, 0x2216e584f5fa1ea926041bedfe98n],
    [0x80000n, 0x48a170391f7dc42444e8fa2n],
  ];

  const absTick = BigInt(Math.abs(tick));
  let ratio = 0x100000000000000000000000000000000n;
  for (const [bit, factor] of MAGIC) {
    if ((absTick & bit) !== 0n) ratio = (ratio * factor) >> 128n;
  }
  if (tick > 0) ratio = (2n ** 256n - 1n) / ratio;

  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

/**
 * What a whole supply is worth in wei at a given tick.
 *
 * A v4 pool quotes currency1 per currency0 as `(sqrtPriceX96 / 2^96)^2`, and
 * native ETH is address zero and so always currency0 — so what it quotes is
 * tokens per ETH, and one unit of the token costs the reciprocal. The same
 * arithmetic `QuadpadFactory.openingMarketCap()` does, and the render below
 * checks the two against each other.
 */
function marketCapAtTick(tick, supply) {
  const sqrtPriceX96 = sqrtPriceAtTick(tick);
  return (supply * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96);
}

/**
 * The market cap the art is allowed to print, and the proof it may.
 *
 * The exact figure is 1.700080239474970520 ETH, because ticks are discrete. The
 * art says "1.7 ETH", which is that number to four significant figures — but
 * "close enough" is a judgement, and a judgement that is not measured is one
 * that quietly stops being true. So the rounding is asserted: move
 * `openingTick` far enough that the exact value leaves a basis point of 1.7 and
 * this throws, and nothing renders until the copy is rewritten.
 */
const DISPLAY_MARKET_CAP = "1.7";

function assertDisplayRounding() {
  const claimed = 17n * 10n ** 17n; // 1.7 ETH, as the art states it
  const exact = SPEC.openingMarketCapWei;
  const drift = exact > claimed ? exact - claimed : claimed - exact;

  if (drift * 10_000n > claimed) {
    throw new Error(
      `tick ${SPEC.openingTick} opens at ${formatEth(exact)} ETH, which is more than a basis point off the ${DISPLAY_MARKET_CAP} ETH the art prints — rewrite the copy`,
    );
  }
}
assertDisplayRounding();

/** The same numbers as strings, spelled the way the art prints them. */
export const RATE = {
  fee: `${SPEC.feeBps / 100}%`,
  creator: `${SPEC.creatorBps / 100}%`,
  treasury: `${(10_000 - SPEC.creatorBps) / 100}%`,
  supply: (SPEC.supply / 10n ** 18n).toLocaleString("en-US"),
  supplyShort: `${SPEC.supply / 10n ** 18n / 1_000_000_000n} billion`,
  /** For the art: the number a person says out loud. */
  marketCap: `${DISPLAY_MARKET_CAP} ETH`,
  /** For the fine print: every digit the chain will actually report. */
  marketCapExact: `${formatEth(SPEC.openingMarketCapWei)} ETH`,
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
    openingTick: Number(constantFrom("QuadpadFactory.sol", "OPENING_TICK")),
    tickLower: Number(constantFrom("QuadpadFactory.sol", "TICK_LOWER")),
    tickSpacing: Number(constantFrom("QuadpadFactory.sol", "TICK_SPACING")),
  };

  for (const [key, value] of Object.entries(found)) {
    if (value !== SPEC[key]) {
      throw new Error(`the contracts now say ${key} is ${value}, the art says ${SPEC[key]} — rewrite the copy before re-rendering`);
    }
  }

  // The opening price is the one claim on this art that is arithmetic rather
  // than a constant, so check the arithmetic too: the tick has to land on the
  // spacing, or the position's top edge is not the price being advertised and
  // the first buy fills somewhere else entirely.
  if (found.openingTick % found.tickSpacing !== 0) {
    throw new Error(`tick ${found.openingTick} is not a multiple of the spacing ${found.tickSpacing} — the opening price is not where the liquidity starts`);
  }
  if (found.tickLower % found.tickSpacing !== 0 || found.tickLower >= found.openingTick) {
    throw new Error(`the range ${found.tickLower} … ${found.openingTick} is not a range on a grid of ${found.tickSpacing}`);
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
