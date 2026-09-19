"use client";

import { useMemo, useState } from "react";
import { useAccount, useConnection, useReadContract, useSimulateContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatEther, formatUnits, parseEther, parseUnits, type Address } from "viem";

import { Button } from "@/components/ui/Button";
import { clsx } from "@/lib/clsx";
import { explorerTx, ROBINHOOD_CHAIN_ID } from "@/lib/chain";
import {
  CREATOR_BPS,
  DEADLINE_SECONDS,
  FEE_BPS,
  ROUTER_ADDRESS,
  SLIPPAGE_BPS,
  TRADING_IS_OPEN,
  quadRouterAbi,
  quadTokenAbi,
  type Notice,
} from "@/lib/contracts";
import { quadpadPoolKey } from "@/lib/pool";

const BPS = 10_000n;

/** A deadline no quote can fall behind. The real one is set when the swap is sent. */
const QUOTE_DEADLINE = 1n << 40n;

type Side = "buy" | "sell";

/**
 * Buying and selling one token on the board.
 *
 * The quote is a simulation of the exact call that will be sent, with no limit
 * on it — so what it reports is what the pool and the hook between them decide,
 * not this component's arithmetic. The limit is then set from that number and
 * sent with the swap, which is why the two can never disagree: there is no
 * second estimate anywhere in this file.
 *
 * Selling needs an ERC-20 allowance, and until it exists the pool cannot be
 * asked what a sell would fetch. The panel says that rather than guessing.
 */
