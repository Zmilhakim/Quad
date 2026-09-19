// Everything an explorer asks for when verifying the deployed contracts, worked
// out from the record rather than typed in. Sends nothing, reads no chain,
// needs no key.
//
// Verification is not decoration here. The pinned post says the contracts can
// be read, and the site says the locker has no withdraw in it — both are claims
// about source nobody can see until this is done, because an unverified address
// shows bytecode and nothing else.
//
// The awkward part of verifying this deployment is that half the addresses were
// not deployed by a person. The factory deploys the hook with CREATE2
// in its own constructor, and the locker with an ordinary CREATE right after,
// so their constructor arguments were never typed anywhere — they have to be
// reconstructed. That is what this does, and it checks each reconstruction
// against the address actually recorded before printing it: a salt or a nonce
// that does not reproduce the deployed address is a failure here rather than a
// rejected submission later.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { encodeAbiParameters, getAddress, getContractAddress, parseAbiParameters } from "viem";

import { configAddress, loadConfig } from "./lib/config.mjs";
import { fail } from "./lib/env.mjs";
import { hookInitCode, mineHookSalt, predictFactory } from "./lib/hooks.mjs";
import { readArtifact } from "./lib/artifacts.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const config = loadConfig();
const poolManager = configAddress(config, "poolManager", "POOL_MANAGER", {
  what: "the Uniswap v4 PoolManager the launchpad opens pools in",
});
const treasury = configAddress(config, "treasury", "TREASURY", {
  what: "where the treasury's share of every fee goes, forever",
});
const deployer = configAddress(config, "deployer", "DEPLOYER", {
  what: "the address that deployed the factory",
});
const factory = configAddress(config, "deployed.factory", "FACTORY", {
  what: "the deployed Quadpad factory — run `npm run deploy` first",
});
const hook = configAddress(config, "deployed.hook", "HOOK", { what: "the deployed fee hook" });
const locker = configAddress(config, "deployed.locker", "LOCKER", { what: "the deployed liquidity locker" });

// The factory is an ordinary CREATE, so its address is a hash of the deployer
// and the nonce it was sent at. The nonce is not written down anywhere, and the
// chain has moved on since, so it is found by trying: the one that reproduces
// the recorded address is the one it was deployed at.
const NONCE_LIMIT = 256;
let nonce = -1;
for (let i = 0; i < NONCE_LIMIT; i++) {
  if (getAddress(predictFactory({ deployer, nonce: i })) === factory) {
    nonce = i;
    break;
  }
}
if (nonce < 0) {
  fail(
    `${factory} is not an address ${deployer} can have deployed in its first ${NONCE_LIMIT} transactions.`,
    "",
    "Either quadpad.config.json names a deployer that did not deploy this factory,",
    "or the recorded factory address is not the one that was deployed.",
  );
}

// The hook is a CREATE2 from the factory, and its salt was mined at deploy time
// rather than chosen. Mining it again finds the same one — the search is
// deterministic, it walks salts from zero and stops at the first that carries
// the flags — but that is an argument, not a proof, so the address it produces
// is checked against the recorded one.
const hookArtifact = readArtifact("QuadHook");
const initCode = hookInitCode({ creationCode: hookArtifact.evm.bytecode.object, poolManager, treasury });
const mined = mineHookSalt({ deployer: factory, initCode });
if (getAddress(mined.address) !== hook) {
  fail(
    `the mined salt puts the hook at ${getAddress(mined.address)}, not at the recorded ${hook}.`,
    "",
    "The hook's creation code is part of what is hashed, so this is what a changed",
    "QuadHook.sol looks like: the checkout no longer builds the contract that was",
    "deployed. Check out the commit that was deployed before verifying.",
  );
}

// The locker is an ordinary CREATE from the factory. A contract's nonce starts
// at 1 and the CREATE2 above spends one, so it should be 2 — should be, so it
// is searched for and checked rather than asserted.
const LOCKER_NONCE_LIMIT = 8;
let lockerNonce = -1;
for (let i = 1; i < LOCKER_NONCE_LIMIT; i++) {
  if (getAddress(getContractAddress({ from: factory, nonce: BigInt(i) })) === locker) {
    lockerNonce = i;
    break;
  }
}
if (lockerNonce < 0) {
  fail(
    `${locker} is not an address the factory at ${factory} deployed.`,
    "",
    "The locker is created by the factory's constructor, so this means the recorded",
    "locker belongs to a different factory than the recorded one.",
  );
}

const encode = (types, values) => encodeAbiParameters(parseAbiParameters(types), values).slice(2);

