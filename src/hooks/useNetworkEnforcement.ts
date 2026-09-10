import { useState, useEffect, useCallback } from 'react';
import { getRequiredChainId, getRequiredChainHex, getNetworkParams, getNetworkName, type AccountMode } from '@/config/contracts';
import { useUnifiedWallet } from '@/wallet';

const NETWORK_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  5: 'Goerli Testnet',
  11155111: 'Sepolia Testnet',
  137: 'Polygon Mainnet',
  80001: 'Polygon Mumbai',
  80002: 'Polygon Amoy',
};

export const useNetworkEnforcement = (accountMode: AccountMode = 'demo') => {
  const { chainId, connected, provider, switchNetwork } = useUnifiedWallet();
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const requiredChainId = getRequiredChainId(accountMode);
  const isCorrectNetwork = currentChainId === requiredChainId;
  const networkName = currentChainId ? (NETWORK_NAMES[currentChainId] || `Chain ${currentChainId}`) : 'Unknown';
  const requiredNetworkName = getNetworkName(accountMode);

  // Read chain ID and wallet connection state from the unified wallet
  // (embedded Privy or injected MetaMask). No direct window.ethereum reads.
  const detectNetwork = useCallback(async () => {
    setIsWalletConnected(connected);
    setCurrentChainId(chainId);
  }, [connected, chainId]);

  // Switch to the required network for the current mode
  const switchToRequiredNetwork = useCallback(async () => {
    const targetChainHex = getRequiredChainHex(accountMode);
    const targetParams = getNetworkParams(accountMode);
    const targetChainId = parseInt(targetChainHex, 16);

    try {
      await switchNetwork(targetChainId);
    } catch (err: any) {
      // 4902 = chain not added to wallet (injected wallets only; embedded
      // wallets switch programmatically without this path)
      if (err?.code === 4902 && provider?.request) {
        try {
          await provider.request({
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
  }, [accountMode, requiredNetworkName, provider, switchNetwork]);

  // Backward-compatible alias
  const switchToAmoy = switchToRequiredNetwork;

  useEffect(() => {
    detectNetwork();
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
