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
    if (!window.ethereum) {
      setWalletState(prev => ({ ...prev, error: 'No wallet found' }));
      return;
    }

    try {
      const web3 = getWeb3();
      const accounts = await web3.eth.getAccounts();
      const chainId = await web3.eth.getChainId();

      if (accounts.length > 0) {
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
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
      setWalletState(prev => ({ ...prev, error: 'Failed to check connection' }));
    }
  };

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('Please install MetaMask or another Web3 wallet');
      setWalletState(prev => ({ ...prev, error: 'No wallet found' }));
      return;
    }

    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const isConnected = await connectToBlockchain();
      
      if (isConnected) {
        const web3 = getWeb3();
        const accounts = await web3.eth.getAccounts();
        const chainId = await web3.eth.getChainId();
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
      setWalletState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error.message || 'Connection failed' 
      }));
      toast.error(error.message || 'Failed to connect wallet');
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