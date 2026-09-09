import { useState, useEffect, useCallback } from 'react';
import { connectToBlockchain, getWeb3 } from '@/lib/web3';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';

export interface WalletState {
  isConnected: boolean;
  account: string | null;
  chainId: number | null;
  balance: string | null;
  isConnecting: boolean;
  error: string | null;
}

export const useWallet = () => {
  const { setWalletConnected, updateBalance } = useApp();
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    account: null,
    chainId: null,
    balance: null,
    isConnecting: false,
    error: null,
  });

  // Check if wallet is already connected on component mount
  useEffect(() => {
    checkConnection();
  }, []);

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setWalletState(prev => ({ ...prev, account: accounts[0] }));
          getAccountBalance(accounts[0]);
        }
      };

      const handleChainChanged = (chainId: string) => {
        setWalletState(prev => ({ ...prev, chainId: parseInt(chainId, 16) }));
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const checkConnection = async () => {
    // Wait for wallet providers to load
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      console.log(`Attempt ${attempts + 1}: Checking for wallet...`);
      console.log('window.ethereum available:', !!window.ethereum);
      console.log('window.ethereum.isMetaMask:', window.ethereum?.isMetaMask);
      
      if (window.ethereum) {
        console.log('Ethereum provider found!');
        break;
      }
      
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (!window.ethereum) {
      console.log('No ethereum object found after all attempts');
      setWalletState(prev => ({ 
        ...prev, 
        error: 'Please install MetaMask, Coinbase Wallet, or another Web3 wallet' 
      }));
      return;
    }

    try {
      // Check if MetaMask is connected by requesting accounts
      const accounts = await window.ethereum.request({ 
        method: 'eth_accounts' 
      });

      if (accounts.length > 0) {
        // Use eth_chainId directly (avoids net_version issues)
        let chainId: number | null = null;
        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          chainId = parseInt(chainIdHex, 16);
        } catch {
          console.log('Could not get chain ID');
        }
        const balance = await getAccountBalance(accounts[0]);
        
        setWalletState({
          isConnected: true,
          account: accounts[0],
          chainId,
          balance,
          isConnecting: false,
          error: null,
        });
        setWalletConnected(true);
        console.log('Wallet reconnected:', accounts[0]);
      } else {
        console.log('No accounts found - wallet not connected');
        setWalletState(prev => ({ 
          ...prev, 
          isConnected: false, 
          account: null,
          error: null 
        }));
        setWalletConnected(false);
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      setWalletState(prev => ({ 
        ...prev, 
        isConnected: false,
        error: 'Failed to check connection' 
      }));
      setWalletConnected(false);
    }
  };

  const connectWallet = useCallback(async () => {
    console.log('Connect wallet clicked');
    console.log('window.ethereum available:', !!window.ethereum);
    console.log('window.ethereum object:', window.ethereum);
    
    if (!window.ethereum) {
      console.log('No ethereum provider found');
      toast.error('Please install MetaMask or another Web3 wallet');
      setWalletState(prev => ({ ...prev, error: 'No wallet found' }));
      return;
    }

    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const isConnected = await connectToBlockchain();
      
      if (isConnected) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        // Use eth_chainId directly (avoids net_version issues)
        let chainId: number | null = null;
        try {
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
          chainId = parseInt(chainIdHex, 16);
        } catch {
          console.log('Could not get chain ID');
        }
        const balance = await getAccountBalance(accounts[0]);

        setWalletState({
          isConnected: true,
          account: accounts[0],
          chainId: Number(chainId),
          balance,
          isConnecting: false,
          error: null,
        });

        setWalletConnected(true);
        toast.success('Wallet connected successfully!');
      } else {
        setWalletState(prev => ({ 
          ...prev, 
          isConnecting: false, 
          error: 'Failed to connect wallet' 
        }));
        toast.error('Failed to connect wallet');
      }
    } catch (error: any) {
      const raw = (error?.message || String(error || '')).toLowerCase();
      const causeMsg = (error?.cause?.message || '').toLowerCase();
      const isExtensionAsleep =
        raw.includes('failed to connect to metamask') ||
        raw.includes('extension not found') ||
        causeMsg.includes('extension not found');
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;

      const friendly = isExtensionAsleep
        ? (inIframe
            ? "MetaMask isn't responding inside the preview. Open the published site to connect your wallet."
            : "MetaMask isn't responding. Click the MetaMask icon to unlock it, then try again.")
        : (error.message || 'Failed to connect wallet');

      setWalletState(prev => ({
        ...prev,
        isConnecting: false,
        error: friendly,
      }));
      toast.error(friendly);
    }
  }, [setWalletConnected]);

  const disconnectWallet = useCallback(() => {
    setWalletState({
      isConnected: false,
      account: null,
      chainId: null,
      balance: null,
      isConnecting: false,
      error: null,
    });
    setWalletConnected(false);
    toast.info('Wallet disconnected');
  }, [setWalletConnected]);

  const getAccountBalance = async (account: string): Promise<string> => {
    try {
      const web3 = getWeb3();
      const balanceWei = await web3.eth.getBalance(account);
      const balanceEth = web3.utils.fromWei(balanceWei, 'ether');
      
      // Update app context balance
      updateBalance(parseFloat(balanceEth));
      
      return parseFloat(balanceEth).toFixed(4);
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0';
    }
  };

  const refreshBalance = useCallback(async () => {
    if (walletState.account) {
      const balance = await getAccountBalance(walletState.account);
      setWalletState(prev => ({ ...prev, balance }));
    }
  }, [walletState.account, updateBalance]);

  const switchNetwork = async (chainId: number) => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        toast.error('Network not found in wallet');
      } else {
        toast.error('Failed to switch network');
      }
    }
  };

  return {
    ...walletState,
    connectWallet,
    disconnectWallet,
    refreshBalance,
    switchNetwork,
  };
};