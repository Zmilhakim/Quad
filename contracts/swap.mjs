// Buys or sells a Quadpad token through QuadRouter, and shows the fee it pays
// before it pays it.
//
//   ID=0 BUY=0.001 npm run swap        # spend 0.001 ETH on notice #0
//   ID=0 SELL=1000000 npm run swap     # sell a million of them back
//   ID=0 SELL=all npm run swap         # sell whatever this address holds
//
// Nothing is sent without CONFIRM=swap. The line to send it is printed at the
// end, carrying the limit that was quoted, so the transaction that goes out is
// the one that was read.
//
//   SLIPPAGE_BPS=100    how far the price may move before it reverts (1%)
//   DEADLINE_MINUTES=10 how long it may sit unmined
import { createWalletClient, formatEther, formatGwei, formatUnits, http, parseEther, parseUnits } from "viem";

import { configAddress, loadConfig } from "./lib/config.mjs";
import { connect, fail, requireDeployerKey, requireEnv } from "./lib/env.mjs";
import { readArtifact } from "./lib/artifacts.mjs";
import { shellQuote } from "./lib/command.mjs";

const factoryArtifact = readArtifact("QuadpadFactory");
const routerArtifact = readArtifact("QuadRouter");
const tokenArtifact = readArtifact("QuadToken");

requireEnv(["DEPLOYER_KEY"]);

const BPS = 10_000n;
const FEE_BPS = 400n;

const config = loadConfig();
const factory = configAddress(config, "deployed.factory", "FACTORY", {
  what: "the Quadpad factory — run `npm run deploy` first",
});
const router = configAddress(config, "deployed.router", "ROUTER", {
  what: "the QuadRouter that trades against the pools — run `npm run deploy-router` first",
});

const buying = process.env.BUY !== undefined;
const selling = process.env.SELL !== undefined;
if (buying === selling) {
  fail("set exactly one of BUY or SELL.", "", "    ID=0 BUY=0.001 npm run swap", "    ID=0 SELL=all npm run swap");
}

if (process.env.ID === undefined) fail("set ID to the notice number on the board.", "", "    ID=0 BUY=0.001 npm run swap");
const id = BigInt(process.env.ID);

const slippageBps = BigInt(process.env.SLIPPAGE_BPS ?? 100);
if (slippageBps < 0n || slippageBps >= BPS) fail(`SLIPPAGE_BPS is ${slippageBps}, which is not a share of 10,000`);

const account = requireDeployerKey();
const { chain, publicClient } = await connect();
if (chain.id !== config.chainId) fail(`quadpad.config.json says chain ${config.chainId}, not ${chain.id}`);

const read = (functionName, args = []) =>
  publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName, args });

const count = await read("noticeCount");
if (id >= count) fail(`the board has ${count} launches on it, so there is no #${id}`);

const [notice, key] = await Promise.all([read("noticeAt", [id]), read("poolKeyOf", [id])]);
const token = notice.token;

const deadline =
  BigInt(Math.floor(Date.now() / 1000)) + BigInt(Number(process.env.DEADLINE_MINUTES ?? 10)) * 60n;

const balance = await publicClient.getBalance({ address: account.address });
const held = await publicClient.readContract({
  address: token,
  abi: tokenArtifact.abi,
  functionName: "balanceOf",
  args: [account.address],
});

console.log(`router     ${router}`);
console.log(`trader     ${account.address}`);
console.log(`balance    ${formatEther(balance)} ETH, ${formatUnits(held, 18)} ${notice.symbol}`);
console.log(`\n#${id}  ${notice.name} ($${notice.symbol})`);
console.log(`token      ${token}`);

/** What the swap would do, asked of the node with no limit on it. */
async function quote(functionName, args, value) {
  try {
    const { result } = await publicClient.simulateContract({
      address: router,
      abi: routerArtifact.abi,
      functionName,
      args,
      account,
      value,
    });
    return result;
  } catch (error) {
    fail(
      "the swap would revert:",
      `  ${error.shortMessage ?? error.message?.split("\n")[0] ?? error}`,
      "",
      "Nothing was sent.",
    );
  }
}

let plan;

