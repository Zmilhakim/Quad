import type { Address } from "viem";
import { isAddress } from "viem";

import { quadpadFactoryAbi } from "./abi/quadpadFactory";
import { quadHookAbi } from "./abi/quadHook";
import { quadLockerAbi } from "./abi/quadLocker";
import { quadTokenAbi } from "./abi/quadToken";

export { quadpadFactoryAbi, quadHookAbi, quadLockerAbi, quadTokenAbi };

/**
 * The factory, once there is one.
 *
 * Nothing is deployed yet, so this is empty and the site says so on every page
 * rather than rendering a board of nothing that looks like a board with nothing
 * on it. `npm run deploy` in ../contracts prints the address; put it here, or in
 * NEXT_PUBLIC_FACTORY_ADDRESS, and the whole site turns on.
 *
 * It is written here rather than only in a dashboard variable because a
 * deployment that forgets a variable does not fail — it quietly builds a page
 * telling visitors the launchpad does not exist.
 */
const DEPLOYED_FACTORY = "";

const configured = process.env.NEXT_PUBLIC_FACTORY_ADDRESS?.trim() || DEPLOYED_FACTORY;

export const FACTORY_ADDRESS: Address | undefined = isAddress(configured, { strict: false })
  ? (configured as Address)
  : undefined;

/** Whether there is anything on chain to read. */
export const BOARD_IS_OPEN = FACTORY_ADDRESS !== undefined;

/** Uniswap v4 on Robinhood Chain, from Uniswap's deployment record for 4663. */
export const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951" as Address;

export const NATIVE = "0x0000000000000000000000000000000000000000" as Address;

/**
 * The numbers the contracts fix, repeated here for the copy to read.
 *
 * They are not settings and the site never reads them from a form: `FEE_BPS`
 * and `CREATOR_BPS` are constants in QuadHook; `FIXED_SUPPLY`, `LP_FEE`,
 * `OPENING_TICK`, `TICK_LOWER` and `TICK_SPACING` are constants in
 * QuadpadFactory. Where a page shows them next to live data it reads
 * `boardStats()` or `launchTerms()` instead, so a mismatch shows up rather than
 * hiding.
 */
export const FEE_BPS = 400;
export const CREATOR_BPS = 8_000;
export const LP_FEE = 0;
export const SUPPLY = 1_000_000_000n;

/**
 * The tick every pool opens at, the bottom of its range, and the grid both ends
 * sit on. Not a default and not a suggestion — `launch` takes no price
 * argument, so these are the only values any Quadpad pool has ever had.
 */
export const OPENING_TICK = 201_936;
export const TICK_LOWER = 155_904;
export const LAUNCH_TICK_SPACING = 336;

/**
 * What the whole supply is worth at `OPENING_TICK`, in wei.
 *
 * 1.700080239474970520 ETH. The site prints "1.7 ETH" nearly everywhere, which
 * is this to four figures; `formatEth` is given the exact value wherever the
 * precision is the point. Derived on chain by `openingMarketCap()`, and the
 * board reads it from there rather than trusting this copy.
 */
export const OPENING_MARKET_CAP_WEI = 1_700_080_239_474_970_520n;

/** The rounded figure the copy uses. */
export const OPENING_MARKET_CAP = "1.7";

export const TICKER = "QUAD";

export type Notice = {
  id: bigint;
  token: Address;
  creator: Address;
  name: string;
  symbol: string;
  imageURI: string;
  blurb: string;
  link: string;
  supply: bigint;
  launchedAt: bigint;
  tickSpacing: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
};
