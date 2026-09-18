// The address arithmetic, on its own. A hook's permissions are the low 14 bits
// of its address, so getting this wrong does not fail loudly — it deploys a
// launchpad whose fee is never charged, which is why the contract checks it too
// and why it is worth a test of its own.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { getContractAddress, keccak256 } from "viem";

import { ALL_HOOK_MASK, FLAGS, flagsOf, hasFlags, hookInitCode, mineHookSalt, predictFactory, QUAD_HOOK_FLAGS } from "../lib/hooks.mjs";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const hookArtifact = JSON.parse(readFileSync(join(out, "QuadHook.json"), "utf8"));

const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const TREASURY = "0xdE008B8597ca2612c02a02Fb97C27011e159EA83";
const DEPLOYER = "0xDC693F2Df63fFE651b4ab8c943A0382747693d59";

test("the flags are the five callbacks the hook implements, and no others", () => {
  assert.equal(QUAD_HOOK_FLAGS, 0x20ccn);

  assert.deepEqual(
    Object.entries(FLAGS)
      .filter(([, flag]) => (QUAD_HOOK_FLAGS & flag) !== 0n)
      .map(([name]) => name)
      .sort(),
    ["AFTER_SWAP", "AFTER_SWAP_RETURNS_DELTA", "BEFORE_INITIALIZE", "BEFORE_SWAP", "BEFORE_SWAP_RETURNS_DELTA"],
  );

  // Nothing about liquidity or donations: the hook has no business being called
  // when a position changes, and asking to be would cost gas on every launch.
  for (const name of ["BEFORE_ADD_LIQUIDITY", "AFTER_REMOVE_LIQUIDITY", "BEFORE_DONATE", "AFTER_INITIALIZE"]) {
    assert.equal(QUAD_HOOK_FLAGS & FLAGS[name], 0n, `${name} should not be asked for`);
  }
});

test("a mined salt lands the hook on an address the pool manager will call", () => {
  const factory = predictFactory({ deployer: DEPLOYER, nonce: 0 });
  const initCode = hookInitCode({
    creationCode: hookArtifact.evm.bytecode.object,
    poolManager: POOL_MANAGER,
    treasury: TREASURY,
  });

  const mined = mineHookSalt({ deployer: factory, initCode });

  assert.ok(hasFlags(mined.address), `${mined.address} carries ${flagsOf(mined.address).join(", ")}`);
  assert.equal(BigInt(mined.address) & ALL_HOOK_MASK, QUAD_HOOK_FLAGS);

  // It is the CREATE2 address for that salt, not merely an address with the
  // right bits: the factory has to be able to reach it.
  assert.equal(
    mined.address,
    getContractAddress({ bytecodeHash: keccak256(initCode), from: factory, opcode: "CREATE2", salt: mined.salt }),
  );

  // One in 16,384 salts works, so finding one is quick — but it is worth
  // knowing if that ever stops being true.
  assert.ok(mined.tries < 200_000, `mining took ${mined.tries} tries`);
});

test("the answer depends on every input, so a salt cannot be reused blindly", () => {
  const initCode = (treasury) =>
    hookInitCode({ creationCode: hookArtifact.evm.bytecode.object, poolManager: POOL_MANAGER, treasury });

  const factory = predictFactory({ deployer: DEPLOYER, nonce: 0 });
  const mine = (deployer, treasury) => mineHookSalt({ deployer, initCode: initCode(treasury) }).salt;

  // A different treasury is different constructor arguments, so different
  // creation code, so a different address for the same salt.
  assert.notEqual(mine(factory, TREASURY), mine(factory, DEPLOYER));

  // And a factory deployed from a different nonce is a different deployer.
  assert.notEqual(mine(factory, TREASURY), mine(predictFactory({ deployer: DEPLOYER, nonce: 1 }), TREASURY));
});

test("an address with the wrong bits is rejected however close it is", () => {
  const good = "0x00000000000000000000000000000000000020cc";
  assert.ok(hasFlags(good));

  // One bit out in either direction, and the pool manager calls a different set
  // of hooks than this contract implements.
  assert.ok(!hasFlags("0x00000000000000000000000000000000000020cd"));
  assert.ok(!hasFlags("0x00000000000000000000000000000000000020c8"));
  assert.ok(!hasFlags("0x00000000000000000000000000000000000000cc"));

  // The high bits are nobody's business: only the low 14 matter.
  assert.ok(hasFlags("0xffffffffffffffffffffffffffffffffffff20cc"));
});
