import { encodeAbiParameters, keccak256, parseAbiParameters, toHex, type Address, type Hex } from "viem";

import { LP_FEE, NATIVE } from "./contracts";

/**
 * Reading a v4 pool from a browser.
 *
 * There is no pool contract to call in v4 — one manager holds every pool — so a
 * reader computes the pool's id from its key and pulls the state out of the
 * manager's storage with `extsload`. This mirrors v4-core's own `PoolIdLibrary`
 * and `StateLibrary`, which is why the slot number and the bit layout are theirs
 * rather than ours. The same code exists in contracts/lib/pool.mjs, where a test
 * checks it against the id and the price a real manager has.
 */

/** StateLibrary.POOLS_SLOT — where `mapping(PoolId => Pool.State) _pools` lives. */
const POOLS_SLOT = 6n;

const poolKeyParameters = parseAbiParameters(
  "address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks",
);

export type PoolKey = {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
};

/**
 * The pool a Quadpad launch opens: native ETH against the token, no LP fee, and
 * the fee hook in the key.
 *
 * All three are properties of the pool rather than settings. `fee` is zero
 * because the fee is the whole fee schedule, and `hooks` is part of the key —
 * so the rate a pool charges on its first day is the rate it charges forever,
 * and a pool with a different hook in it is simply a different pool.
 */
export function quadpadPoolKey(token: Address, hook: Address, tickSpacing: number): PoolKey {
  return { currency0: NATIVE, currency1: token, fee: LP_FEE, tickSpacing, hooks: hook };
}

/** PoolIdLibrary.toId: keccak256 over the five words of the key. */
export function poolId(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(poolKeyParameters, [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]),
  );
}

/** StateLibrary._getPoolStateSlot: the first word of that pool's state. */
export function poolStateSlot(id: Hex): Hex {
  return keccak256(encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [id, toHex(POOLS_SLOT, { size: 32 })]));
}

export type Slot0 = {
  sqrtPriceX96: bigint;
  tick: number;
  lpFee: number;
  initialized: boolean;
};

/**
 * Unpacks the manager's slot0 word:
 *
 *   0x000000 | lpFee | protocolFee | tick | sqrtPriceX96
 *
 * A `sqrtPriceX96` of zero means the pool was never initialised, which is the
 * one thing a page most needs to know before showing a price.
 */
export function decodeSlot0(word: Hex): Slot0 {
  const value = BigInt(word);
  const sqrtPriceX96 = value & ((1n << 160n) - 1n);

  // tick is an int24, so the top of those 24 bits is a sign.
  let tick = Number((value >> 160n) & 0xffffffn);
  if (tick >= 0x800000) tick -= 0x1000000;

  return {
    sqrtPriceX96,
    tick,
    lpFee: Number((value >> 208n) & 0xffffffn),
    initialized: sqrtPriceX96 !== 0n,
  };
}

const Q96 = 2n ** 96n;

/**
 * ETH per token, as a float, for display only.
 *
 * The pool prices currency1 in currency0, which here is tokens per ETH — the
 * opposite way round to how anyone quotes a token. Inverting it needs real
 * division, so this is the one place a float is allowed: nothing is signed
 * against it, and every number that is signed against goes through the contract.
 */
export function ethPerToken(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 === 0n) return 0;
  const ratio = Number(Q96) / Number(sqrtPriceX96);
  return ratio * ratio;
}

export const extsloadAbi = [
  {
    type: "function",
    name: "extsload",
    inputs: [{ type: "bytes32" }],
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
  },
] as const;
