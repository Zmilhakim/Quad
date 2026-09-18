import { cookieStorage, createConfig, createStorage, http, injected } from "wagmi";
import { robinhoodChain } from "./chain";

/**
 * Injected-only on purpose: no WalletConnect project id, no third-party modal,
 * nothing to sign up for. MetaMask, Rabby and every other EIP-1193 wallet the
 * browser exposes will connect.
 */
export function getConfig() {
  return createConfig({
    chains: [robinhoodChain],
    connectors: [injected()],
    ssr: true,
    storage: createStorage({ storage: cookieStorage }),
    transports: { [robinhoodChain.id]: http() },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
