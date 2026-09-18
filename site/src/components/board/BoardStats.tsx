"use client";

import { StatTile } from "@/components/ui/StatTile";
import { useBoardStats } from "@/lib/board";
import { BOARD_IS_OPEN } from "@/lib/contracts";
import { formatBps, formatCount, formatEth, formatTokenAmount, timeAgo } from "@/lib/format";

/**
 * The header figures.
 *
 * The rates and the opening price are read from the chain rather than printed
 * from the copy, so a factory whose hook charges something else — or whose
 * pools open somewhere else — would say so here instead of being described by a
 * page that is out of date.
 */
export function BoardStats() {
  const { stats, isLoading } = useBoardStats();

  const value = <T,>(fn: (s: NonNullable<typeof stats>) => T) =>
    !BOARD_IS_OPEN || !stats ? null : (fn(stats) as string | null);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatTile
        label="Launches"
        value={value((s) => formatCount(s.tokens))}
        hint={!BOARD_IS_OPEN ? "nothing deployed" : isLoading ? "reading…" : "on the board"}
      />
      <StatTile
        label="Opens at"
        value={value((s) => formatEth(s.openingCapWei))}
        hint="every launch, the same"
      />
      <StatTile label="Fee" value={value((s) => formatBps(s.feeBps))} hint="of every swap, both ways" />
      <StatTile label="To the creator" value={value((s) => formatBps(s.creatorBps))} hint="of the fee" />
      <StatTile
        label="Last launch"
        value={value((s) => (s.lastLaunch === 0n ? "none yet" : timeAgo(s.lastLaunch)))}
        hint={value((s) => `${formatTokenAmount(s.supply)} supply each`) ?? undefined}
      />
    </section>
  );
}
