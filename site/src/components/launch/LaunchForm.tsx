"use client";

import { useState } from "react";
import Link from "next/link";
import { useConnection, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { Badge } from "@/components/ui/Badge";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Field, TextField } from "@/components/ui/Field";
import { Panel } from "@/components/ui/Panel";
import { StatTile } from "@/components/ui/StatTile";
import { TokenImage } from "@/components/board/TokenImage";
import { explorerTx, ROBINHOOD_CHAIN_ID } from "@/lib/chain";
import {
  BOARD_IS_OPEN,
  CREATOR_BPS,
  FACTORY_ADDRESS,
  FEE_BPS,
  LAUNCH_TICK_SPACING,
  OPENING_MARKET_CAP,
  OPENING_TICK,
  TICK_LOWER,
  quadpadFactoryAbi,
} from "@/lib/contracts";

type Draft = {
  name: string;
  symbol: string;
  imageURI: string;
  blurb: string;
  link: string;
};

const EMPTY: Draft = {
  name: "",
  symbol: "",
  imageURI: "",
  blurb: "",
  link: "",
};

/**
 * The launch form.
 *
 * Everything a creator controls is on this page, and that is the whole list: a
 * name, a ticker, a picture, a sentence and a link. There is no allocation
 * field because there is nowhere for an allocation to go — and no price field,
 * which is the part that makes this launchpad what it is. Every pool opens at
 * the same tick, and `launch` has no argument that could open it anywhere else.
 */
export function LaunchForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const { chainId, isConnected } = useConnection();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const name = draft.name.trim();
  const symbol = draft.symbol.trim().toUpperCase();

  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const wrongChain = isConnected && chainId !== ROBINHOOD_CHAIN_ID;

  const blocker = !BOARD_IS_OPEN
    ? "Quadpad is not deployed on Robinhood Chain yet."
    : !isConnected
      ? "Connect a wallet to launch."
      : wrongChain
        ? `Switch to Robinhood Chain (${ROBINHOOD_CHAIN_ID}).`
        : name.length === 0 || symbol.length === 0
          ? "A name and a ticker are the minimum."
          : null;

  const submit = () => {
    if (blocker || !FACTORY_ADDRESS) return;

    writeContract({
      address: FACTORY_ADDRESS,
      abi: quadpadFactoryAbi,
      functionName: "launch",
      chainId: ROBINHOOD_CHAIN_ID,
      args: [
        {
          name,
          symbol,
          imageURI: draft.imageURI.trim(),
          blurb: draft.blurb.trim(),
          link: draft.link.trim(),
        },
      ],
    });
  };

  if (receipt.isSuccess) {
    return (
      <Panel label="Launched" aside={<Badge tone="live">confirmed</Badge>}>
        <h2 className="font-display text-2xl text-lane">
          {name} (${symbol}) is on the board
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-lane-soft">
          The supply is in the pool and the pool is shut. You hold none of it — you never did, it was minted to the
          locker — and from the first trade onwards {CREATOR_BPS / 100}% of every {FEE_BPS / 100}% fee is yours.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link href="/board" className={buttonClasses("signal")}>
            See it on the board
          </Link>
          <Link href="/dashboard" className={buttonClasses("quiet")}>
            What you are owed
          </Link>
          {hash && (
            <a className={buttonClasses("ghost")} href={explorerTx(hash)} target="_blank" rel="noreferrer">
              Transaction ↗
            </a>
          )}
        </div>
        <button
          className="micro mt-4 text-lane-faint underline underline-offset-4 hover:text-signal"
          onClick={() => {
            reset();
            setDraft(EMPTY);
          }}
        >
          Launch another
        </button>
      </Panel>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr] lg:items-start">
      <Panel label="The token">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              value={draft.name}
              maxLength={40}
              placeholder="Four Percent Frog"
              onChange={(e) => set("name", e.target.value)}
            />
            <Field
              label="Ticker"
              value={draft.symbol}
              maxLength={11}
              placeholder="FPF"
              onChange={(e) => set("symbol", e.target.value.toUpperCase())}
              hint="Shown as $TICKER everywhere"
            />
          </div>

          <Field
            label="Picture URL"
            value={draft.imageURI}
            placeholder="https://… or ipfs://…"
            onChange={(e) => set("imageURI", e.target.value)}
            hint="Stored on chain as text. Anything a browser can load."
          />

          <TextField
            label="One line about it"
            value={draft.blurb}
            rows={2}
            maxLength={160}
            placeholder="What it is, in a sentence."
            onChange={(e) => set("blurb", e.target.value)}
          />

          <Field
            label="Link"
            value={draft.link}
            placeholder="https://x.com/…"
            onChange={(e) => set("link", e.target.value)}
          />

          <div className="border-2 border-signal/25 bg-ground-deep px-4 py-3">
            <span className="micro text-signal">The price is not a field</span>
            <p className="mt-1.5 text-sm leading-relaxed text-lane-soft">
              Every Quadpad token opens at <strong className="text-lane">{OPENING_MARKET_CAP} ETH</strong> for the
              whole supply — tick {OPENING_TICK.toLocaleString("en-US")}, the same one every other launch used.
              There is nothing to set here and no argument in <code className="text-lane">launch</code> that could
              set it, which is the only version of that promise worth making.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-signal/20 pt-4">
            <Button onClick={submit} disabled={Boolean(blocker) || isPending || receipt.isLoading}>
              {isPending ? "Confirm in wallet…" : receipt.isLoading ? "Launching…" : "Launch"}
            </Button>
            {blocker && <span className="micro text-lane-soft">{blocker}</span>}
          </div>

          {writeError && (
            <p className="border-2 border-rust/60 bg-rust/10 px-3 py-2 text-sm text-lane">
              {writeError.message.split("\n")[0]}
            </p>
          )}
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel label="What gets posted">
          <div className="flex items-start gap-3">
            <TokenImage uri={draft.imageURI} symbol={symbol || "?"} className="size-16 shrink-0" />
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg text-lane">{name || "Untitled"}</h3>
              <span className="micro font-semibold text-signal">${symbol || "TICKER"}</span>
              <p className="mt-1 text-sm text-lane-soft">{draft.blurb || "No description."}</p>
            </div>
          </div>
        </Panel>

        <Panel label="What it costs, and what you get">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="To launch" value="Gas only" hint="no posting fee" />
            <StatTile label="Opens at" value={`${OPENING_MARKET_CAP} ETH`} hint="every launch, the same" />
            <StatTile label="Fee on swaps" value={`${FEE_BPS / 100}%`} hint="both directions" />
            <StatTile label="Your share" value={`${CREATOR_BPS / 100}%`} hint="of every fee" />
          </div>

          <dl className="mt-4 space-y-1.5 border-t border-signal/20 pt-3">
            {[
              ["Supply", "1,000,000,000"],
              ["Opens at", `${OPENING_MARKET_CAP} ETH`],
              ["Tick range", `${TICK_LOWER.toLocaleString("en-US")} … ${OPENING_TICK.toLocaleString("en-US")}`],
              ["Tick spacing", String(LAUNCH_TICK_SPACING)],
              ["Pool fee", "0 — the 4% is the only fee"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-sm">
                <dt className="text-lane-faint">{label}</dt>
                <dd className="font-semibold text-lane">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="micro mt-4 leading-relaxed text-lane-faint">
            The supply is minted straight to the locker and goes from there into the pool. It never passes through your
            wallet or the factory, so there is no moment at which anybody holds anything to hold back.
          </p>
        </Panel>
      </div>
    </div>
  );
}
