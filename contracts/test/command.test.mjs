// The line `launch.mjs` prints when it has not sent anything yet.
//
// It printed NAME and SYMBOL and nothing else once, which meant that running
// the command it had just handed you launched the token without its picture,
// its blurb or its link — the three fields the factory writes once and never
// touches again. Everything else on that screen was right, which is what made
// it worth a test rather than a fix.
import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

import { LAUNCH_FIELDS, relaunchCommand, shellQuote } from "../lib/command.mjs";

const PARAMS = {
  name: "Quad Zero",
  symbol: "QZERO",
  imageURI: "https://quadpad.fun/brand/logo-mark.svg",
  blurb: "The first launch on Quadpad. Proof the contracts work, not a project token.",
  link: "https://quadpad.fun",
};

test("the command to confirm a launch carries every field that was set", () => {
  const command = relaunchCommand(PARAMS);

  for (const [env, key] of LAUNCH_FIELDS) {
    assert.ok(command.includes(PARAMS[key]), `${env} is missing from:\n  ${command}`);
  }
  assert.match(command, /CONFIRM=launch npm run launch$/);
});

test("a field that was not set is left out rather than passed empty", () => {
  const command = relaunchCommand({ ...PARAMS, imageURI: "", blurb: "", link: "" });

  assert.doesNotMatch(command, /IMAGE|BLURB|LINK/);
  assert.match(command, /^NAME='Quad Zero' SYMBOL='QZERO' CONFIRM=launch npm run launch$/);
});

test("the shell reads back exactly what went in", () => {
  // Not an assertion about quoting rules — an actual shell, parsing the actual
  // line. A blurb with an apostrophe in it is the first thing anyone writes.
  const awkward = {
    name: "Don't Panic",
    symbol: "QZERO",
    imageURI: "https://example.test/a b.svg",
    blurb: `it's $HOME "and" \`that\` \\ too`,
    link: "https://example.test/?a=1&b=2",
  };

  for (const [env, key] of LAUNCH_FIELDS) {
    const printed = execFileSync("/bin/sh", ["-c", `printf %s ${shellQuote(awkward[key])}`], { encoding: "utf8" });
    assert.equal(printed, awkward[key], `${env} did not survive the shell`);
  }

  // And the whole line parses as assignments, with nothing expanded.
  const line = relaunchCommand(awkward).replace(/ npm run launch$/, " env");
  const env = execFileSync("/bin/sh", ["-c", line], { encoding: "utf8" });

  for (const [name, key] of LAUNCH_FIELDS) {
    assert.ok(env.includes(`${name}=${awkward[key]}`), `${name} came out of the shell changed:\n${env}`);
  }
});
