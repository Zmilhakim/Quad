// Posts one token to the board: mints the supply, opens its pool, and locks the
// whole supply into it. One transaction, no posting fee, nothing held back.
//
//   NAME="Some Token" SYMBOL=SOME npm run launch                 # prints the plan
//   NAME="Some Token" SYMBOL=SOME CONFIRM=launch npm run launch  # sends it
//
// IMAGE, BLURB and LINK are optional and go on the notice. There is no price
// argument and no range argument: every Quadpad pool opens at the same price,
// and that is a property of the factory rather than a default this script
// fills in. See `OPENING_TICK` in QuadpadFactory.sol.
//
// Do not chain these with `&&`. A dry run is a success, so the first command
// exits 0 without sending anything and the next one in the chain would run
// against a launch that never happened.
import { createWalletClient, formatEther, formatGwei, http, parseEventLogs } from "viem";

import { configAddress, loadConfig } from "./lib/config.mjs";
import { connect, fail, requireDeployerKey, requireEnv } from "./lib/env.mjs";
import { readArtifact } from "./lib/artifacts.mjs";
import { quadpadPoolKey } from "./lib/pool.mjs";
import { amountsInPosition, ethPerTokenFromSqrtPrice, getSqrtPriceAtTick } from "./lib/ticks.mjs";

const factoryArtifact = readArtifact("QuadpadFactory");

requireEnv(["DEPLOYER_KEY", "NAME", "SYMBOL"]);

const config = loadConfig();
const factory = configAddress(config, "deployed.factory", "FACTORY", {
  what: "the Quadpad factory — run `npm run deploy` first",
});

const account = requireDeployerKey();
const { chain, publicClient } = await connect();
if (chain.id !== config.chainId) fail(`quadpad.config.json says chain ${config.chainId}, not ${chain.id}`);

// The terms are read off the factory rather than repeated here. A script that
// prints its own copy of the rate is a script that can print last week's.
const read = (functionName, args = []) =>
  publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName, args });

const [supply, openingTick, lowerTick, tickSpacing, openingSqrtPriceX96, feeBps, creatorBps] =
  await read("launchTerms");
const openingCap = await read("openingMarketCap");

// The opening price the factory will use, recomputed here from the tick it
// reported, and checked against the one it reported. They are the same number
// by two routes: if they disagree, this script's tick math and the chain's have
// drifted, and the launch is not the thing to find that out during.
if (getSqrtPriceAtTick(openingTick) !== openingSqrtPriceX96) {
  fail(
    `the factory opens at sqrtPriceX96 ${openingSqrtPriceX96}, but tick ${openingTick} is ${getSqrtPriceAtTick(openingTick)}`,
  );
}

const params = {
  name: process.env.NAME,
  symbol: process.env.SYMBOL,
  imageURI: process.env.IMAGE ?? "",
  blurb: process.env.BLURB ?? "",
  link: process.env.LINK ?? "",
};

console.log(`factory    ${factory}`);
console.log(`creator    ${account.address}`);
console.log(`balance    ${formatEther(await publicClient.getBalance({ address: account.address }))} ETH`);
console.log(`\ntoken      ${params.name} ($${params.symbol})`);
console.log(`supply     ${(supply / 10n ** 18n).toLocaleString("en-US")} — all of it into the pool, none to anyone`);
console.log(`opens at   ${formatEther(openingCap)} ETH for the whole supply — the same as every other launch`);
console.log(`ticks      ${lowerTick} … ${openingTick}, spacing ${tickSpacing}`);
console.log(`fee        ${Number(feeBps) / 100}% of every swap, ${Number(creatorBps) / 100}% of it to ${account.address}`);

