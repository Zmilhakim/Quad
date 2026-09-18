// Shared entry checks for the scripts that spend gas. Deploying the factory and
// launching a token both do something that cannot be taken back, so everything
// they can verify before broadcasting is verified here first.
import { createPublicClient, defineChain, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { extsloadAbi } from "./pool.mjs";

export const DEFAULT_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const ROBINHOOD_CHAIN_ID = 4663;

export function fail(...lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

export function requireEnv(keys) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) fail(`missing: ${missing.join(", ")}`);
}

export function requireAddress(key) {
  const value = process.env[key];
  if (!isAddress(value)) fail(`${key} is not an address: ${value}`);
  return value;
}

/**
 * Validates the key's shape before handing it to the crypto library, which
 * otherwise fails with a stack trace that says nothing useful. Nothing here
 * ever prints the key itself — only its length and shape.
 */
export function requireDeployerKey() {
  const rawKey = (process.env.DEPLOYER_KEY ?? "").trim();

  if (rawKey === "") fail("DEPLOYER_KEY is not set.");

  if (rawKey.includes(" ")) {
    fail(
      "DEPLOYER_KEY contains spaces — that looks like a seed phrase, not a private key.",
      "",
      "A seed phrase is 12 or 24 words. A private key is a single 66-character",
      "string starting with 0x. In MetaMask they are different exports:",
      "  seed phrase -> Settings > Security & Privacy > Reveal Secret Recovery Phrase",
      "  private key -> the three dots next to the account > Account details > Show private key",
    );
  }

  if (rawKey === "0x…" || rawKey === "0x...") {
    fail("DEPLOYER_KEY is still the placeholder from the instructions.", "Replace it with the actual key.");
  }

  if (!rawKey.startsWith("0x")) {
    fail(
      `DEPLOYER_KEY is missing its 0x prefix (it is ${rawKey.length} characters).`,
      "Export it as 0x followed by the 64 hex characters.",
    );
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(rawKey)) {
    fail(
      `DEPLOYER_KEY is ${rawKey.length} characters; a private key is exactly 66 (0x + 64 hex).`,
      rawKey.length !== 66
        ? "A truncated paste is the usual cause — check nothing was cut off at either end."
        : "It is the right length but contains a character that is not 0-9 or a-f.",
    );
  }

  return privateKeyToAccount(rawKey);
}

export function robinhoodChain(rpcUrl) {
  return defineChain({
    id: ROBINHOOD_CHAIN_ID,
    name: "Robinhood Chain",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
}

/** Connects, and refuses to go on if the endpoint is not the chain we meant. */
export async function connect() {
  const rpcUrl = process.env.RPC_URL || DEFAULT_RPC_URL;
  const chain = robinhoodChain(rpcUrl);
  const publicClient = createPublicClient({ chain, transport: http() });

  let liveChainId;
  try {
    liveChainId = await publicClient.getChainId();
  } catch (error) {
    fail(
      `cannot reach the RPC at ${rpcUrl}`,
      `  ${error.shortMessage ?? error.message?.split("\n")[0] ?? error}`,
      "",
      "Public endpoints go down, rate-limit and get replaced. Point this at",
      "another one and re-run:",
      "",
      "    export RPC_URL=https://…",
    );
  }

  if (liveChainId !== chain.id) {
    fail(
      `${rpcUrl} is chain ${liveChainId}, not Robinhood Chain (${chain.id})`,
      "Deploying against the wrong chain would put the launchpad somewhere nobody is looking.",
    );
  }

  console.log(`rpc        ${rpcUrl} (chain ${liveChainId})`);
  return { chain, publicClient, rpcUrl };
}

const ownerAbi = [{ type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" }];

/**
 * Checks the venue is what it claims to be before anything is spent on it.
 *
 * There is no pool factory to cross-examine in v4 — one manager holds every pool
 * — so what can be checked is that the address answers the two surfaces this
 * launchpad depends on: `extsload`, which is how the pool's price is read, and `owner`,
 * which every deployed PoolManager has. An address that answers both is a
 * PoolManager; an address that answers neither is a typo.
 */
export async function checkPoolManager(publicClient, poolManager) {
  const code = await publicClient.getCode({ address: poolManager });
  if (!code || code === "0x") fail(`POOL_MANAGER (${poolManager}) has no code on this chain — check the address`);

  let owner;
  try {
    [, owner] = await Promise.all([
      publicClient.readContract({
        address: poolManager,
        abi: extsloadAbi,
        functionName: "extsload",
        args: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
      }),
      publicClient.readContract({ address: poolManager, abi: ownerAbi, functionName: "owner" }),
    ]);
  } catch {
    fail(`POOL_MANAGER (${poolManager}) does not answer extsload()/owner() — it is not a Uniswap v4 pool manager`);
  }

  console.log(`venue      pool manager ${poolManager}, owner ${owner}`);
  return { owner };
}
