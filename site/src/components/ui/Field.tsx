import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { clsx } from "@/lib/clsx";

const CONTROL =
  "w-full border-2 border-lane-faint/50 bg-ground px-3 py-2 text-sm text-lane placeholder:text-lane-faint focus:border-signal";

function Shell({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="micro text-lane-soft">{label}</span>
      <span className="mt-1 block">{children}</span>
      {error ? (
        <span className="micro mt-1 block font-semibold text-rust">{error}</span>
      ) : hint ? (
        <span className="micro mt-1 block text-lane-faint">{hint}</span>
      ) : null}
    </label>
  );
}

export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  return (
    <Shell label={label} hint={hint} error={error}>
      <input className={clsx(CONTROL, error && "border-rust", className)} {...props} />
    </Shell>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: ReactNode; error?: string | null }) {
  return (
    <Shell label={label} hint={hint} error={error}>
      <textarea className={clsx(CONTROL, "resize-y", error && "border-rust", className)} {...props} />
    </Shell>
  );
}
