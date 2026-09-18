import Link from "next/link";

import { ROBINHOOD_CHAIN_ID } from "@/lib/chain";
import { BOARD_IS_OPEN, FACTORY_ADDRESS } from "@/lib/contracts";
import { explorerAddress } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t-2 border-signal/30 bg-ground-deep">
      <div className="hazard h-2.5" />
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5">
        <span className="micro font-semibold text-signal">$QUAD</span>
        <span className="micro text-lane-soft">Uniswap v4 · Robinhood Chain {ROBINHOOD_CHAIN_ID}</span>
        <span className="micro text-lane-soft">4% fee · 80% to the creator</span>

        {BOARD_IS_OPEN && FACTORY_ADDRESS ? (
          <a
            className="micro text-lane-soft underline decoration-signal/50 underline-offset-4 hover:text-signal"
            href={explorerAddress(FACTORY_ADDRESS)}
            target="_blank"
            rel="noreferrer"
          >
            Factory {shortAddress(FACTORY_ADDRESS)} ↗
          </a>
        ) : (
          <span className="micro text-lane-faint">Not deployed yet</span>
        )}

        <Link className="micro ml-auto text-lane-soft hover:text-signal" href="/learn">
          What this does not promise
        </Link>
      </div>
    </footer>
  );
}
