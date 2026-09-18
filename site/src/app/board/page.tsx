import type { Metadata } from "next";

import { BoardFeed } from "@/components/board/BoardFeed";
import { BoardStats } from "@/components/board/BoardStats";
import { DeploymentNotice } from "@/components/board/DeploymentNotice";

export const metadata: Metadata = {
  title: "The board",
  description: "Every token launched through Quadpad, read straight from the chain.",
};

export default function BoardPage() {
  return (
    <div className="space-y-6">
      <DeploymentNotice />

      <header>
        <h1 className="font-display text-3xl text-lane">The board</h1>
        <p className="mt-2 max-w-2xl text-sm text-lane-soft">
          Every launch, newest first. The metadata comes from the factory and the prices come from the pool manager —
          there is no database in between, and nothing here is an estimate.
        </p>
      </header>

      <BoardStats />
      <BoardFeed />
    </div>
  );
}