export function TradePanel({ notice, hook }: { notice: Notice; hook: Address | undefined }) {
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");

  const { address, isConnected } = useAccount();
  const { chainId } = useConnection();
  const wrongChain = isConnected && chainId !== ROBINHOOD_CHAIN_ID;

  const key = useMemo(
    () => (hook ? quadpadPoolKey(notice.token, hook, notice.tickSpacing) : undefined),
    [hook, notice.token, notice.tickSpacing],
  );

  const parsed = useMemo(() => {
    const text = amount.trim();
    if (text === "") return null;
    try {
      const value = side === "buy" ? parseEther(text) : parseUnits(text, 18);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  }, [amount, side]);

  const held = useReadContract({
    address: notice.token,
    abi: quadTokenAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  const allowance = useReadContract({
    address: notice.token,
    abi: quadTokenAbi,
    functionName: "allowance",
    args: address && ROUTER_ADDRESS ? [address, ROUTER_ADDRESS] : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: Boolean(address) && TRADING_IS_OPEN && side === "sell" },
  });

  const approved = (allowance.data as bigint | undefined) ?? 0n;
  const needsApproval = side === "sell" && parsed !== null && approved < parsed;

  const quotable = key !== undefined && parsed !== null && isConnected && !wrongChain && !needsApproval;

  const quote = useSimulateContract({
    address: ROUTER_ADDRESS,
    abi: quadRouterAbi,
    functionName: side === "buy" ? "buy" : "sell",
    args:
      key && parsed !== null
        ? side === "buy"
          ? [key, 0n, QUOTE_DEADLINE]
          : [key, parsed, 0n, QUOTE_DEADLINE]
        : undefined,
    value: side === "buy" && parsed !== null ? parsed : undefined,
    chainId: ROBINHOOD_CHAIN_ID,
    query: { enabled: quotable && TRADING_IS_OPEN },
  });

  const expected = quote.data?.result as bigint | undefined;
  const minimum = expected === undefined ? undefined : (expected * (BPS - SLIPPAGE_BPS)) / BPS;
  const fee = parsed === null ? null : (parsed * BigInt(FEE_BPS)) / BPS;

  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });

  const blocker = !TRADING_IS_OPEN
    ? "There is no router deployed, so nothing here can be traded yet."
    : !isConnected
      ? "Connect a wallet to trade."
      : wrongChain
        ? `Switch to Robinhood Chain (${ROBINHOOD_CHAIN_ID}).`
        : parsed === null
          ? null
          : side === "sell" && parsed > ((held.data as bigint | undefined) ?? 0n)
            ? `You hold ${formatUnits((held.data as bigint | undefined) ?? 0n, 18)} ${notice.symbol}.`
            : null;

  const approve = () => {
    if (!ROUTER_ADDRESS || parsed === null) return;
    reset();
    writeContract({
      address: notice.token,
      abi: quadTokenAbi,
      functionName: "approve",
      chainId: ROBINHOOD_CHAIN_ID,
      args: [ROUTER_ADDRESS, parsed],
    });
  };

  const submit = () => {
    if (!ROUTER_ADDRESS || !key || parsed === null || minimum === undefined) return;

    // Set here rather than at quote time: the swap is refused if it sits in the
    // mempool past this, and a deadline measured from when the page loaded is
    // not a deadline anybody chose.
    const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);

    reset();
    writeContract({
      address: ROUTER_ADDRESS,
      abi: quadRouterAbi,
      chainId: ROBINHOOD_CHAIN_ID,
      ...(side === "buy"
        ? { functionName: "buy" as const, args: [key, minimum, deadline] as const, value: parsed }
        : { functionName: "sell" as const, args: [key, parsed, minimum, deadline] as const }),
    });
  };

  const settled = receipt.isSuccess;
  const busy = isPending || receipt.isLoading;
  const problem = writeError ?? (quotable ? quote.error : null);

  return (
    <div className="border-t border-signal/20 p-3">
      <div className="flex items-center gap-1">
        {(["buy", "sell"] as const).map((option) => (
          <button
            key={option}
            onClick={() => {
              setSide(option);
              setAmount("");
              reset();
            }}
            className={clsx(
              "micro border-2 px-2.5 py-1 font-semibold transition-colors",
              side === option
                ? "border-signal bg-signal text-ink"
                : "border-lane-faint/40 text-lane-soft hover:border-signal hover:text-signal",
            )}
          >
            {option === "buy" ? "Buy" : "Sell"}
          </button>
        ))}

        <span className="micro ml-auto text-lane-faint">
          {side === "buy" ? "pay in ETH" : `you hold ${formatUnits((held.data as bigint | undefined) ?? 0n, 18)}`}
        </span>
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          inputMode="decimal"
          placeholder={side === "buy" ? "0.01" : "1000000"}
          aria-label={side === "buy" ? "ETH to spend" : `${notice.symbol} to sell`}
          className="w-full border-2 border-lane-faint/50 bg-ground px-3 py-2 text-sm text-lane placeholder:text-lane-faint focus:border-signal"
        />
        <Button
          onClick={needsApproval ? approve : submit}
          disabled={Boolean(blocker) || parsed === null || busy || (!needsApproval && minimum === undefined)}
        >
          {busy ? "…" : needsApproval ? "Approve" : side === "buy" ? "Buy" : "Sell"}
        </Button>
      </div>

      <div className="micro mt-2 space-y-1 text-lane-faint">
        {blocker && <p className="text-lane-soft">{blocker}</p>}

        {!blocker && parsed !== null && fee !== null && (
          <p>
            Fee {side === "buy" ? formatEther(fee) : formatUnits(fee, 18)}{" "}
            {side === "buy" ? "ETH" : notice.symbol} — {FEE_BPS / 100}% of it, {CREATOR_BPS / 100}% of that to the
            creator.
          </p>
        )}

        {needsApproval && (
          <p className="text-lane-soft">
            The router moves the token out of your own balance, so it needs an allowance first. Approve, then the quote
            appears.
          </p>
        )}

        {expected !== undefined && minimum !== undefined && (
          <p>
            About {side === "buy" ? `${formatUnits(expected, 18)} ${notice.symbol}` : `${formatEther(expected)} ETH`},
            and the swap reverts below {side === "buy" ? formatUnits(minimum, 18) : formatEther(minimum)}.
          </p>
        )}

        {problem && <p className="font-semibold text-rust">{problem.message.split("\n")[0]}</p>}

        {hash && (
          <p>
            <a
              className="underline decoration-signal/50 underline-offset-4 hover:text-signal"
              href={explorerTx(hash)}
              target="_blank"
              rel="noreferrer"
            >
              {settled ? "Done" : "Sent"} ↗
            </a>{" "}
            {settled && side === "buy" && "— the fee is banked on the hook for the creator to withdraw."}
          </p>
        )}
      </div>
    </div>
  );
}
