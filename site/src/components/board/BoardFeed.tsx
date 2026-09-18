"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { LaunchCard } from "./LaunchCard";
import { useNotices, usePoolStates, useQuadpad } from "@/lib/board";
import { BOARD_IS_OPEN } from "@/lib/contracts";

export function BoardFeed() {
  const { hook } = useQuadpad();
  const { notices, isLoading } = useNotices();
  const { states } = usePoolStates(notices, hook);

  if (!BOARD_IS_OPEN) {
    return (
      <EmptyState title="There is no board yet">
        Nothing is deployed, so there is nothing to read. This page will fill itself from the chain the moment a factory
        address is configured — it holds no list of its own.
      </EmptyState>
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-52 animate-pulse border-2 border-signal/20 bg-ground-soft" />
        ))}
      </div>
    );
  }

  if (notices.length === 0) {
    return (
      <EmptyState title="Nobody has launched anything yet">
        The board is genuinely empty rather than still loading. Launching costs gas and nothing else, so the first
        notice can be yours.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {notices.map((notice) => (
        <LaunchCard key={String(notice.id)} notice={notice} state={states.get(notice.token.toLowerCase())} />
      ))}
    </div>
  );
}
