// Tick math, off-chain, where it belongs. The factory enforces the invariant
// that keeps a launch single-sided; it does not compute prices, so this is what
// turns "the first token costs this much ETH" into the numbers `launch` takes.
//
// getSqrtPriceAtTick is Uniswap v4's TickMath, transliterated rather than
// approximated. That matters: the launch initialises the pool at exactly the
// top of the range, and a price one tick off would be a launch the factory
// refuses.

export const MIN_TICK = -887272;
export const MAX_TICK = 887272;
export const Q96 = 2n ** 96n;

const MAX_UINT256 = 2n ** 256n - 1n;

const MAGIC = [
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

export function getSqrtPriceAtTick(tick) {
  if (!Number.isInteger(tick) || tick < MIN_TICK || tick > MAX_TICK) throw new RangeError(`tick out of range: ${tick}`);

  const absTick = BigInt(Math.abs(tick));
  let ratio = (absTick & 0x1n) !== 0n ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;
  for (const [bit, factor] of MAGIC) {
    if ((absTick & bit) !== 0n) ratio = (ratio * factor) >> 128n;
  }

  if (tick > 0) ratio = MAX_UINT256 / ratio;

  // Q128.128 down to Q128.96, rounding up so the result never sits below the
  // tick it names.
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

/** The highest tick whose price is at or below `sqrtPriceX96`. */
export function tickAtOrBelow(sqrtPriceX96) {
  let low = MIN_TICK;
  let high = MAX_TICK;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (getSqrtPriceAtTick(mid) <= sqrtPriceX96) low = mid;
    else high = mid - 1;
  }
  return low;
}

/** "0.0000001" -> { num: 1n, den: 10000000n }, without going through a float. */
export function parseDecimal(text) {
  const trimmed = String(text).trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`not a decimal number: ${text}`);

  const [whole, fraction = ""] = trimmed.split(".");
  const num = BigInt(whole + fraction);
  if (num === 0n) throw new Error("price must be greater than zero");
  return { num, den: 10n ** BigInt(fraction.length) };
}

/** Accepts either a decimal string or an already-exact {num, den} ratio. */
export function toRatio(price) {
  return typeof price === "object" && price !== null ? price : parseDecimal(price);
}

export function sqrtBigInt(value) {
  if (value < 0n) throw new RangeError("square root of a negative");
  if (value < 2n) return value;

  let guess = 1n << (BigInt(value.toString(2).length) / 2n + 1n);
  let next = (guess + value / guess) >> 1n;
  while (next < guess) {
    guess = next;
    next = (guess + value / guess) >> 1n;
  }
  return guess;
}

/** sqrt(num/den) in Q64.96, the form a pool is initialised with. */
export function sqrtPriceX96FromRatio({ num, den }) {
  return sqrtBigInt((num * Q96 * Q96) / den);
}

export const alignDown = (tick, spacing) => Math.floor(tick / spacing) * spacing;
export const alignUp = (tick, spacing) => Math.ceil(tick / spacing) * spacing;

/**
 * A market cap in ETH spread across a whole supply, as an exact fraction.
 *
 * Prices are quoted as what the entire supply is worth, because that is how
 * anyone actually thinks about a launch — but the pool wants a price per token,
 * and one divided by the other rarely has an exact decimal form. So it is never
 * turned into one: the division is carried as a fraction the whole way to the
 * tick.
 *
 * @param marketCapEth decimal string, e.g. "1" or "300".
 * @param wholeSupply tokens, not wei — 1_000_000_000n, not 1e27.
 */
export function pricePerToken(marketCapEth, wholeSupply) {
  const { num, den } = parseDecimal(marketCapEth);
  return { num, den: den * wholeSupply };
}

