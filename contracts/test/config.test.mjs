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

test("Tollpad's treasury is refused, however it is spelled", () => {
  for (const spelling of [TOLLPAD_TREASURY, TOLLPAD_TREASURY.toLowerCase()]) {
    const result = resolve("treasury", "TREASURY", spelling);
    assert.equal(result.ok, false, `${spelling} was accepted as Quadpad's treasury`);
    assert.match(result.why, /Tollpad's treasury/);
  }
});

test("Tollpad's deployer is refused too", () => {
  const result = resolve("deployer", "DEPLOYER", TOLLPAD_DEPLOYER);
  assert.equal(result.ok, false, "Tollpad's deployer was accepted");
  assert.match(result.why, /Tollpad's deployer/);
});

test("an address of Quadpad's own is accepted", () => {
  const result = resolve("treasury", "TREASURY", "0x1111111111111111111111111111111111111111");
  assert.equal(result.ok, true, result.why);
  assert.equal(result.out, "0x1111111111111111111111111111111111111111");
});

test("the committed config supplies neither, so a deploy cannot inherit one", () => {
  // Nothing is deployed, and the two keys have to be made on somebody's own
  // machine — so the honest state of this file is empty, and every script that
  // needs an address says so rather than quietly defaulting to one.
  const config = loadConfig();
  assert.equal(config.treasury, "");
  assert.equal(config.deployer, "");

  for (const path of ["treasury", "deployer"]) {
    const result = resolve(path, "NOTHING_SET_HERE", undefined);
    assert.equal(result.ok, false, `${path} resolved to something despite being empty`);
    assert.match(result.why, /is not set in quadpad\.config\.json/);
  }
});

test("a mistyped address fails its checksum rather than pointing somewhere real", () => {
  // Tollpad's treasury with its last character changed: still 42 characters of
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
  for (const script of ["deploy.mjs", "launch.mjs", "collect.mjs", "status.mjs", "mine.mjs", "whoami.mjs"]) {
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
