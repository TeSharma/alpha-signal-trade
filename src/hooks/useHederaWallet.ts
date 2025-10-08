import { useState, useCallback } from 'react';
import { 
  getHederaAccountInfo, 
  getHederaAccountTokens, 
  formatHbarBalance,
  HederaToken 
} from '@/lib/hedera';
import { toast } from 'sonner';

interface HederaWalletState {
  isConnected: boolean;
  accountId: string | null;
  hbarBalance: string | null;
  tokens: HederaToken[];
  isLoading: boolean;
  error: string | null;
}

export const useHederaWallet = () => {
  const [state, setState] = useState<HederaWalletState>({
    isConnected: false,
    accountId: null,
    hbarBalance: null,
    tokens: [],
    isLoading: false,
    error: null,
  });

  // Connect to Hedera account (by entering account ID)
  const connectHederaAccount = useCallback(async (accountId: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch account info to verify it exists
      const accountInfo = await getHederaAccountInfo(accountId);
      const tokens = await getHederaAccountTokens(accountId);

      setState({
        isConnected: true,
        accountId,
        hbarBalance: formatHbarBalance(accountInfo.balance.balance),
        tokens,
        isLoading: false,
        error: null,
      });

      toast.success('Hedera account connected!');
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to connect Hedera account',
      }));
      toast.error(error.message || 'Failed to connect Hedera account');
    }
  }, []);

  // Disconnect account
  const disconnectHederaAccount = useCallback(() => {
    setState({
      isConnected: false,
      accountId: null,
      hbarBalance: null,
      tokens: [],
      isLoading: false,
      error: null,
    });
    toast.info('Hedera account disconnected');
  }, []);

  // Refresh balance and tokens
  const refreshHederaData = useCallback(async () => {
    if (!state.accountId) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const accountInfo = await getHederaAccountInfo(state.accountId);
      const tokens = await getHederaAccountTokens(state.accountId);

      setState(prev => ({
        ...prev,
        hbarBalance: formatHbarBalance(accountInfo.balance.balance),
        tokens,
        isLoading: false,
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));
    }
  }, [state.accountId]);

  return {
    ...state,
    connectHederaAccount,
    disconnectHederaAccount,
    refreshHederaData,
  };
};
