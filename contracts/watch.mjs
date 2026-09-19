// Sits there and tells you when somebody trades. Signs nothing, needs no key.
//
//   npm run watch              # every launch on the board
//   ID=1 npm run watch         # just that one
//   INTERVAL=15 npm run watch  # seconds between reads (default 30)
//
// It reads the pool manager rather than an explorer or an aggregator, because
// on a chain this young those are the things that have not indexed a new v4
// pool yet. What the manager says about its own pools cannot be out of date.
//
// It polls, so two trades between two reads show up as one line with their net
// effect. That is the honest limit of this: it answers "has anything happened",
// precisely, and "how many times" only roughly. For the exact sequence, read
// the pool's transactions on the explorer.
import { formatEther } from "viem";

import { configAddress, loadConfig } from "./lib/config.mjs";
import { connect, fail } from "./lib/env.mjs";
import { readArtifact } from "./lib/artifacts.mjs";
import { poolId, quadpadPoolKey, readSlot0 } from "./lib/pool.mjs";
import { amountsInPosition, ethPerTokenFromSqrtPrice } from "./lib/ticks.mjs";

const factoryArtifact = readArtifact("QuadpadFactory");
const hookArtifact = readArtifact("QuadHook");

const NATIVE = "0x0000000000000000000000000000000000000000";
const UNIT = 10n ** 18n;

const config = loadConfig();
const factory = configAddress(config, "deployed.factory", "FACTORY", {
  what: "the Quadpad factory — run `npm run deploy` first",
});
const poolManager = configAddress(config, "poolManager", "POOL_MANAGER", {
  what: "the Uniswap v4 PoolManager the launchpad opens pools in",
});
const deployer = configAddress(config, "deployer", "DEPLOYER", {
  what: "the address whose own launches are not news",
});

const interval = Math.max(5, Number(process.env.INTERVAL ?? 30)) * 1000;
const only = process.env.ID === undefined ? null : BigInt(process.env.ID);

const { publicClient } = await connect();
if (publicClient.chain.id !== config.chainId) {
  fail(`quadpad.config.json says chain ${config.chainId}, not ${publicClient.chain.id}`);
}

const read = (functionName, args = []) =>
  publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName, args });

const hook = await read("hook");

const clock = () => new Date().toTimeString().slice(0, 8);
const tokens = (raw) => (raw / UNIT).toLocaleString("en-US");

/** Everything about one launch that a trade would change. */
async function snapshot(notice) {
  const key = quadpadPoolKey({ token: notice.token, hook, tickSpacing: notice.tickSpacing });
  const slot0 = await readSlot0(publicClient, poolManager, poolId(key));
  if (!slot0.initialized) return null;

  const held = amountsInPosition(notice.liquidity, slot0.sqrtPriceX96, notice.tickLower, notice.tickUpper);
  const [ethOwed, tokenOwed] = await Promise.all(
    [NATIVE, notice.token].map((currency) =>
      publicClient.readContract({
        address: hook,
        abi: hookArtifact.abi,
        functionName: "owed",
        args: [notice.creator, currency],
      }),
    ),
  );

  return { eth: held.eth, tokens: held.tokens, price: ethPerTokenFromSqrtPrice(slot0.sqrtPriceX96), ethOwed, tokenOwed };
}

const seen = new Map();
let known = 0n;

console.log(`factory    ${factory}`);
console.log(`watching   every ${interval / 1000}s — the pool manager, not an explorer`);
console.log(`stop with  ctrl-c\n`);

for (;;) {
  const count = await read("noticeCount");

  if (count > known) {
    // A launch by somebody else is the thing worth waking up for, so it is not
    // folded into the price lines below.
    for (let id = known; id < count; id++) {
      const notice = await read("noticeAt", [id]);
      // Somebody else posting to the board is the line worth not missing, so
      // the one case that is not news is marked as such.
      const mine = notice.creator.toLowerCase() === deployer.toLowerCase();
      console.log(
        `${clock()}  NEW LAUNCH  #${id} ${notice.name} ($${notice.symbol}) by ${notice.creator}${mine ? " — yours" : " — SOMEBODY ELSE"}`,
      );
    }
    known = count;
  }

  for (let id = 0n; id < count; id++) {
    if (only !== null && id !== only) continue;

    const notice = await read("noticeAt", [id]);
    const now = await snapshot(notice);
    if (now === null) continue;

    const before = seen.get(String(id));
    seen.set(String(id), now);

    if (before === undefined) {
      console.log(
        `${clock()}  #${id} ${notice.symbol.padEnd(6)} ${formatEther(now.eth)} ETH in pool, ` +
          `${tokens(now.tokens)} unsold — watching from here`,
      );
      continue;
    }

    if (now.eth === before.eth && now.tokens === before.tokens) continue;

    // ETH going in is somebody buying; ETH coming out is somebody selling. The
    // fee is charged on whatever was paid in, so the two sides show up in
    // different currencies, which is why both are printed.
    const bought = now.eth > before.eth;
    const ethMoved = bought ? now.eth - before.eth : before.eth - now.eth;
    const tokensMoved = bought ? before.tokens - now.tokens : now.tokens - before.tokens;

    const earned = bought
      ? `+${formatEther(now.ethOwed - before.ethOwed)} ETH`
      : `+${formatEther(now.tokenOwed - before.tokenOwed)} $${notice.symbol}`;

    console.log(
      `${clock()}  ${bought ? "BUY " : "SELL"}  #${id} ${notice.symbol.padEnd(6)} ` +
        `${formatEther(ethMoved)} ETH / ${tokens(tokensMoved)} ${notice.symbol}   ` +
        `pool now ${formatEther(now.eth)} ETH   to the creator ${earned}`,
    );
  }

  await new Promise((resolve) => setTimeout(resolve, interval));
}
