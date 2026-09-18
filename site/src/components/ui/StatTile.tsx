import { clsx } from "@/lib/clsx";

/**
 * One figure off the chain. `value` is whatever was read — when there is nothing
 * to read it says so, rather than showing a zero that could be mistaken for a
 * measurement.
 */
export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | null | undefined;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={clsx("border-2 border-lane-faint/35 bg-ground-lift px-3 py-2.5", className)}>
      <div className="micro text-lane-soft">{label}</div>
      <div className={clsx("mt-1 truncate text-lg font-semibold", value ? "text-lane" : "text-lane-faint")}>
        {value ?? "n/a"}
      </div>
      {hint && <div className="micro mt-0.5 text-lane-faint">{hint}</div>}
    </div>
  );
}
