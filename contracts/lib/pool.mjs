// Reading a v4 pool from outside. There is no pool contract to call in v4 — one
// manager holds every pool — so a reader computes the pool's id from its key and
// pulls the state out of the manager's storage with `extsload`. This mirrors
// v4-core's own `PoolIdLibrary` and `StateLibrary`, which is why the slot number
// and the bit layout below are theirs rather than ours.
import { encodeAbiParameters, keccak256, parseAbiParameters, toHex } from "viem";

/// StateLibrary.POOLS_SLOT — where `mapping(PoolId => Pool.State) _pools` lives.
export const POOLS_SLOT = 6n;

const poolKeyParameters = parseAbiParameters("address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks");

/** PoolIdLibrary.toId: keccak256 over the five words of the key. */
export function poolId(key) {
  return keccak256(
    encodeAbiParameters(poolKeyParameters, [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]),
  );
}

/** StateLibrary._getPoolStateSlot: the first word of that pool's state. */
export function poolStateSlot(id) {
  return keccak256(encodeAbiParameters(parseAbiParameters("bytes32, bytes32"), [id, toHex(POOLS_SLOT, { size: 32 })]));
}

/**
 * Unpacks the manager's slot0 word.
 *
 *   0x000000 | lpFee | protocolFee | tick | sqrtPriceX96
 *
 * A `sqrtPriceX96` of zero means the pool has never been initialised, which is
 * the one thing a caller most needs to know before launching into it.
 */
export function decodeSlot0(word) {
  const value = BigInt(word);

  const sqrtPriceX96 = value & ((1n << 160n) - 1n);

  // tick is an int24, so the top bit of those 24 is a sign.
  let tick = Number((value >> 160n) & 0xffffffn);
  if (tick >= 0x800000) tick -= 0x1000000;

  return {
    sqrtPriceX96,
    tick,
    protocolFee: Number((value >> 184n) & 0xffffffn),
    lpFee: Number((value >> 208n) & 0xffffffn),
    initialized: sqrtPriceX96 !== 0n,
  };
}

export const extsloadAbi = [
  {
    type: "function",
    name: "extsload",
    inputs: [{ type: "bytes32" }],
    outputs: [{ type: "bytes32" }],
    stateMutability: "view",
  },
];

/** slot0 for one pool, straight out of the manager's storage. */
export async function readSlot0(publicClient, poolManager, id) {
  const word = await publicClient.readContract({
    address: poolManager,
    abi: extsloadAbi,
    functionName: "extsload",
    args: [poolStateSlot(id)],
  });
  return decodeSlot0(word);
}

/**
 * The pool a Quadpad launch opens: native ETH against the token, no LP fee, and
 * the fee hook in the key.
 *
 * All three are fixed properties of the pool rather than settings. `fee` is zero
 * because the fee is the whole fee schedule, and `hooks` is part of the key —
 * so the rate a pool charges on its first day is the rate it charges forever,
 * and a pool with a different hook in it is simply a different pool.
 */
export function quadpadPoolKey({ token, hook, tickSpacing }) {
  return {
    currency0: "0x0000000000000000000000000000000000000000",
    currency1: token,
    fee: 0,
    tickSpacing,
    hooks: hook,
  };
}
