"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";

import { ROBINHOOD_CHAIN_ID } from "./chain";
import { BOARD_IS_OPEN, FACTORY_ADDRESS, POOL_MANAGER, quadpadFactoryAbi, type Notice } from "./contracts";
import { decodeSlot0, extsloadAbi, poolId, poolStateSlot, quadpadPoolKey, type Slot0 } from "./pool";

const read = { address: FACTORY_ADDRESS, abi: quadpadFactoryAbi, chainId: ROBINHOOD_CHAIN_ID } as const;

/** The two addresses every page needs: the hook that charges, the locker that holds. */
export function useQuadpad() {
  const hook = useReadContract({ ...read, functionName: "hook", query: { enabled: BOARD_IS_OPEN } });
  const locker = useReadContract({ ...read, functionName: "locker", query: { enabled: BOARD_IS_OPEN } });

  return {
    hook: hook.data as Address | undefined,
    locker: locker.data as Address | undefined,
    isLoading: hook.isLoading || locker.isLoading,
  };
}

export type BoardStats = {
  tokens: bigint;
  lastLaunch: bigint;
  supply: bigint;
  feeBps: bigint;
  creatorBps: bigint;
  /** What the whole supply is priced at when a pool opens, in wei. */
  openingCapWei: bigint;
};

/**
 * The header figures, in one call.
 *
 * The rates and the opening price come back from the chain rather than from the
 * copy, so a site built against a factory that charges something else, or opens
 * somewhere else, shows what it actually does.
 */
export function useBoardStats() {
  const { data, isLoading, refetch } = useReadContract({
    ...read,
    functionName: "boardStats",
    query: { enabled: BOARD_IS_OPEN },
  });

  const stats = useMemo<BoardStats | null>(() => {
    if (!data) return null;
    const [tokens, lastLaunch, supply, feeBps, creatorBps, openingCapWei] = data as readonly [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];
    return { tokens, lastLaunch, supply, feeBps, creatorBps, openingCapWei };
  }, [data]);

  return { stats, isLoading, refetch };
}

/** A page of the board, newest first. */
export function useNotices(limit = 30) {
  const { data, isLoading, refetch } = useReadContract({
    ...read,
    functionName: "latest",
    args: [0n, BigInt(limit)],
    query: { enabled: BOARD_IS_OPEN },
  });

  return { notices: (data as readonly Notice[] | undefined) ?? [], isLoading, refetch };
}

export function useNoticesOf(creator: Address | undefined) {
  const ids = useReadContract({
    ...read,
    functionName: "noticesOf",
    args: creator ? [creator] : undefined,
    query: { enabled: BOARD_IS_OPEN && Boolean(creator) },
  });

  const list = (ids.data as readonly bigint[] | undefined) ?? [];

  const notices = useReadContracts({
    contracts: list.map((id) => ({ ...read, functionName: "noticeAt" as const, args: [id] as const })),
    query: { enabled: BOARD_IS_OPEN && list.length > 0 },
  });

  return {
    notices: (notices.data ?? [])
      .map((entry) => (entry.status === "success" ? (entry.result as unknown as Notice) : null))
      .filter((notice): notice is Notice => notice !== null)
      .reverse(),
    isLoading: ids.isLoading || notices.isLoading,
    refetch: notices.refetch,
  };
}

/**
 * The live price of every pool on a page, read straight out of the pool
 * manager's storage.
 *
 * One `extsload` per pool rather than one per figure: slot0 carries the price,
 * the tick and the LP fee in a single word, which is also the word that says
 * whether the pool exists at all.
 */
export function usePoolStates(notices: readonly Notice[], hook: Address | undefined) {
  const keys = useMemo(
    () => (hook ? notices.map((notice) => quadpadPoolKey(notice.token, hook, notice.tickSpacing)) : []),
    [notices, hook],
  );

  const { data, isLoading } = useReadContracts({
    contracts: keys.map((key) => ({
      address: POOL_MANAGER,
      abi: extsloadAbi,
      chainId: ROBINHOOD_CHAIN_ID,
      functionName: "extsload" as const,
      args: [poolStateSlot(poolId(key))] as const,
    })),
    query: { enabled: keys.length > 0 },
  });

  const states = useMemo(() => {
    const out = new Map<string, Slot0>();
    (data ?? []).forEach((entry, index) => {
      if (entry.status !== "success") return;
      out.set(notices[index].token.toLowerCase(), decodeSlot0(entry.result as `0x${string}`));
    });
    return out;
  }, [data, notices]);

  return { states, isLoading };
}