/**
 * The launch range for a token priced in ETH.
 *
 * In v4 the other side of the pool is native ETH, which is address zero and so
 * is always currency0. a launched token is therefore always currency1 — there is no
 * ordering to discover — and a pool prices currency1 in currency0, which here
 * means token per ETH. That runs the opposite way to the price being quoted: a
 * dearer token is a *lower* tick, so the floor price is the top of the range
 * and the ceiling is the bottom.
 *
 * The whole supply goes in below spot, and spot starts at the top of the range:
 * the point where the token is cheapest, so the first buy fills immediately and
 * the pool never asks the locker for ETH it does not have.
 *
 * @param floorEthPerToken price of one token in ETH where selling starts.
 * @param ceilEthPerToken  price of one token in ETH at the far end of the range.
 */
export function launchRange({ floorEthPerToken, ceilEthPerToken, tickSpacing }) {
  const floor = toRatio(floorEthPerToken);
  const ceil = toRatio(ceilEthPerToken);
  if (floor.num * ceil.den >= ceil.num * floor.den) throw new Error("the ceiling price must be above the floor price");

  // Inverted on the way in, because the pool counts tokens per ETH.
  const tickOf = ({ num, den }) => tickAtOrBelow(sqrtPriceX96FromRatio({ num: den, den: num }));

  // Both edges round the same way, which keeps the promise the prices made: a
  // lower tick is a dearer token, so rounding down never starts the sale below
  // the floor that was asked for, and never stops it below the ceiling.
  const tickUpper = alignDown(tickOf(floor), tickSpacing);
  const tickLower = alignDown(tickOf(ceil), tickSpacing);
  if (tickLower >= tickUpper) throw new Error("the two prices land on the same tick — widen the range");

  return { tickLower, tickUpper, sqrtPriceX96: getSqrtPriceAtTick(tickUpper), currentTick: tickUpper };
}

/**
 * What a position actually holds right now, in the two currencies.
 *
 * Liquidity is an abstraction; these are not. `eth` is the money that has gone
 * into the pool and cannot come out, and `tokens` is what is still on the
 * shelf — the two figures worth putting in front of anyone.
 *
 * A launch opens with the price above its whole range, which is the same thing
 * as saying the position is all token and holds no ETH at all. So `eth` of zero
 * is not an error state: it means nobody has bought yet.
 *
 *   amount0 = L · (1/√P − 1/√Pb)      the ETH side
 *   amount1 = L · (√P − √Pa)          the token side
 *
 * both in Q96 arithmetic, with √P clamped into the range — outside it the
 * position is entirely one currency, and that clamping is the whole of the
 * special-casing.
 */
export function amountsInPosition(liquidity, sqrtPriceX96, tickLower, tickUpper) {
  if (liquidity === 0n || sqrtPriceX96 === 0n) return { eth: 0n, tokens: 0n };
  if (tickLower >= tickUpper) throw new RangeError(`tickLower ${tickLower} is not below tickUpper ${tickUpper}`);

  const sqrtA = getSqrtPriceAtTick(tickLower);
  const sqrtB = getSqrtPriceAtTick(tickUpper);
  const sqrtP = sqrtPriceX96 < sqrtA ? sqrtA : sqrtPriceX96 > sqrtB ? sqrtB : sqrtPriceX96;

  return {
    eth: sqrtP >= sqrtB ? 0n : (liquidity * Q96 * (sqrtB - sqrtP)) / (sqrtP * sqrtB),
    tokens: sqrtP <= sqrtA ? 0n : (liquidity * (sqrtP - sqrtA)) / Q96,
  };
}

/**
 * What one whole token is worth in wei, from the pool's own price.
 *
 * A v4 pool prices currency1 in currency0, and native ETH is address zero and
 * therefore always currency0 — so what the pool quotes is tokens per ETH, and
 * the price anyone actually wants is its reciprocal. Getting that backwards
 * produces a number that looks plausible and is wrong by a factor of 10^18,
 * which is exactly the kind of figure that ends up in a screenshot.
 *
 * Both currencies have 18 decimals, so nothing needs scaling between them.
 */
export function ethPerTokenFromSqrtPrice(sqrtPriceX96) {
  if (sqrtPriceX96 <= 0n) throw new RangeError("a pool with no price has no price per token");
  return (Q96 * Q96 * 10n ** 18n) / (sqrtPriceX96 * sqrtPriceX96);
}
