"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useConnection, useReadContracts, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { explorerTx, ROBINHOOD_CHAIN_ID } from "@/lib/chain";
import { NATIVE, quadHookAbi, type Notice } from "@/lib/contracts";
import { formatEth, formatTokenAmount } from "@/lib/format";

/**
 * What the hook owes you, and the one button that pays it.
 *
 * The ledger is keyed by address rather than by pool, so three launches means
 * one row of ETH rather than three — and `withdrawMany` settles the ETH and
 * every token in a single transaction. It pays the caller and nobody else:
 * there is no recipient argument to get wrong.
 *
 * `notices` is the whole board rather than the connected address's launches. A
 * creator is only ever owed in their own token, so the difference is invisible
 * to them; the treasury is owed 20% of every fee on every pool, and the shorter
 * list would have shown it nothing while it was owed something.
 */
export function FeeLedger({ hook, notices }: { hook: Address | undefined; notices: readonly Notice[] }) {
  const { address, chainId, isConnected } = useConnection();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  // The claim is readable from any chain — the reads are pinned to Robinhood
  // Chain — but the withdrawal is a transaction, and a wallet pointed at
  // another chain cannot send it. Pressing Collect while it is elsewhere used
  // to return the raw mismatch from wagmi, which reads like the collection
  // failed rather than never having been attempted.
  const wrongChain = isConnected && chainId !== ROBINHOOD_CHAIN_ID;

  // Native ETH first — it is the one every buy pays in — then every token on
  // the board, which is what sells pay in. Rows worth nothing are dropped
  // below, so a long board costs reads rather than clutter.
  const currencies = useMemo<Address[]>(
    () => [NATIVE, ...notices.map((notice) => notice.token)],
    [notices],
  );

  const { data, isLoading, refetch } = useReadContracts({
    contracts: currencies.map((currency) => ({
      address: hook,
      abi: quadHookAbi,
      chainId: ROBINHOOD_CHAIN_ID,
      functionName: "owed" as const,
      args: [address as Address, currency] as const,
    })),
    query: { enabled: Boolean(hook && address) },
  });

  const rows = useMemo(
    () =>
      currencies
        .map((currency, index) => {
          const entry = data?.[index];
          const amount = entry?.status === "success" ? (entry.result as bigint) : 0n;
          const notice = index === 0 ? null : notices[index - 1];
          return { currency, amount, label: notice ? `$${notice.symbol}` : "ETH", isNative: index === 0 };
        })
        .filter((row) => row.amount > 0n),
    [currencies, data, notices],
  );

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  if (receipt.isSuccess && !isLoading && rows.length === 0) {
    // The refetch below has already run; nothing is owed any more.
  }

  const collect = () => {
    if (!hook || rows.length === 0) return;
    writeContract({
      address: hook,
      abi: quadHookAbi,
      functionName: "withdrawMany",
      chainId: ROBINHOOD_CHAIN_ID,
      args: [rows.map((row) => row.currency)],
    });
  };

  return (
    <Panel
      label="The fee you are owed"
      aside={rows.length > 0 ? <Badge tone="signal">{rows.length} to collect</Badge> : undefined}
    >
      {!isConnected ? (
        <p className="text-sm text-lane-soft">Connect a wallet to see what it is owed.</p>
      ) : isLoading ? (
        <p className="text-sm text-lane-soft">Reading the hook…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm leading-relaxed text-lane-soft">
          Nothing yet. A fee is only charged when somebody trades, so an untraded launch has earned nothing rather than
          lost it — and what it has earned sits as a claim against the pool manager until you take it.
        </p>
      ) : (
        <>
          <dl className="space-y-1.5">
            {rows.map((row) => (
              <div key={row.currency} className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="text-lane-faint">{row.label}</dt>
                <dd className="font-semibold text-lane">
                  {row.isNative ? formatEth(row.amount) : formatTokenAmount(row.amount)}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-signal/20 pt-4">
            {wrongChain ? (
              <Button onClick={() => switchChain({ chainId: ROBINHOOD_CHAIN_ID })} disabled={isSwitching}>
                {isSwitching ? "Confirm in wallet…" : `Switch to Robinhood Chain`}
              </Button>
            ) : (
              <Button onClick={collect} disabled={isPending || receipt.isLoading}>
                {isPending ? "Confirm in wallet…" : receipt.isLoading ? "Collecting…" : "Collect all"}
              </Button>
            )}

            {wrongChain && (
              <span className="micro text-lane-soft">
                This is owed on Robinhood Chain ({ROBINHOOD_CHAIN_ID}); your wallet is on another one.
              </span>
            )}
            {receipt.isSuccess && (
              <button className="micro text-lane-soft underline underline-offset-4" onClick={() => refetch()}>
                Collected — refresh
              </button>
            )}
            {hash && (
              <a className={buttonClasses("ghost")} href={explorerTx(hash)} target="_blank" rel="noreferrer">
                Transaction ↗
              </a>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="mt-3 border-2 border-rust/60 bg-rust/10 px-3 py-2 text-sm text-lane">
          {error.message.split("\n")[0]}
        </p>
      )}
    </Panel>
  );
}
