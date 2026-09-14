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
 * Privy hooks throw (and log a warning on every render) when PrivyProvider is
 * not mounted, which happens when VITE_PRIVY_APP_ID is not configured. The flag
 * below is a build-time constant, so skipping the hooks entirely keeps hook call
 * order stable while avoiding console noise and re-render churn.
 */
export const PRIVY_ENABLED = Boolean(import.meta.env.VITE_PRIVY_APP_ID);

const EMPTY_WALLETS = [] as ReturnType<typeof useWallets>['wallets'];

export function useSafePrivy(): SafePrivy {
  if (!PRIVY_ENABLED) return PRIVY_UNAVAILABLE;
  try {
    const { ready, authenticated, login } = usePrivy();
    return { ready, authenticated, login: async () => { await login(); }, available: true };
  } catch {
    return PRIVY_UNAVAILABLE;
  }
}

export function useSafePrivyWallets() {
  if (!PRIVY_ENABLED) return EMPTY_WALLETS;
  try {
    return useWallets().wallets;
  } catch {
    return EMPTY_WALLETS;
  }
}
