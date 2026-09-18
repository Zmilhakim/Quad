import Link from "next/link";

import { BoardStats } from "@/components/board/BoardStats";
import { DeploymentNotice } from "@/components/board/DeploymentNotice";
import { buttonClasses } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chain";
import { CREATOR_BPS, FEE_BPS, OPENING_MARKET_CAP, OPENING_TICK } from "@/lib/contracts";

const STEPS = [
  {
    title: "You launch, at the same price as everyone",
    body: `One transaction mints a billion tokens straight to the locker, opens a Uniswap v4 pool against native ETH at tick ${OPENING_TICK.toLocaleString("en-US")}, and puts the entire supply in. There is no price to choose and no argument in the contract that could choose one. It costs gas and nothing else.`,
  },
  {
    title: "The pool shuts behind it",
    body: "The liquidity goes into a contract with no function that takes any out. Not for you, not for us, not by vote. A v4 position is a row in the pool manager rather than an NFT, so there is nothing to sell or approve away either.",
  },
  {
    title: "Every swap pays the fee",
    body: `${FEE_BPS / 100}% of everything paid into the pool, in either direction. Buys pay it in ETH, sells pay it in the token. ${CREATOR_BPS / 100}% of it is yours, for as long as anyone trades.`,
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <DeploymentNotice />

      <section className="border-2 border-signal/45 bg-ground-soft drop">
        <div className="hazard h-3" />
        <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <span className="micro font-semibold text-signal">One rate. One supply. One opening price.</span>
            <h1 className="font-display mt-3 text-4xl leading-[1.08] text-lane sm:text-5xl">
              Every launch opens at {OPENING_MARKET_CAP} ETH
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-lane-soft sm:text-base">
              A billion tokens, all of them in the pool, priced so the lot comes to{" "}
              <strong className="text-lane">{OPENING_MARKET_CAP} ETH</strong> at the tick it opens on — the same tick
              as every other Quadpad token. After that every swap pays{" "}
              <strong className="text-lane">{FEE_BPS / 100}%</strong>, and{" "}
              <strong className="text-lane">{CREATOR_BPS / 100}% of it</strong> belongs to whoever launched it.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-lane-soft">
              No presale to price it, no allocation, no unlock schedule. There is nowhere to put one: the supply has
              exactly one destination and it is the pool.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href="/launch" className={buttonClasses("signal")}>
                Launch a token
              </Link>
              <Link href="/board" className={buttonClasses("quiet")}>
                Read the board
              </Link>
              <Link href="/learn" className={buttonClasses("ghost")}>
                How it works
              </Link>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-px self-start border-2 border-signal/40 bg-signal/40">
            {[
              ["Opens at", `${OPENING_MARKET_CAP} ETH`],
              ["Fee", `${FEE_BPS / 100}%`],
              ["To the creator", `${CREATOR_BPS / 100}%`],
              ["Supply", "1,000,000,000"],
              ["Liquidity", "Locked"],
              ["To launch", "Gas"],
            ].map(([label, value]) => (
              <div key={label} className="bg-ground-soft px-4 py-3">
                <dt className="micro text-lane-soft">{label}</dt>
                <dd className="mt-1 text-lg font-semibold text-lane">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <BoardStats />

      <section className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <Panel key={step.title} label={`Step ${index + 1}`}>
            <h2 className="font-display text-lg text-lane">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-lane-soft">{step.body}</p>
          </Panel>
        ))}
      </section>

      <Panel label="The part worth being clear-eyed about">
        <p className="text-sm leading-relaxed text-lane-soft">
          Locked liquidity means locked. Everything anyone pays to buy a token becomes liquidity and does not come back
          out — for the creator as much as for anyone else. The fee comes out; the liquidity does not. Those are two
          different promises and it is worth knowing which is which.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-lane-soft">
          And {OPENING_MARKET_CAP} ETH is a price, not a deposit. The pool opens one-sided — all token, no ETH — so
          nothing is backing that number and there is nothing in the pool to withdraw until somebody buys.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-lane-soft">
          Nothing here is audited. The contracts are on Uniswap v4 on Robinhood Chain ({ROBINHOOD_CHAIN_ID}), and every
          figure this site shows is read from the pool manager or the factory rather than from a database.
        </p>
      </Panel>
    </div>
  );
}
