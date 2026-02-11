import { useState, useEffect, useCallback } from 'react';
import { getRequiredChainId, getRequiredChainHex, getNetworkParams, getNetworkName, type AccountMode } from '@/config/contracts';

const NETWORK_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  5: 'Goerli Testnet',
  11155111: 'Sepolia Testnet',
  137: 'Polygon Mainnet',
  80001: 'Polygon Mumbai',
  80002: 'Polygon Amoy',
};

export const useNetworkEnforcement = (accountMode: AccountMode = 'demo') => {
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const requiredChainId = getRequiredChainId(accountMode);
  const isCorrectNetwork = currentChainId === requiredChainId;
  const networkName = currentChainId ? (NETWORK_NAMES[currentChainId] || `Chain ${currentChainId}`) : 'Unknown';
  const requiredNetworkName = getNetworkName(accountMode);

  // Read chain ID and wallet connection state
  const detectNetwork = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setIsWalletConnected(false);
      setCurrentChainId(null);
      return;
    }

    try {
      const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
      setIsWalletConnected(accounts.length > 0);

      const chainIdHex: string = await window.ethereum.request({ method: 'eth_chainId' });
      setCurrentChainId(parseInt(chainIdHex, 16));
    } catch (err) {
      console.error('Network detection error:', err);
    }
  }, []);

  // Switch to the required network for the current mode
  const switchToRequiredNetwork = useCallback(async () => {
    if (!window.ethereum) return;

    const targetChainHex = getRequiredChainHex(accountMode);
    const targetParams = getNetworkParams(accountMode);

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainHex }],
      });
    } catch (err: any) {
      // 4902 = chain not added to wallet
      if (err.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [targetParams],
          });
        } catch (addErr) {
          console.error(`Failed to add ${requiredNetworkName}:`, addErr);
        }
      } else {
        console.error('Failed to switch network:', err);
      }
    }
  }, [accountMode, requiredNetworkName]);

  // Backward-compatible alias
  const switchToAmoy = switchToRequiredNetwork;

  useEffect(() => {
    detectNetwork();

    if (typeof window !== 'undefined' && window.ethereum) {
      const handleChainChanged = (chainIdHex: string) => {
        setCurrentChainId(parseInt(chainIdHex, 16));
      };
      const handleAccountsChanged = (accounts: string[]) => {
        setIsWalletConnected(accounts.length > 0);
        if (accounts.length > 0) detectNetwork();
      };

      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [detectNetwork]);

  return {
    isCorrectNetwork,
    currentChainId,
    networkName,
    requiredNetworkName,
    isWalletConnected,
    switchToRequiredNetwork,
    switchToAmoy,
  };
};
