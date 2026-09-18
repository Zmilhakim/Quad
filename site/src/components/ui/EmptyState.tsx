import type { ReactNode } from "react";

/**
 * What a page shows when there is genuinely nothing to show. It says so rather
 * than dressing the gap up with placeholder rows.
 */
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-2 border-dashed border-lane-faint/50 bg-ground-lift/40 px-5 py-10 text-center">
      <h3 className="font-display text-xl text-lane">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-lane-soft">{children}</p>
    </div>
  );
}
