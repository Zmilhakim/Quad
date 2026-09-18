import type { ReactNode } from "react";
import { clsx } from "@/lib/clsx";

type PanelProps = {
  /** The micro-caption printed across the header batten. */
  label?: string;
  /** Anything that belongs on the right of the batten — a status, a count. */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

/** A panel with a signal-yellow batten across the top. Every surface is one. */
export function Panel({ label, aside, children, className, bodyClassName }: PanelProps) {
  return (
    <section className={clsx("drop border-2 border-signal/45 bg-ground-soft", className)}>
      {(label || aside) && (
        <header className="flex items-center justify-between gap-3 bg-signal px-3 py-1.5 text-ink">
          {label ? <span className="micro font-semibold">{label}</span> : <span />}
          {aside}
        </header>
      )}
      <div className={clsx("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
