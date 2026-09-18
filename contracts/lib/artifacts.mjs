// The compiled contracts, or the one instruction that fixes their absence.
// out/ is built rather than committed, so a fresh checkout has nothing for the
// deploy scripts to read.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fail } from "./env.mjs";

const here = dirname(dirname(fileURLToPath(import.meta.url)));

export function readArtifact(name) {
  try {
    return JSON.parse(readFileSync(join(here, "out", `${name}.json`), "utf8"));
  } catch {
    fail(
      `out/${name}.json is not there, so there is nothing to deploy.`,
      "",
      "Run `npm run compile` first. out/ is built rather than committed, and a",
      "checkout that predates a contract will not have it.",
    );
  }
}
