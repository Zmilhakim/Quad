import type { ReactNode } from "react";
import { clsx } from "@/lib/clsx";

type BadgeTone = "live" | "idle" | "signal";

const TONES: Record<BadgeTone, string> = {
  live: "border-go bg-go/15 text-go",
  idle: "border-lane-faint/60 bg-ground-lift text-lane-soft",
  signal: "border-signal bg-signal/15 text-signal",
};

export function Badge({ tone = "idle", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={clsx("micro inline-flex items-center gap-1.5 border px-2 py-0.5 font-semibold", TONES[tone])}>
      {tone === "live" && <span className="size-1.5 shrink-0 rounded-full bg-go" />}
      {children}
    </span>
  );
}
