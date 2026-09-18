"use client";

import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi";

import { Button } from "@/components/ui/Button";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

/**
 * Connect, switch, disconnect. Injected wallets only — there is no modal and
 * nothing to sign up for.
 */
export function ConnectControl() {
  const { address, chainId, isConnected } = useConnection();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const injected = connectors[0];

  if (!isConnected) {
    return (
      <Button
        tone="signal"
        disabled={isPending || !injected}
        onClick={() => injected && connect({ connector: injected })}
      >
        {isPending ? "Connecting…" : injected ? "Connect" : "No wallet"}
      </Button>
    );
  }

  if (chainId !== ROBINHOOD_CHAIN_ID) {
    return (
      <Button tone="signal" onClick={() => switchChain({ chainId: ROBINHOOD_CHAIN_ID })}>
        Switch network
      </Button>
    );
  }

  return (
    <Button tone="quiet" onClick={() => disconnect()} title="Disconnect">
      {shortAddress(address) ?? "Connected"}
    </Button>
  );
}
