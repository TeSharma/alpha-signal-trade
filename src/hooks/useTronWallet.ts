import { useState, useEffect, useCallback } from 'react';
import { connectTronWallet, getTronBalance, getUSDTBalance, setupTronEventListeners } from '@/lib/tronweb';

interface TronWalletState {
  isConnected: boolean;
  address: string | null;
  trxBalance: number;
  usdtBalance: number;
  isConnecting: boolean;
  error: string | null;
}

export const useTronWallet = () => {
  const [walletState, setWalletState] = useState<TronWalletState>({
    isConnected: false,
    address: null,
    trxBalance: 0,
    usdtBalance: 0,
    isConnecting: false,
    error: null
  });

  const checkConnection = useCallback(async () => {
    if (window.tronWeb && window.tronWeb.defaultAddress?.base58) {
      const address = window.tronWeb.defaultAddress.base58;
      try {
        const [trxBalance, usdtBalance] = await Promise.all([
          getTronBalance(address),
          getUSDTBalance(address)
        ]);

        setWalletState(prev => ({
          ...prev,
          isConnected: true,
          address,
          trxBalance: parseFloat(trxBalance),
          usdtBalance,
          error: null
        }));
      } catch (error) {
        console.error('Error checking Tron wallet:', error);
        setWalletState(prev => ({
          ...prev,
          error: 'Failed to get wallet info'
        }));
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const { address } = await connectTronWallet();
      const [trxBalance, usdtBalance] = await Promise.all([
        getTronBalance(address),
        getUSDTBalance(address)
      ]);

      setWalletState({
        isConnected: true,
        address,
        trxBalance: parseFloat(trxBalance),
        usdtBalance,
        isConnecting: false,
        error: null
      });
    } catch (error: any) {
      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Failed to connect wallet'
      }));
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    setWalletState({
      isConnected: false,
      address: null,
      trxBalance: 0,
      usdtBalance: 0,
      isConnecting: false,
      error: null
    });
  }, []);

  const refreshBalances = useCallback(async () => {
    if (walletState.address) {
      try {
        const [trxBalance, usdtBalance] = await Promise.all([
          getTronBalance(walletState.address),
          getUSDTBalance(walletState.address)
        ]);

        setWalletState(prev => ({
          ...prev,
          trxBalance: parseFloat(trxBalance),
          usdtBalance,
          error: null
        }));
      } catch (error: any) {
        setWalletState(prev => ({
          ...prev,
          error: error.message || 'Failed to refresh balances'
        }));
      }
    }
  }, [walletState.address]);

  useEffect(() => {
    checkConnection();

    const cleanup = setupTronEventListeners((address) => {
      if (address) {
        checkConnection();
      } else {
        disconnectWallet();
      }
    });

    return cleanup;
  }, [checkConnection, disconnectWallet]);

  return {
    ...walletState,
    connectWallet,
    disconnectWallet,
    refreshBalances
  };
};