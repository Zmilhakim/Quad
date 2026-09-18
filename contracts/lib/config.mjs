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

/** Records what a deploy or a launch produced, so the next step needs no copying. */
export function recordDeployed(config, values) {
  config.deployed = { ...config.deployed, ...values };
  saveConfig(config);
  console.log(`\nwritten to quadpad.config.json: ${Object.keys(values).join(", ")}`);
}