const CONTRACTS = [
  {
    name: "QuadpadFactory",
    address: factory,
    source: "QuadpadFactory.sol",
    args: [
      ["IPoolManager poolManager_", poolManager],
      ["address treasury_", treasury],
      ["bytes32 hookSalt", mined.salt],
    ],
    encoded: encode("address, address, bytes32", [poolManager, treasury, mined.salt]),
    how: `deployed by ${deployer} at nonce ${nonce}`,
  },
  {
    name: "QuadHook",
    address: hook,
    source: "QuadHook.sol",
    args: [
      ["IPoolManager poolManager_", poolManager],
      ["address treasury_", treasury],
    ],
    encoded: encode("address, address", [poolManager, treasury]),
    how: `CREATE2 from the factory, salt ${mined.salt}`,
  },
  {
    name: "QuadLocker",
    address: locker,
    source: "QuadLocker.sol",
    args: [["IPoolManager poolManager_", poolManager]],
    encoded: encode("address", [poolManager]),
    how: `deployed by the factory at nonce ${lockerNonce}`,
  },
];

// The router is deployed separately and may not exist yet. When it does, it is
// an ordinary CREATE from the deployer like the factory, so the same search
// finds the nonce it went out at.
if (config.deployed?.router) {
  const router = configAddress(config, "deployed.router", "ROUTER", { what: "the deployed QuadRouter" });

  let routerNonce = -1;
  for (let i = 0; i < NONCE_LIMIT; i++) {
    if (getAddress(predictFactory({ deployer, nonce: i })) === router) {
      routerNonce = i;
      break;
    }
  }
  if (routerNonce < 0) {
    fail(
      `${router} is not an address ${deployer} can have deployed in its first ${NONCE_LIMIT} transactions.`,
      "",
      "The recorded router belongs to some other account than the deployer in the config.",
    );
  }

  CONTRACTS.push({
    name: "QuadRouter",
    address: router,
    source: "QuadRouter.sol",
    args: [["IPoolManager poolManager_", poolManager]],
    encoded: encode("address", [poolManager]),
    how: `deployed by ${deployer} at nonce ${routerNonce}`,
  });
}

/** The size of a contract's own input, for choosing what to upload. */
function fileNote(name) {
  try {
    const path = join(here, "out", "verify", `${name}.json`);
    return `   (${(readFileSync(path).length / 1024).toFixed(0)} KB)`;
  } catch {
    return "";
  }
}

const inputPath = join(here, "out", "solc-input.json");
let input;
try {
  input = JSON.parse(readFileSync(inputPath, "utf8"));
} catch {
  fail("out/solc-input.json is not there.", "", "Run `npm run compile` — it writes the verification input.");
}

// The version has to match to the commit hash, not just the release, and the
// one that matters is the compiler in this checkout rather than any written
// down: solc-js reports its own.
const solcVersion = `v${require("solc").version().replace(".Emscripten.clang", "")}`;
const { optimizer, evmVersion } = input.settings;

console.log(`Verify at an explorer that takes a Solidity standard JSON input.\n`);
console.log(`compiler       ${solcVersion}`);
console.log(`optimization   ${optimizer.enabled ? `enabled, ${optimizer.runs} runs` : "disabled"}`);
console.log(`evm version    ${evmVersion}`);
console.log(`json file      one per contract, below — each holds only that contract's own sources`);
console.log(`               (contracts/out/solc-input.json has all ${Object.keys(input.sources).length} at once, if an explorer prefers it)`);
console.log(`license        MIT`);

for (const contract of CONTRACTS) {
  console.log(`\n${contract.name}`);
  console.log(`  address      ${contract.address}`);
  console.log(`  contract     ${contract.source}:${contract.name}`);
  console.log(`  json file    contracts/out/verify/${contract.name}.json${fileNote(contract.name)}`);
  console.log(`  ${contract.how}`);
  for (const [label, value] of contract.args) console.log(`  arg          ${label} = ${value}`);
  console.log(`  constructor arguments, ABI-encoded:`);
  console.log(`  ${contract.encoded}`);
}

console.log(`\nAll ${CONTRACTS.length} were checked against quadpad.config.json before they were printed: the`);
console.log(`nonce reproduces the factory, the salt reproduces the hook, the factory's own`);
console.log(`nonce reproduces the locker${config.deployed?.router ? `, and the deployer's reproduces the router` : ``}.`);
console.log(`The arguments are therefore the ones that were used, not the ones that were`);
console.log(`meant to be.`);
