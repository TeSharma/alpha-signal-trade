import { usePrivy, useWallets } from '@privy-io/react-auth';

type SafePrivy = {
  ready: boolean;
  authenticated: boolean;
  login: (() => Promise<void>) | null;
  available: boolean;
};

const PRIVY_UNAVAILABLE: SafePrivy = {
  ready: false,
  authenticated: false,
  login: null,
  available: false,
};

/**
 * Privy hooks throw when PrivyProvider is not mounted (no VITE_PRIVY_APP_ID).
 * These wrappers keep the app rendering with MetaMask-only support instead of
 * crashing the whole tree. Hook call order stays stable — the underlying hook
 * is always invoked.
 */
export function useSafePrivy(): SafePrivy {
  try {
    const { ready, authenticated, login } = usePrivy();
    return { ready, authenticated, login: async () => { await login(); }, available: true };
  } catch {
    return PRIVY_UNAVAILABLE;
  }
}

export function useSafePrivyWallets() {
  try {
    return useWallets().wallets;
  } catch {
    return [] as ReturnType<typeof useWallets>['wallets'];
  }
}
