// Finds the CREATE2 salt that puts the fee hook on an address the pool manager
// will actually call. Sends nothing, needs no key.
//
// A v4 pool reads a hook's permissions out of the low 14 bits of its address, so
// the hook cannot be deployed wherever it happens to land. The factory deploys
// it with CREATE2 in its own constructor, which means the salt has to be mined
// against an address the factory does not have yet — its own. That address is a
// hash of the deployer and its next nonce, so it can be worked out in advance,
// and this is where that is done.
//
// `deploy.mjs` runs this same code. Running it separately is for seeing the
// answer before spending anything on it.
import { formatEther } from "viem";

import { configAddress, loadConfig } from "./lib/config.mjs";
import { connect, fail } from "./lib/env.mjs";
import { flagsOf, hookInitCode, mineHookSalt, predictFactory } from "./lib/hooks.mjs";
import { readArtifact } from "./lib/artifacts.mjs";

const hookArtifact = readArtifact("QuadHook");

const config = loadConfig();
const poolManager = configAddress(config, "poolManager", "POOL_MANAGER", {
  what: "the Uniswap v4 PoolManager the launchpad opens pools in",
});
const treasury = configAddress(config, "treasury", "TREASURY", {
  what: "where the treasury's share of every fee goes, forever",
});
const deployer = configAddress(config, "deployer", "DEPLOYER", {
  what: "the address that will deploy the factory",
});

const { publicClient } = await connect();
if (publicClient.chain.id !== config.chainId) {
  fail(`quadpad.config.json says chain ${config.chainId}, not ${publicClient.chain.id}`);
}

// The nonce is read rather than assumed: it is the one input to this that
// changes on its own, every time the deployer sends anything at all.
const nonce = Number(process.env.NONCE ?? (await publicClient.getTransactionCount({ address: deployer })));
const factory = predictFactory({ deployer, nonce });

const initCode = hookInitCode({
  creationCode: hookArtifact.evm.bytecode.object,
  poolManager,
  treasury,
});
const mined = mineHookSalt({ deployer: factory, initCode });

console.log(`deployer   ${deployer}`);
console.log(`balance    ${formatEther(await publicClient.getBalance({ address: deployer }))} ETH`);
console.log(`nonce      ${nonce}${process.env.NONCE ? " (from NONCE)" : " (read from the chain)"}`);
console.log(`\nfactory    ${factory}   ← only if the next transaction from that address is the deploy`);
console.log(`hook       ${mined.address}`);
console.log(`salt       ${mined.salt}   (found in ${mined.tries} tries)`);
console.log(`flags      ${flagsOf(mined.address).join(", ")}`);
console.log(`\nThe hook's constructor checks this itself. A salt mined against the wrong`);
console.log(`nonce lands it on an unflagged address and reverts the whole deployment,`);
console.log(`so the way this goes wrong is a failed transaction, not a silent one.`);