// Simulated against the node before anything is broadcast: a launch that would
// revert is better learned about here than from a receipt.
const { request, result } = await publicClient
  .simulateContract({ address: factory, abi: factoryArtifact.abi, functionName: "launch", args: [params], account })
  .catch((error) => {
    fail(
      "the launch would revert:",
      `  ${error.shortMessage ?? error.message?.split("\n")[0] ?? error}`,
      "",
      "An empty name or symbol is the one that comes up. A pool that already",
      "exists would be a token address collision, which is not a thing to",
      "carry on through.",
    );
  });

const [, token] = result;
console.log(`\nwould deploy the token at ${token}`);

/**
 * What it will cost, before it is sent.
 *
 * A launch is one transaction that deploys a token, opens a pool and mints a
 * position into it, so "is there enough for gas" is not a question worth
 * guessing at from the size of the last one. The node knows; ask it.
 *
 * Estimating can fail for reasons that are not the launch's fault — a node that
 * declines the call, or one that refuses to estimate for an account that cannot
 * cover it. Neither is worth stopping a dry run over, so this reports what it
 * could not work out rather than exiting.
 */
const balance = await publicClient.getBalance({ address: account.address });

try {
  const [gas, gasPrice] = await Promise.all([
    publicClient.estimateContractGas({
      address: factory,
      abi: factoryArtifact.abi,
      functionName: "launch",
      args: [params],
      account,
    }),
    publicClient.getGasPrice(),
  ]);

  // The wallet pays for the gas the transaction actually uses, but it has to
  // hold the whole limit up front, and viem sends the estimate as the limit.
  const cost = gas * gasPrice;
  console.log(`\ngas        ${gas.toLocaleString("en-US")} at ${formatGwei(gasPrice)} gwei`);
  console.log(`cost       about ${formatEther(cost)} ETH, of ${formatEther(balance)} ETH held`);

  if (balance < cost) {
    fail(
      `this address holds ${formatEther(balance)} ETH and the launch needs about ${formatEther(cost)}.`,
      "",
      "Nothing was sent. Fund it and run this again — a transaction that runs out",
      "of gas is mined, and the gas is spent, and there is no token at the end.",
    );
  }

  if (balance < cost * 2n) {
    console.log(`           that is under twice the estimate — top it up if the price moves`);
  }
} catch (error) {
  console.log(`\ngas        could not be estimated: ${error.shortMessage ?? error.message?.split("\n")[0] ?? error}`);
  console.log(`balance    ${formatEther(balance)} ETH`);
  console.log(`           the simulation above still passed, so this is about the node, not the launch`);
}

if (process.env.CONFIRM !== "launch") {
  console.log(`\nNothing was sent. To send it:\n`);
  console.log(`    NAME="${params.name}" SYMBOL="${params.symbol}" CONFIRM=launch npm run launch`);
  process.exit(0);
}

const wallet = createWalletClient({ account, chain, transport: http() });
const hash = await wallet.writeContract(request);
console.log(`\ntx         ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") fail("the launch reverted");

const [launched] = parseEventLogs({ abi: factoryArtifact.abi, eventName: "Launched", logs: receipt.logs });
const notice = await read("noticeAt", [launched.args.id]);

const key = quadpadPoolKey({
  token: notice.token,
  hook: await read("hook"),
  tickSpacing: notice.tickSpacing,
});
const inPosition = amountsInPosition(notice.liquidity, openingSqrtPriceX96, notice.tickLower, notice.tickUpper);

console.log(`\nnotice     #${launched.args.id}`);
console.log(`token      ${notice.token}`);
console.log(`pool       ${key.currency0} / ${key.currency1}, fee ${key.fee}, hook ${key.hooks}`);
console.log(`locked     ${inPosition.tokens / 10n ** 18n} tokens, ${formatEther(inPosition.eth)} ETH`);
console.log(`price      ${formatEther(ethPerTokenFromSqrtPrice(openingSqrtPriceX96))} ETH per token, to start`);
console.log(`\nThe liquidity is in the locker and is not coming back out. What you own is`);
console.log(`${Number(creatorBps) / 100}% of the fee, which you take with \`npm run collect\`.`);
