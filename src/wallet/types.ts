export type WalletSource = 'embedded' | 'injected';

/**
 * Unified wallet identity. Trading components consume this instead of
 * touching window.ethereum or Privy-specific APIs directly.
 */
export interface UnifiedWallet {
  address: string;
  chainId: number | null;
  /** EIP-1193 compatible provider (Privy embedded or window.ethereum). Null when read-only. */
  provider: any | null;
  /** ethers v6 compatible signer. Null when disconnected or read-only. */
  signer: any | null;
  source: WalletSource;
  connected: boolean;
  isConnecting: boolean;
  error: string | null;
  /** Native balance in POL/MATIC/ETH, formatted string. Null when unknown. */
  balance: string | null;
}

export interface UnifiedWalletActions {
  connectEmbedded: () => Promise<void>;
  connectInjected: () => Promise<void>;
  disconnect: () => Promise<void>;
  switchNetwork: (chainId: number) => Promise<void>;
  refreshBalance: () => Promise<void>;
}

export type UnifiedWalletContextValue = UnifiedWallet & UnifiedWalletActions;

export const UNIFIED_WALLET_DISCONNECTED: UnifiedWallet = {
  address: '',
  chainId: null,
  provider: null,
  signer: null,
  source: 'injected',
  connected: false,
  isConnecting: false,
  error: null,
  balance: null,
};
