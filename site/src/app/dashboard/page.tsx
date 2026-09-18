import type { Metadata } from "next";

import { DeploymentNotice } from "@/components/board/DeploymentNotice";
import { MyLaunches } from "@/components/dashboard/MyLaunches";

export const metadata: Metadata = {
  title: "Yours",
  description: "What you launched, and what the fee on it has earned.",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <DeploymentNotice />

      <header>
        <h1 className="font-display text-3xl text-lane">Yours</h1>
        <p className="mt-2 max-w-2xl text-sm text-lane-soft">
          What this address launched, and what the fee on it is holding for you. The ledger is per address rather than
          per pool, so everything collects in one transaction.
        </p>
      </header>

      <MyLaunches />
    </div>
  );
}
