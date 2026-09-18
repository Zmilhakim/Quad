"use client";

import { useState } from "react";

import { clsx } from "@/lib/clsx";

const GATEWAY = "https://ipfs.io/ipfs/";

/** ipfs:// is not a scheme a browser fetches; everything else is passed through. */
function resolve(uri: string) {
  const trimmed = uri.trim();
  if (trimmed.startsWith("ipfs://")) return GATEWAY + trimmed.slice("ipfs://".length);
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

/**
 * A creator's picture, or the ticker's first letters.
 *
 * The URL comes off the chain, which means anybody can put anything in it — so
 * it is only ever rendered as an image, never as a link, and a broken one falls
 * back rather than leaving a hole.
 */
export function TokenImage({ uri, symbol, className }: { uri: string; symbol: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = uri ? resolve(uri) : null;

  if (!src || failed) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center border-2 border-signal/40 bg-ground-lift font-display text-signal",
          className,
        )}
      >
        {symbol.slice(0, 3).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={clsx("border-2 border-signal/40 bg-ground-lift object-cover", className)}
    />
  );
}
