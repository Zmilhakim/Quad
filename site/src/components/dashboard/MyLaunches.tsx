"use client";

import Link from "next/link";
import { useConnection } from "wagmi";

import { LaunchCard } from "@/components/board/LaunchCard";
import { FeeLedger } from "./FeeLedger";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useNotices, useNoticesOf, usePoolStates, useQuadpad } from "@/lib/board";
import { BOARD_IS_OPEN } from "@/lib/contracts";

export function MyLaunches() {
  const { address, isConnected } = useConnection();
  const { hook } = useQuadpad();
  const { notices, isLoading } = useNoticesOf(address);
  const { states } = usePoolStates(notices, hook);

  // The ledger asks about the whole board, not just this address's launches.
  // A creator only ever earns in their own token, but the treasury earns 20% of
  // every fee on every pool — and asking only about your own launches would
  // show it an empty page while it was owed something.
  const { notices: board } = useNotices();

  if (!BOARD_IS_OPEN) {
    return (
      <EmptyState title="Nothing is deployed">
        There is no factory to ask about your launches. This page reads the chain and holds nothing of its own.
      </EmptyState>
    );
  }

  if (!isConnected) {
    return (
      <EmptyState title="Connect a wallet">
        This page shows what an address launched and what its launches have earned. It reads; it stores nothing about
        you.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <FeeLedger hook={hook} notices={board} />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-52 animate-pulse border-2 border-signal/20 bg-ground-soft" />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <EmptyState title="You have not launched anything">
          <span className="block">Launching costs gas and nothing else, and the supply never touches your wallet.</span>
          <Link href="/launch" className={buttonClasses("signal", "mt-4")}>
            Launch a token
          </Link>
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {notices.map((notice) => (
            <LaunchCard key={String(notice.id)} notice={notice} state={states.get(notice.token.toLowerCase())} hook={hook} />
          ))}
        </div>
      )}
    </div>
  );
}
