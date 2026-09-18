import Link from "next/link";
import type { Address } from "viem";

import { Badge } from "@/components/ui/Badge";
import { TokenImage } from "./TokenImage";
import { explorerAddress } from "@/lib/chain";
import type { Notice } from "@/lib/contracts";
import { formatEth, formatTokenAmount, shortAddress, timeAgo } from "@/lib/format";
import { ethPerToken, type Slot0 } from "@/lib/pool";
import { ethInPosition, tokensInPosition } from "@/lib/ticks";

/**
 * One notice off the board.
 *
 * Everything on it is read from the chain: the metadata from the factory, the
 * price and the two holdings from the pool manager. A pool the manager has no
 * price for says so rather than showing a zero — that state should be
 * impossible, which is exactly why it is worth printing when it happens.
 */
export function LaunchCard({ notice, state }: { notice: Notice; state?: Slot0 }) {
  const priced = state?.initialized ?? false;

  const eth = priced ? ethInPosition(notice.liquidity, state!.sqrtPriceX96, notice.tickLower, notice.tickUpper) : null;
  const unsold = priced
    ? tokensInPosition(notice.liquidity, state!.sqrtPriceX96, notice.tickLower, notice.tickUpper)
    : null;
  const price = priced ? ethPerToken(state!.sqrtPriceX96) : null;

  const sold =
    unsold !== null && notice.supply > 0n ? Math.max(0, 1 - Number(unsold) / Number(notice.supply)) : null;

  return (
    <article className="drop border-2 border-signal/35 bg-ground-soft">
      <div className="flex items-start gap-3 border-b border-signal/20 p-3">
        <TokenImage uri={notice.imageURI} symbol={notice.symbol} className="size-14 shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate font-display text-lg text-lane">{notice.name}</h3>
            <span className="micro shrink-0 font-semibold text-signal">${notice.symbol}</span>
          </div>
          <p className="micro mt-0.5 text-lane-faint">
            #{String(notice.id)} · {timeAgo(notice.launchedAt) ?? "just now"} · by{" "}
            <a
              className="underline decoration-signal/40 underline-offset-2 hover:text-signal"
              href={explorerAddress(notice.creator)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddress(notice.creator)}
            </a>
          </p>
        </div>

        <Badge tone={priced ? "live" : "idle"}>{priced ? "live" : "no price"}</Badge>
      </div>

      {notice.blurb && <p className="border-b border-signal/20 px-3 py-2.5 text-sm text-lane-soft">{notice.blurb}</p>}

      <dl className="grid grid-cols-3 gap-px bg-signal/20">
        {[
          ["In the pool", formatEth(eth) ?? "—"],
          ["Unsold", unsold === null ? "—" : `${formatTokenAmount(unsold)}`],
          ["Price", price === null ? "—" : `${price.toExponential(2)} ETH`],
        ].map(([label, value]) => (
          <div key={label} className="bg-ground-soft px-3 py-2">
            <dt className="micro text-lane-faint">{label}</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold text-lane">{value}</dd>
          </div>
        ))}
      </dl>

      {sold !== null && (
        <div className="px-3 pt-3">
          <div className="h-1.5 w-full bg-ground-lift">
            <div className="h-full bg-signal" style={{ width: `${Math.round(sold * 100)}%` }} />
          </div>
          <p className="micro mt-1 text-lane-faint">{Math.round(sold * 100)}% of the supply bought</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
        <a
          className="micro text-lane-soft underline decoration-signal/40 underline-offset-4 hover:text-signal"
          href={explorerAddress(notice.token as Address)}
          target="_blank"
          rel="noreferrer"
        >
          {shortAddress(notice.token)} ↗
        </a>
        {notice.link && (
          <a
            className="micro text-lane-soft underline decoration-signal/40 underline-offset-4 hover:text-signal"
            href={notice.link}
            target="_blank"
            rel="noreferrer nofollow"
          >
            Creator’s link ↗
          </a>
        )}
        <Link className="micro ml-auto text-lane-faint hover:text-signal" href="/learn">
          4% fee · liquidity locked
        </Link>
      </div>
    </article>
  );
}
