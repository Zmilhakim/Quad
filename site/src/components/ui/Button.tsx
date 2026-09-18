import type { ButtonHTMLAttributes } from "react";
import { clsx } from "@/lib/clsx";

export type ButtonTone = "signal" | "quiet" | "ghost";

const TONES: Record<ButtonTone, string> = {
  signal: "border-signal bg-signal text-ink hover:bg-signal-deep",
  quiet: "border-signal/60 bg-ground-lift text-lane hover:border-signal hover:text-signal",
  ghost: "border-lane-faint/50 bg-transparent text-lane-soft hover:border-lane-soft hover:text-lane",
};

export function buttonClasses(tone: ButtonTone = "signal", className?: string) {
  return clsx(
    "micro drop-sm inline-flex items-center justify-center gap-2 border-2 px-3 py-2 font-semibold",
    "transition-[background-color,color,border-color,transform] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
    "disabled:pointer-events-none disabled:opacity-40",
    TONES[tone],
    className,
  );
}

export function Button({
  tone = "signal",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return <button className={buttonClasses(tone, className)} {...props} />;
}
