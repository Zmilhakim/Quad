// Where a v4 hook is allowed to live.
//
// A pool works out which callbacks to make on its hook by reading the low 14
// bits of the hook's own address — the permissions are the address. So a hook
// cannot be deployed wherever it lands: the address has to be mined for, with
// CREATE2, until it carries exactly the flags the contract implements.
//
// QuadHook checks this in its own constructor and reverts when it is wrong, so
// what this file does is find the salt that makes the deployment succeed.
import { encodeAbiParameters, getContractAddress, keccak256, parseAbiParameters, toHex } from "viem";

/** Hooks.sol's flags, verbatim. */
export const FLAGS = {
  BEFORE_INITIALIZE: 1n << 13n,
  AFTER_INITIALIZE: 1n << 12n,
  BEFORE_ADD_LIQUIDITY: 1n << 11n,
  AFTER_ADD_LIQUIDITY: 1n << 10n,
  BEFORE_REMOVE_LIQUIDITY: 1n << 9n,
  AFTER_REMOVE_LIQUIDITY: 1n << 8n,
  BEFORE_SWAP: 1n << 7n,
  AFTER_SWAP: 1n << 6n,
  BEFORE_DONATE: 1n << 5n,
  AFTER_DONATE: 1n << 4n,
  BEFORE_SWAP_RETURNS_DELTA: 1n << 3n,
  AFTER_SWAP_RETURNS_DELTA: 1n << 2n,
  AFTER_ADD_LIQUIDITY_RETURNS_DELTA: 1n << 1n,
  AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA: 1n << 0n,
};

export const ALL_HOOK_MASK = (1n << 14n) - 1n;

/**
 * The five callbacks QuadHook asks for, and nothing else.
 *
 * `beforeInitialize` is how only the factory can open a pool with this hook in
 * it. The two swap callbacks charge the fee — one for exact-input swaps and one
 * for exact-output — and each needs its RETURNS_DELTA flag, because a hook that
 * changes what a swap costs has to be allowed to say so.
 *
 * The same value is `REQUIRED_FLAGS` in QuadHook.sol. If one changes, both do.
 */
export const QUAD_HOOK_FLAGS =
  FLAGS.BEFORE_INITIALIZE |
  FLAGS.BEFORE_SWAP |
  FLAGS.AFTER_SWAP |
  FLAGS.BEFORE_SWAP_RETURNS_DELTA |
  FLAGS.AFTER_SWAP_RETURNS_DELTA;

/** The names of the flags a given address carries, for printing. */
export function flagsOf(address) {
  const bits = BigInt(address) & ALL_HOOK_MASK;
  return Object.entries(FLAGS)
    .filter(([, flag]) => (bits & flag) !== 0n)
    .map(([name]) => name);
}

export function hasFlags(address, flags = QUAD_HOOK_FLAGS) {
  return (BigInt(address) & ALL_HOOK_MASK) === flags;
}

/** QuadHook's deployment bytecode: its creation code, then its two arguments. */
export function hookInitCode({ creationCode, poolManager, treasury }) {
  return (
    (creationCode.startsWith("0x") ? creationCode : `0x${creationCode}`) +
    encodeAbiParameters(parseAbiParameters("address, address"), [poolManager, treasury]).slice(2)
  );
}

/**
 * Find a salt that puts the hook on an address carrying `flags`.
 *
 * One in 16,384 salts works, so this is a few thousand hashes rather than a
 * proof of work — it takes well under a second. `deployer` is the factory,
 * because the factory is what runs the CREATE2, and the factory's own address
 * therefore has to be known before this can be answered. `predictFactory`
 * below is how.
 */
export function mineHookSalt({ deployer, initCode, flags = QUAD_HOOK_FLAGS, limit = 2_000_000 }) {
  const initCodeHash = keccak256(initCode);

  for (let i = 0; i < limit; i++) {
    const salt = toHex(i, { size: 32 });
    const address = getContractAddress({ bytecodeHash: initCodeHash, from: deployer, opcode: "CREATE2", salt });
    if (hasFlags(address, flags)) return { salt, address, tries: i + 1 };
  }

  throw new Error(`no salt found in ${limit} tries — which should not happen at 1 in 16,384`);
}

/**
 * Where the factory will land if `deployer` sends the next transaction from
 * `nonce`.
 *
 * The hook's address depends on the factory's, and the factory deploys the hook
 * in its own constructor — so the salt has to be mined against an address that
 * does not exist yet. An ordinary CREATE address is a hash of the sender and the
 * nonce, so it can be worked out in advance; if the nonce turns out to be wrong,
 * the hook lands somewhere unflagged and its constructor reverts the whole
 * deployment. There is no way for this to be quietly wrong.
 */
export function predictFactory({ deployer, nonce }) {
  return getContractAddress({ from: deployer, nonce: BigInt(nonce) });
}
