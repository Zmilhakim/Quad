import type { Metadata } from "next";
import Link from "next/link";

import { Panel } from "@/components/ui/Panel";
import { buttonClasses } from "@/components/ui/Button";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chain";
import {
  CREATOR_BPS,
  FEE_BPS,
  LAUNCH_TICK_SPACING,
  OPENING_MARKET_CAP,
  OPENING_TICK,
  TICK_LOWER,
} from "@/lib/contracts";

export const metadata: Metadata = {
  title: "How it works",
  description: "The mechanism, the rate, the one opening price, and the things Quadpad does not promise.",
};

const QUESTIONS = [
  {
    q: `Why does every token open at ${OPENING_MARKET_CAP} ETH?`,
    a: `Because the price is not a launch parameter. Three constants in the factory decide it — the tick the pool opens at (${OPENING_TICK.toLocaleString("en-US")}), the bottom of its range (${TICK_LOWER.toLocaleString("en-US")}) and the spacing both sit on (${LAUNCH_TICK_SPACING}) — and \`launch\` takes no price argument at all. Elsewhere the person posting picks the opening tick, so two tokens posted on the same afternoon can open an order of magnitude apart and a buyer has to work out which is which first. Here there is one number to learn and it is the same every time.`,
  },
  {
    q: `Is it exactly ${OPENING_MARKET_CAP} ETH?`,
    a: "It is 1.700080239474970520 ETH, and that is as near as this curve comes. A Uniswap pool's price moves in ticks of 1.0001, so not every number is reachable; 201,936 is the tick closest to 1.7 ETH for a billion tokens, and it is 0.005% over. The contract derives that figure from the tick rather than storing it, so the two cannot drift apart.",
  },
  {
    q: `Is ${OPENING_MARKET_CAP} ETH sitting in the pool?`,
    a: "No, and this is the important one. The pool opens single-sided: all token, no ETH. The market cap is what the supply is priced at, not money backing it — there is nothing in the pool to withdraw until somebody buys, and what they pay becomes liquidity that does not come back out.",
  },
  {
    q: `What exactly is the ${FEE_BPS / 100}%?`,
    a: `${FEE_BPS / 100}% of everything paid into the pool, in either direction. Buy with ETH and the fee is ${FEE_BPS / 100}% of the ETH; sell the token back and it is ${FEE_BPS / 100}% of the token. Of that, ${CREATOR_BPS / 100}% goes to whoever launched the token and ${(10_000 - CREATOR_BPS) / 100}% to the treasury. There is no second fee: the pool's own LP fee is zero, so this is the entire fee schedule.`,
  },
  {
    q: "Can the rate be changed later?",
    a: "No. The rate lives in a Uniswap v4 hook, and a pool's hook is part of its key — fixed when the pool is opened. Not governed, not timelocked, not “no plans to change it”: a different hook is a different pool. The split is a constant in the same contract, with no setter under any spelling. The opening price is the same kind of thing: a constant in the factory, with no argument that reaches it.",
  },
  {
    q: "Where does the liquidity go?",
    a: "Into a contract with no function that takes any out. Liquidity leaves a v4 pool through exactly one door — a modifyLiquidity with a negative delta — and there is no such call in the locker. A v4 position is also a row in the pool manager rather than an NFT, so there is nothing to transfer, sell, borrow against or approve away by mistake.",
  },
  {
    q: "What does the creator hold after launching?",
    a: "No tokens at all. The supply is minted straight to the locker and goes from there into the pool; it never passes through the creator's wallet or the factory. “Nothing was held back” is not a promise anybody has to keep — there is no moment at which anybody holds anything to keep. What they own is a claim on the fee, and nothing else.",
  },
  {
    q: "Why is the fee charged on the way in?",
    a: "It costs a trader the same either way, but it decides what a creator earns. Charging the input means a buy pays its fee in ETH; charging the output would pay it in the token being bought, which is the one asset a creator already has plenty of.",
  },
  {
    q: "Why does collecting need its own transaction?",
    a: "Because the fee is banked as a claim rather than taken as cash. Moving real assets out of the pool manager mid-swap would mean the manager fronting ETH the trader has not paid yet — on a young pool with no ETH in it, that is a buy that reverts. So the hook mints an ERC-6909 claim during the swap and redeems it for the real thing when you collect.",
  },
];

export default function LearnPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl text-lane">How it works</h1>
        <p className="mt-2 max-w-2xl text-sm text-lane-soft">
          Uniswap v4 on Robinhood Chain ({ROBINHOOD_CHAIN_ID}). One rate, one supply, one opening price, and a lock
          with no key.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {QUESTIONS.map(({ q, a }) => (
          <Panel key={q} label="Q">
            <h2 className="font-display text-lg text-lane">{q}</h2>
            <p className="mt-2 text-sm leading-relaxed text-lane-soft">{a}</p>
          </Panel>
        ))}
      </div>

      <Panel label="What this does not promise">
        <ul className="space-y-3 text-sm leading-relaxed text-lane-soft">
          <li>
            <strong className="text-lane">Locked liquidity means locked.</strong> Everything anyone pays to buy a token
            becomes liquidity and does not come back out — for the creator as much as for anyone else. The fee comes
            out; the liquidity does not.
          </li>
          <li>
            <strong className="text-lane">A fee is only earned when somebody trades.</strong> A launch nobody buys
            earns nothing. Nothing here makes anybody want a token.
          </li>
          <li>
            <strong className="text-lane">The opening price is a price, not a floor.</strong> Every token starts at the
            same valuation; what happens after the first trade is whatever the buying and selling does. The same
            starting line is not the same race.
          </li>
          <li>
            <strong className="text-lane">None of it is audited.</strong> The contracts are readable and tested against
            Uniswap&rsquo;s own pool manager, which is not the same thing as audited.
          </li>
          <li>
            <strong className="text-lane">Anyone can launch anything.</strong> The board does not vet names, pictures or
            links, and a picture or a link on a notice was put there by whoever launched it. Read the contract address
            before you buy anything.
          </li>
        </ul>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <Link href="/launch" className={buttonClasses("signal")}>
            Launch a token
          </Link>
          <Link href="/board" className={buttonClasses("quiet")}>
            Read the board
          </Link>
        </div>
      </Panel>
    </div>
  );
}
