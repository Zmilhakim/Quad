// Puts QuadRouter on Robinhood Chain: the contract that lets a person trade a
// Quadpad pool at all.
//
// A v4 pool cannot be traded with directly. The pool manager only opens for a
// contract that answers `unlockCallback`, and it settles in deltas rather than
// transfers — so until something like this is deployed, every token on the
// board is unbuyable and the fee the launchpad is built around is never charged
// once.
//
// It is deployed separately from the factory on purpose. The factory, hook and
// locker are the launchpad and are immutable; the router is a convenience in
// front of them, holds nothing, and could be replaced tomorrow by a better one
// without touching a single pool.
//
//   DEPLOYER_KEY=0x…    the key for the address quadpad.config.json names
//   RPC_URL=https://…   defaults to Robinhood's own public endpoint
import { createWalletClient, formatEther, formatGwei, http } from "viem";

import { configAddress, loadConfig, recordDeployed } from "./lib/config.mjs";
import { checkPoolManager, connect, fail, requireDeployerKey, requireEnv } from "./lib/env.mjs";
import { readArtifact } from "./lib/artifacts.mjs";

const routerArtifact = readArtifact("QuadRouter");

requireEnv(["DEPLOYER_KEY"]);

const config = loadConfig();
const poolManager = configAddress(config, "poolManager", "POOL_MANAGER", {
  what: "the Uniswap v4 PoolManager the launchpad opens pools in",
});

const account = requireDeployerKey();
const { chain, publicClient } = await connect();
if (chain.id !== config.chainId) fail(`quadpad.config.json says chain ${config.chainId}, not ${chain.id}`);

await checkPoolManager(publicClient, poolManager);

const balance = await publicClient.getBalance({ address: account.address });

console.log(`deployer   ${account.address}`);
console.log(`balance    ${formatEther(balance)} ETH`);
console.log(`manager    ${poolManager}`);

if (config.deployed?.router) {
  console.log(`\nexisting   ${config.deployed.router} is already recorded as the router.`);
  console.log(`           Deploying again replaces it in the config. The old one keeps`);
  console.log(`           working — it has no state and nothing points at it.`);
}

const bytecode = `0x${routerArtifact.evm.bytecode.object}`;

try {
  const [gas, gasPrice] = await Promise.all([
    publicClient.estimateGas({ account, data: bytecode }),
    publicClient.getGasPrice(),
  ]);
  const cost = gas * gasPrice;

  console.log(`\ngas        ${gas.toLocaleString("en-US")} at ${formatGwei(gasPrice)} gwei`);
  console.log(`cost       about ${formatEther(cost)} ETH, of ${formatEther(balance)} ETH held`);

  if (balance < cost) {
    fail(
      `this address holds ${formatEther(balance)} ETH and the deploy needs about ${formatEther(cost)}.`,
      "",
      "Nothing was sent.",
    );
  }
} catch (error) {
  console.log(`\ngas        could not be estimated: ${error.shortMessage ?? error.message?.split("\n")[0] ?? error}`);
}

if (process.env.CONFIRM !== "deploy-router") {
  console.log(`\nNothing was sent. To send it:\n`);
  console.log(`    CONFIRM=deploy-router npm run deploy-router`);
  process.exit(0);
}

const wallet = createWalletClient({ account, chain, transport: http() });
const hash = await wallet.deployContract({ abi: routerArtifact.abi, bytecode, args: [poolManager] });

console.log(`\ntx         ${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") fail("the deployment reverted");

const router = receipt.contractAddress;

// Read back rather than trust: a router pointed at the wrong pool manager would
// fail on the first swap, which is a worse place to find out.
const wired = await publicClient.readContract({
  address: router,
  abi: routerArtifact.abi,
  functionName: "poolManager",
});
if (wired.toLowerCase() !== poolManager.toLowerCase()) {
  fail(`the router says its pool manager is ${wired}, not ${poolManager} — do not trade through it`);
}

console.log(`router     ${router} (pool manager confirmed on chain)`);

recordDeployed(config, { router });

console.log(`\nThe board is tradeable now:\n`);
console.log(`    ID=0 BUY=0.0001 npm run swap                  # prints the plan, sends nothing`);
console.log(`    ID=0 BUY=0.0001 CONFIRM=swap npm run swap     # sends it`);