if (buying) {
  const spend = parseEther(process.env.BUY);
  if (spend <= 0n) fail(`BUY is ${process.env.BUY}, which is nothing`);
  if (spend > balance) fail(`BUY is ${formatEther(spend)} ETH and this address holds ${formatEther(balance)}`);

  const expected = await quote("buy", [key, 0n, deadline], spend);
  const minOut = (expected * (BPS - slippageBps)) / BPS;
  const fee = (spend * FEE_BPS) / BPS;

  console.log(`\npaying     ${formatEther(spend)} ETH`);
  console.log(`fee        ${formatEther(fee)} ETH — 4% of it, ${formatEther((fee * 8000n) / BPS)} of that to the creator`);
  console.log(`receiving  about ${formatUnits(expected, 18)} ${notice.symbol}`);
  console.log(`at least   ${formatUnits(minOut, 18)} ${notice.symbol}, or it reverts (${slippageBps} bps)`);

  plan = {
    functionName: "buy",
    args: [key, minOut, deadline],
    value: spend,
    line: `ID=${id} BUY=${shellQuote(process.env.BUY)} CONFIRM=swap npm run swap`,
  };
} else {
  const amount = process.env.SELL === "all" ? held : parseUnits(process.env.SELL, 18);
  if (amount <= 0n) fail(`SELL is ${process.env.SELL}, which is nothing`);
  if (amount > held) {
    fail(`SELL is ${formatUnits(amount, 18)} ${notice.symbol} and this address holds ${formatUnits(held, 18)}`);
  }

  // The router moves the token out of the seller's own balance, so it needs an
  // allowance first. This is a second transaction, and it is sent before the
  // swap rather than bundled with it.
  const allowance = await publicClient.readContract({
    address: token,
    abi: tokenArtifact.abi,
    functionName: "allowance",
    args: [account.address, router],
  });

  console.log(`\nselling    ${formatUnits(amount, 18)} ${notice.symbol}`);
  console.log(`allowance  ${formatUnits(allowance, 18)} ${notice.symbol} to the router`);

  if (allowance < amount) {
    if (process.env.CONFIRM !== "swap") {
      console.log(`           not enough — an approve() goes out first, then the sell`);
    } else {
      const wallet = createWalletClient({ account, chain, transport: http() });
      const approveHash = await wallet.writeContract({
        address: token,
        abi: tokenArtifact.abi,
        functionName: "approve",
        args: [router, amount],
      });
      console.log(`approve    ${approveHash}`);
      const approved = await publicClient.waitForTransactionReceipt({ hash: approveHash });
      if (approved.status !== "success") fail("the approve reverted");
    }
  }

  const quotable = allowance >= amount || process.env.CONFIRM === "swap";
  const expected = quotable ? await quote("sell", [key, amount, 0n, deadline]) : null;
  const minOut = expected === null ? 0n : (expected * (BPS - slippageBps)) / BPS;
  const fee = (amount * FEE_BPS) / BPS;

  console.log(`fee        ${formatUnits(fee, 18)} ${notice.symbol} — 4% of it, in the token this time`);
  if (expected === null) {
    console.log(`receiving  cannot be quoted until the approve is in — re-run after it, or with CONFIRM=swap`);
  } else {
    console.log(`receiving  about ${formatEther(expected)} ETH`);
    console.log(`at least   ${formatEther(minOut)} ETH, or it reverts (${slippageBps} bps)`);
  }

  plan = {
    functionName: "sell",
    args: [key, amount, minOut, deadline],
    value: 0n,
    line: `ID=${id} SELL=${shellQuote(process.env.SELL)} CONFIRM=swap npm run swap`,
  };
}

try {
  const [gas, gasPrice] = await Promise.all([
    publicClient.estimateContractGas({
      address: router,
      abi: routerArtifact.abi,
      functionName: plan.functionName,
      args: plan.args,
      account,
      value: plan.value,
    }),
    publicClient.getGasPrice(),
  ]);
  console.log(`\ngas        ${gas.toLocaleString("en-US")} at ${formatGwei(gasPrice)} gwei`);
  console.log(`cost       about ${formatEther(gas * gasPrice)} ETH on top`);
} catch (error) {
  console.log(`\ngas        could not be estimated: ${error.shortMessage ?? error.message?.split("\n")[0] ?? error}`);
}

if (process.env.CONFIRM !== "swap") {
  console.log(`\nNothing was sent. To send it:\n`);
  console.log(`    ${plan.line}`);
  console.log(`\nThe limit is quoted again when you do, against the price at that moment.`);
  process.exit(0);
}

const wallet = createWalletClient({ account, chain, transport: http() });
const hash = await wallet.writeContract({
  address: router,
  abi: routerArtifact.abi,
  functionName: plan.functionName,
  args: plan.args,
  value: plan.value,
});

console.log(`\ntx         ${hash}`);
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") fail("the swap reverted");

const [ethAfter, tokensAfter] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.readContract({ address: token, abi: tokenArtifact.abi, functionName: "balanceOf", args: [account.address] }),
]);

console.log(`\nbalance    ${formatEther(ethAfter)} ETH, ${formatUnits(tokensAfter, 18)} ${notice.symbol}`);
console.log(`\nThe fee is banked as a claim on the hook, not sent. Run \`npm run status\` to`);
console.log(`see what it owes, and \`npm run collect\` to take your share of it.`);
