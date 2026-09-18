import Link from "next/link";

import { BOARD_IS_OPEN } from "@/lib/contracts";

/**
 * The banner every page carries while there is no factory.
 *
 * It is the whole reason the site is honest: with no address configured there
 * is nothing to read, and a board of zeros looks exactly like a board nobody has
 * used. This says which of the two it is.
 */
export function DeploymentNotice() {
  if (BOARD_IS_OPEN) return null;

  return (
    <div className="mb-6 border-2 border-signal/50 bg-signal/10 px-4 py-3">
      <p className="text-sm text-lane">
        <span className="micro mr-2 font-semibold text-signal">Not deployed</span>
        Quadpad has no contracts on Robinhood Chain yet, so there is nothing to read and nothing to launch. Everything
        below describes what the contracts in the repository do, not something that is live.
      </p>
      <p className="micro mt-2 text-lane-soft">
        Deploy it with <code className="text-signal">npm run deploy</code> in <code>contracts/</code>, then set{" "}
        <code className="text-signal">NEXT_PUBLIC_FACTORY_ADDRESS</code>.{" "}
        <Link className="underline decoration-signal/50 underline-offset-4 hover:text-signal" href="/learn">
          How it works
        </Link>
      </p>
    </div>
  );
}
