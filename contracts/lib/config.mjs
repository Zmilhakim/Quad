// The launchpad, written down once.
//
// Everything here is public: contract addresses, a tick spacing, two prices. The
// private keys that sign the transactions are not here and never will be —
// they live in the operator's password manager and reach the scripts through
// the environment, one shell session at a time.
//
// Having it in a file rather than in a shell history is the point. TREASURY is
// immutable once deployed, so the difference between the right address and a
// transposed one is permanent, and a value that was reviewed in a diff is
// easier to trust than one retyped at the prompt.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getAddress, isAddress } from "viem";

import { fail } from "./env.mjs";

const CONFIG_PATH = join(dirname(dirname(fileURLToPath(import.meta.url))), "quadpad.config.json");

export function loadConfig() {
  let raw;
  try {
    raw = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    fail(`cannot read quadpad.config.json: ${error.message}`);
  }

  refuseSecrets(raw, "");
  return raw;
}

/**
 * This file is committed, so anything key-shaped in it is already a mistake and
 * possibly already public. Stop rather than carry on and deploy with it.
 *
 * An address is 42 characters; a private key is 66. Nothing this config holds is
 * ever 66 characters of hex, so the test needs no cleverness.
 */
function refuseSecrets(node, path) {
  if (typeof node === "string") {
    if (/^0x[0-9a-fA-F]{64}$/.test(node.trim())) {
      fail(
        `${path || "a value"} in quadpad.config.json looks like a private key.`,
        "",
        "This file is committed to the repository. If that is a real key, treat it",
        "as public from now on: move the funds, and never use it again.",
        "",
        "Only addresses belong here. Keys reach the scripts through DEPLOYER_KEY,",
        "in your shell, one session at a time.",
      );
    }
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) refuseSecrets(value, path ? `${path}.${key}` : key);
  }
}

export function saveConfig(config) {
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

/** Reads `a.b.c` out of the config, or undefined. */
const at = (config, path) => path.split(".").reduce((node, key) => node?.[key], config);

/**
 * The addresses Tollpad deploys with.
 *
 * Quadpad is a different launchpad and pays a different treasury, but the two
 * configs are one directory apart and identical in shape, so the way this goes
 * wrong is a copy-paste nobody re-reads. `treasury` in particular is an
 * `immutable` in the hook from `npm run deploy` onwards: paid to the wrong
 * address, every fee this launchpad ever earns on the treasury side goes there,
 * and no function anywhere moves it.
 *
 * This repository shipped exactly that mistake in an earlier commit — these two
 * addresses were carried over wholesale with a note asking whoever deployed to
 * remember to change them. A note is not a check.
 */
const TOLLPADS = {
  treasury: "0xb1A81E4A729c87560eF12d7652D883e803C5422E",
  deployer: "0xF914569f6207Bd87f8568b770eC7166788fD7B72",
};

/**
 * An address the config must supply. The environment wins when it is set, so a
 * one-off can still be driven from the shell, but the file is what gets
 * reviewed. Returns it checksummed, which is also the check: a mistyped
 * character usually fails the checksum rather than pointing somewhere real.
 */
export function configAddress(config, path, envName, { what }) {
  const value = (process.env[envName] ?? at(config, path) ?? "").trim();

  if (value === "") {
    fail(
      `${path} is not set in quadpad.config.json — ${what}`,
      "",
      `Put the address in the file, or pass it once as ${envName}=0x…`,
    );
  }

  // Two checks, because they are two different mistakes. A loose `isAddress`
  // catches the wrong shape; a strict one verifies the EIP-55 checksum that
  // mixed-case addresses carry, which is what catches a transposed character.
  // `getAddress` does neither — it recomputes the checksum and hands it back.
  if (!isAddress(value, { strict: false })) fail(`${path} is not an address: ${value}`);

  if (!isAddress(value)) {
    fail(
      `${path} has a bad checksum: ${value}`,
      "",
      "Mixed-case addresses carry a checksum, and this one does not match — which",
      "usually means a character was mistyped or transposed. Paste it again from",
      "the source, or write it in all lower case to skip the check.",
    );
  }

  const address = getAddress(value);

  const borrowed = Object.entries(TOLLPADS).find(([, other]) => getAddress(other) === address);
  if (borrowed) {
    fail(
      `${path} is Tollpad's ${borrowed[0]}: ${address}`,
      "",
      "Quadpad deploys with its own two addresses. Generate them on the computer",
      "you sit in front of — `node new-wallets.mjs`, which refuses to run on a",
      "hosted machine — and put them in quadpad.config.json.",
      "",
      "The treasury is an immutable in the hook from `npm run deploy` onwards, so",
      "this is the last moment it can be changed at all.",
    );
  }

  return address;
}

/** Records what a deploy or a launch produced, so the next step needs no copying. */
export function recordDeployed(config, values) {
  config.deployed = { ...config.deployed, ...values };
  saveConfig(config);
  console.log(`\nwritten to quadpad.config.json: ${Object.keys(values).join(", ")}`);
}
