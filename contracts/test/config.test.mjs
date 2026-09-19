// The config loader, and the mistakes it exists to stop.
//
// None of them is caught by the contract tests: those never load a config. And
// a launchpad deploys exactly once, so the first run of `npm run deploy` is the
// only chance to catch a wrong treasury — after it, the address is an immutable
// in the hook and every fee the treasury side ever earns goes to it.
//
// Each case runs in its own process, because that is how the scripts run and
// because `fail` exits rather than throwing. What is asserted is what an
// operator would actually see: a non-zero exit and a reason on stderr.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../lib/config.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);

/** Resolves one config address in a child process, and reports how it went. */
function resolve(path, envName, value) {
  const script = `
    import { configAddress, loadConfig } from ${JSON.stringify(join(root, "lib", "config.mjs"))};
    const address = configAddress(loadConfig(), ${JSON.stringify(path)}, ${JSON.stringify(envName)}, { what: "it" });
    console.log(address);
  `;

  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    encoding: "utf8",
    env: value === undefined ? { ...process.env } : { ...process.env, [envName]: value },
  });

  return { ok: run.status === 0, out: run.stdout.trim(), why: run.stderr.trim() };
}

const TOLLPAD_TREASURY = "0xb1A81E4A729c87560eF12d7652D883e803C5422E";
const TOLLPAD_DEPLOYER = "0xF914569f6207Bd87f8568b770eC7166788fD7B72";

test("Toollpad's treasury is refused, however it is spelled", () => {
  for (const spelling of [TOLLPAD_TREASURY, TOLLPAD_TREASURY.toLowerCase()]) {
    const result = resolve("treasury", "TREASURY", spelling);
    assert.equal(result.ok, false, `${spelling} was accepted as Quadpad's treasury`);
    assert.match(result.why, /Toollpad's treasury/);
  }
});

test("Toollpad's deployer is refused too", () => {
  const result = resolve("deployer", "DEPLOYER", TOLLPAD_DEPLOYER);
  assert.equal(result.ok, false, "Toollpad's deployer was accepted");
  assert.match(result.why, /Toollpad's deployer/);
});

test("an address of Quadpad's own is accepted", () => {
  const result = resolve("treasury", "TREASURY", "0x1111111111111111111111111111111111111111");
  assert.equal(result.ok, true, result.why);
  assert.equal(result.out, "0x1111111111111111111111111111111111111111");
});

test("the committed config carries two addresses, and they are Quadpad's", () => {
  const config = loadConfig();

  // Both are set, both resolve, and — the point of all of this — neither is
  // the address Toollpad pays. `configAddress` returns them checksummed, and
  // the file holds them in exactly that form, so a diff of this file is a
  // review of the real value rather than of a spelling of it.
  for (const path of ["treasury", "deployer"]) {
    const result = resolve(path, "NOTHING_SET_HERE", undefined);
    assert.equal(result.ok, true, `${path} does not resolve:\n${result.why}`);
    assert.equal(result.out, config[path], `${path} in the file is not the checksummed form`);
  }

  assert.notEqual(config.treasury.toLowerCase(), TOLLPAD_TREASURY.toLowerCase());
  assert.notEqual(config.deployer.toLowerCase(), TOLLPAD_DEPLOYER.toLowerCase());

  // And they are two addresses rather than one typed twice. The deployer signs
  // and can be discarded afterwards; the treasury is paid forever and should
  // not be a key that signs anything else.
  assert.notEqual(config.treasury.toLowerCase(), config.deployer.toLowerCase());
});

test("an address the config does not have is refused, not defaulted", () => {
  // A path that exists in shape and holds nothing. A missing address has to
  // stop a script rather than resolve to something.
  //
  // This used to point at `deployed.factory`, which was empty until the
  // launchpad was deployed — and the day it was filled, this test failed rather
  // than quietly testing nothing, which is the whole reason it names a key that
  // is never going to be written.
  const result = resolve("deployed.nothing", "NOTHING_SET_HERE", undefined);
  assert.equal(result.ok, false, "a missing address resolved to something");
  assert.match(result.why, /is not set in quadpad\.config\.json/);
});

test("the recorded deployment is three distinct addresses, stored checksummed", () => {
  const { deployed } = loadConfig();

  // `deploy.mjs` reads all three back off the chain before writing them here,
  // so what this checks is the record rather than the chain: that it is
  // complete, that it is in the form `configAddress` hands back, and that no
  // two of them are the same address typed twice.
  for (const key of ["factory", "hook", "locker"]) {
    const result = resolve(`deployed.${key}`, "NOTHING_SET_HERE", undefined);
    assert.equal(result.ok, true, `deployed.${key} does not resolve:\n${result.why}`);
    assert.equal(result.out, deployed[key], `deployed.${key} is not stored in its checksummed form`);
  }

  const addresses = ["factory", "hook", "locker"].map((key) => deployed[key].toLowerCase());
  assert.equal(new Set(addresses).size, 3, "two of the deployed addresses are the same");
});

test("a mistyped address fails its checksum rather than pointing somewhere real", () => {
  // Toollpad's treasury with its last character changed: still 42 characters of
  // hex, still an address by shape, and not one anybody meant to type. This is
  // also what stops the guard above being sidestepped by a typo.
  const result = resolve("treasury", "TREASURY", `${TOLLPAD_TREASURY.slice(0, -1)}F`);
  assert.equal(result.ok, false, "an address with a broken checksum was accepted");
  assert.match(result.why, /bad checksum/);
});

test("every script still resolves what it imports", () => {
  // `configAddress` was deleted from lib/config.mjs by accident once, and
  // nothing noticed: the contract tests do not load the scripts, and a syntax
  // check does not resolve imports. Every one of these would have thrown
  // "does not provide an export named 'configAddress'" on the first real run.
  for (const script of ["deploy.mjs", "launch.mjs", "collect.mjs", "status.mjs", "mine.mjs", "whoami.mjs", "verify.mjs", "deploy-router.mjs", "swap.mjs", "watch.mjs"]) {
    const run = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `await import(${JSON.stringify(join(root, script))});`],
      { cwd: root, encoding: "utf8", env: { ...process.env, DEPLOYER_KEY: "", NAME: "", SYMBOL: "" } },
    );

    assert.doesNotMatch(
      run.stderr,
      /does not provide an export|Cannot find module/,
      `${script} does not resolve its imports:\n${run.stderr}`,
    );
  }
});

test("the verification input is for the contracts that were deployed", () => {
  // `verify.mjs` reconstructs what was never written down — the factory's
  // nonce, the hook's salt, the locker's nonce — and refuses to print anything
  // that does not reproduce the address in the config. So running it is a check
  // on the deployment as much as a way to fill in an explorer's form: it fails
  // if the checkout no longer builds the hook that is on the chain.
  const run = spawnSync(process.execPath, [join(root, "verify.mjs")], { cwd: root, encoding: "utf8" });

  assert.equal(run.status, 0, `verify.mjs failed:\n${run.stderr}`);

  const config = loadConfig();
  for (const address of Object.values(config.deployed)) {
    assert.ok(run.stdout.includes(address), `verify.mjs did not account for ${address}`);
  }
});
