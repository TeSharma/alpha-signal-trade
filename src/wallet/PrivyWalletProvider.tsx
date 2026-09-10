import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

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
 */
export function PrivyWalletProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <MissingPrivyConfig>{children}</MissingPrivyConfig>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email'],
        appearance: { theme: 'light', walletList: ['metamask'] },
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
