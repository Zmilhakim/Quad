import type { Metadata } from "next";

import { DeploymentNotice } from "@/components/board/DeploymentNotice";
import { LaunchForm } from "@/components/launch/LaunchForm";

export const metadata: Metadata = {
  title: "Launch",
  description: "Mint the supply, open the pool at 1.7 ETH and lock it — in one transaction, for the price of gas.",
};

export default function LaunchPage() {
  return (
    <div className="space-y-6">
      <DeploymentNotice />

      <header>
        <h1 className="font-display text-3xl text-lane">Launch a token</h1>
        <p className="mt-2 max-w-2xl text-sm text-lane-soft">
          One transaction: the supply is minted to the locker, a Uniswap v4 pool opens against native ETH at the one
          price every Quadpad pool opens at, and the whole supply goes in where nobody can take it out. It costs gas
          and nothing else.
        </p>
      </header>

      <LaunchForm />
    </div>
  );
}
