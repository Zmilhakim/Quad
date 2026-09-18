import { defineChain } from "viem";

/**
 * Annotated with its own value on purpose. Without the literal type, wagmi's
 * `chainId` narrows to `number` the moment this is spread into an object
 * literal, and every batched read stops type-checking against the configured
 * chain.
 */
export const ROBINHOOD_CHAIN_ID = 4663 as const;

/**
 * Robinhood Chain — an Arbitrum Orbit L2 settling to Ethereum. Gas is paid in ETH.
 *
 * The RPC default is Robinhood's own public endpoint, which is rate-limited and
 * meant for wallets and light use. Point NEXT_PUBLIC_RPC_URL at a dedicated
 * provider before this sees real traffic; NEXT_PUBLIC_EXPLORER_URL overrides the
 * explorer the "↗" links open.
 */
export const DEFAULT_RPC_URL = "https://rpc.mainnet.chain.robinhood.com";
export const DEFAULT_EXPLORER_URL = "https://robinhoodchain.blockscout.com";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC_URL;
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL || DEFAULT_EXPLORER_URL;

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: "Blockscout", url: explorerUrl } },
});

export const explorerAddress = (address: string) => `${explorerUrl}/address/${address}`;
export const explorerTx = (hash: string) => `${explorerUrl}/tx/${hash}`;
