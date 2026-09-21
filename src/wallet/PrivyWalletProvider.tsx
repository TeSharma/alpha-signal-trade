import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { polygon } from '@privy-io/chains';
import { PRIVY_APP_ID } from '@/config/privy';

function MissingPrivyConfig({ children }: { children: ReactNode }) {
  if (typeof window !== 'undefined') {
    console.warn(
      '[privy] VITE_PRIVY_APP_ID is not set. Embedded wallets are disabled; ' +
        'MetaMask remains available. Add VITE_PRIVY_APP_ID to .env to enable.',
    );
  }
  return <>{children}</>;
}

/**
 * Privy wrapper. Supabase Auth stays the primary app identity — Privy is
 * used ONLY for non-custodial embedded wallet creation/signing.
 * Only the public client-safe App ID uses VITE_*. No secrets here.
 *
 * `createOnLogin: 'all-users'` guarantees EVERY authenticated user has an
 * embedded EVM wallet: one is created on first login and the SAME wallet is
 * returned on every later login (Privy never issues a second embedded wallet
 * for an existing user), so returning users always recover their wallet.
 */
export function PrivyWalletProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <MissingPrivyConfig>{children}</MissingPrivyConfig>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email'],
        // Embedded wallets start on Polygon; the existing demo/live network
        // enforcement and switchNetwork() still govern any required switching.
        defaultChain: polygon,
        appearance: { theme: 'light', walletList: ['metamask'] },
        embeddedWallets: {
          // Embedded wallet is the default wallet for every authenticated user.
          ethereum: { createOnLogin: 'all-users' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
