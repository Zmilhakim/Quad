// Takes the fee you are owed. Pays the caller and nobody else — the hook has no
// recipient argument, so the address that signs is the address that is paid.
//
//   npm run collect                       # prints what is owed, sends nothing
//   CONFIRM=collect npm run collect       # sends it
//
// By default it collects ETH plus the token of every notice on the board that
// owes you something. TOKENS=0x…,0x… narrows it to a list.
import { createWalletClient, formatEther, http } from "viem";

import { configAddress, loadConfig } from "./lib/config.mjs";
import { connect, fail, requireDeployerKey, requireEnv } from "./lib/env.mjs";
import { readArtifact } from "./lib/artifacts.mjs";

const factoryArtifact = readArtifact("QuadpadFactory");
const hookArtifact = readArtifact("QuadHook");

const NATIVE = "0x0000000000000000000000000000000000000000";

requireEnv(["DEPLOYER_KEY"]);

const config = loadConfig();
const factory = configAddress(config, "deployed.factory", "FACTORY", {
  what: "the Quadpad factory — run `npm run deploy` first",
});

const account = requireDeployerKey();
const { chain, publicClient } = await connect();
if (chain.id !== config.chainId) fail(`quadpad.config.json says chain ${config.chainId}, not ${chain.id}`);

const hook = await publicClient.readContract({ address: factory, abi: factoryArtifact.abi, functionName: "hook" });

const candidates = process.env.TOKENS
  ? [NATIVE, ...process.env.TOKENS.split(",").map((t) => t.trim())]
  : [
      NATIVE,
      ...(await publicClient.readContract({
        address: factory,
        abi: factoryArtifact.abi,
        functionName: "latest",
        args: [0n, 50n],
      })).map((notice) => notice.token),
    ];

const owed = await Promise.all(
  candidates.map(async (currency) => ({
    currency,
    amount: await publicClient.readContract({
      address: hook,
      abi: hookArtifact.abi,
      functionName: "owed",
      args: [account.address, currency],
    }),
  })),
);

const due = owed.filter((entry) => entry.amount > 0n);

console.log(`hook       ${hook}`);
console.log(`account    ${account.address}`);

if (due.length === 0) {
  console.log(`\nNothing is owed to this address yet. A fee is only charged when somebody`);
  console.log(`trades, so an untraded launch has earned nothing rather than lost it.`);
  process.exit(0);
}

for (const entry of due) {
  console.log(`owed       ${formatEther(entry.amount)} ${entry.currency === NATIVE ? "ETH" : entry.currency}`);
}

const { request } = await publicClient
  .simulateContract({
    address: hook,
    abi: hookArtifact.abi,
    functionName: "withdrawMany",
    args: [due.map((entry) => entry.currency)],
    account,
  })
  .catch((error) => fail("the withdrawal would revert:", `  ${error.shortMessage ?? error.message}`));

if (process.env.CONFIRM !== "collect") {
  console.log(`\nNothing was sent. To send it:\n`);
  console.log(`    CONFIRM=collect npm run collect`);
  process.exit(0);
}

const wallet = createWalletClient({ account, chain, transport: http() });
const hash = await wallet.writeContract(request);
console.log(`\ntx         ${hash}`);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== "success") fail("the withdrawal reverted");

console.log(`collected  ${due.length} ${due.length === 1 ? "currency" : "currencies"}, in one transaction`);
console.log(`balance    ${formatEther(await publicClient.getBalance({ address: account.address }))} ETH`);
