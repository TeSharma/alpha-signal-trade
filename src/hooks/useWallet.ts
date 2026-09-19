import { useCallback } from 'react';
import { useUnifiedWallet } from '@/wallet';

export interface WalletState {
  isConnected: boolean;
  account: string | null;
  chainId: number | null;
  balance: string | null;
  isConnecting: boolean;
  error: string | null;
}

/**
 * Backwards-compatible view of the unified wallet.
 *
 * All wallet behaviour lives in `WalletProvider`, which is embedded-first: the
 * Privy embedded wallet is the default wallet, and MetaMask is opt-in and only
 * engages after the user explicitly chooses it.
 *
 * This hook keeps the legacy shape (`isConnected`, `account`, `connectWallet`,
 * …) so existing components never touch `window.ethereum` directly — that
 * direct access is what used to make MetaMask win over the embedded wallet.
 * The default `connectWallet` action connects the EMBEDDED wallet; MetaMask is
 * available separately as `connectMetaMask` for explicit "Connect MetaMask" UI.
 */
export const useWallet = () => {
  const {
    connected,
    address,
    chainId,
    balance,
    isConnecting,
    error,
    connectEmbedded,
    connectInjected,
    disconnect,
    refreshBalance,
    switchNetwork,
  } = useUnifiedWallet();

  // Default wallet = the Privy embedded wallet for every authenticated user.
  const connectWallet = useCallback(async () => {
    await connectEmbedded();
  }, [connectEmbedded]);

  const disconnectWallet = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const refreshWalletBalance = useCallback(async () => {
    await refreshBalance();
  }, [refreshBalance]);

  const state: WalletState = {
    isConnected: connected,
    account: address ? address : null,
    chainId,
    balance,
    isConnecting,
    error,
  };

  return {
    ...state,
    connectWallet,
    /** Explicit external-wallet path (MetaMask only when the user asks for it). */
    connectMetaMask: connectInjected,
    disconnectWallet,
    refreshBalance: refreshWalletBalance,
    switchNetwork,
  };
};
