// Which address does the key I stored control? Prints the address and never the
// key, sends nothing, and needs no network unless a factory is configured.
//
//   DEPLOYER_KEY=0x… npm run whoami
//
// Run this after `new-wallets.mjs` and before anything that spends gas. A key
// stored wrong is a key that fails at the worst moment; this is the cheapest
// moment to find out.
import { formatEther } from "viem";

import { configAddress, loadConfig } from "./lib/config.mjs";
import { connect, fail, requireDeployerKey } from "./lib/env.mjs";
import { hasFlags } from "./lib/hooks.mjs";
import { readArtifact } from "./lib/artifacts.mjs";

const account = requireDeployerKey();
console.log(`address    ${account.address}`);

const config = loadConfig();

// Nothing below needs a key, so a bad RPC is a missing answer rather than a
// failure: the address above is the thing this script is for.
let publicClient;
try {
  ({ publicClient } = await connect());
} catch {
  console.log("rpc        unreachable — the address above is still the answer");
  process.exit(0);
}

console.log(`balance    ${formatEther(await publicClient.getBalance({ address: account.address }))} ETH`);
console.log(`nonce      ${await publicClient.getTransactionCount({ address: account.address })}`);

const intended = (config.deployer ?? "").trim();
if (intended !== "") {
  const matches = intended.toLowerCase() === account.address.toLowerCase();
  console.log(`config     ${matches ? "matches" : `expects ${intended} — this is NOT that key`} `);
}

const factory = (config.deployed?.factory ?? "").trim();
if (factory === "") {
  console.log("factory    nothing deployed yet");
  process.exit(0);
}

const factoryArtifact = readArtifact("QuadpadFactory");
const hookArtifact = readArtifact("QuadHook");

const hook = await publicClient.readContract({
  address: configAddress(config, "deployed.factory", "FACTORY", { what: "the deployed factory" }),
  abi: factoryArtifact.abi,
  functionName: "hook",
});

const [treasury, owedEth] = await Promise.all([
  publicClient.readContract({ address: hook, abi: hookArtifact.abi, functionName: "treasury" }),
  publicClient.readContract({
    address: hook,
    abi: hookArtifact.abi,
    functionName: "owed",
    args: [account.address, "0x0000000000000000000000000000000000000000"],
  }),
]);

console.log(`factory    ${factory}`);
console.log(`hook       ${hook} ${hasFlags(hook) ? "(flags ok)" : "(WRONG FLAGS — the fee is never charged)"}`);
console.log(`treasury   ${treasury}${treasury.toLowerCase() === account.address.toLowerCase() ? " — this key" : ""}`);
console.log(`owed       ${formatEther(owedEth)} ETH to this address`);

if (!hasFlags(hook)) fail("", "That hook address does not carry its permission flags. Do not launch into this one.");
