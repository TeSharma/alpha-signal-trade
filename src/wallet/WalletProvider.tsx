import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { toast } from 'sonner';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { connectToBlockchain } from '@/lib/web3';
import { useApp } from '@/contexts/AppContext';
import {
  UNIFIED_WALLET_DISCONNECTED,
  type UnifiedWallet,
  type UnifiedWalletContextValue,
  type WalletSource,
} from './types';

const hexToDec = (hex: string): number | null => {
  try {
    return parseInt(hex, 16);
  } catch {
    return null;
  }
};

const WalletContext = createContext<UnifiedWalletContextValue | null>(null);

/**
 * Unified wallet provider.
 *
 * Safety constraints honoured:
 * - Supabase Auth remains the app identity. Privy is used ONLY as a
 *   non-custodial embedded signer (plus optional injected MetaMask).
 * - No backend private keys, no key escrow, no custodial signing.
 * - Tron wallet / deposit architecture untouched.
 */
export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setWalletConnected, updateBalance } = useApp();
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const { wallets: privyWallets } = useWallets();

  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);
  const [source, setSource] = useState<WalletSource>('injected');
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [provider, setProvider] = useState<any | null>(null);
  const signerRef = useRef<any | null>(null);

  const embeddedWallet = useMemo(
    () => privyWallets.find((w) => w.walletClientType === 'privy') ?? privyWallets[0] ?? null,
    [privyWallets],
  );

  const readBalance = useCallback(
    async (addr: string, eip1193: any | null) => {
      try {
        if (!eip1193) return;
        const web3 = new Web3(eip1193);
        const wei = await web3.eth.getBalance(addr);
        const formatted = web3.utils.fromWei(wei, 'ether');
        setBalance(parseFloat(formatted).toFixed(4));
        updateBalance(parseFloat(formatted));
      } catch (err) {
        console.error('[unified-wallet] balance read failed:', err);
      }
    },
    [updateBalance],
  );

  const setDisconnected = useCallback(
    (message: string | null = null) => {
      setAddress('');
      setChainId(null);
      setProvider(null);
      signerRef.current = null;
      setConnected(false);
      setIsConnecting(false);
      setBalance(null);
      setError(message);
      setWalletConnected(false);
    },
    [setWalletConnected],
  );

  const connectEmbedded = useCallback(async () => {
    if (!privyReady) {
      toast.error('Wallet service is still loading. Try again in a moment.');
      return;
    }
    if (!privyAuthenticated) {
      const message = 'Sign in to create your embedded wallet first.';
      setError(message);
      toast.error(message);
      return;
    }
    if (!embeddedWallet) {
      const message = 'Embedded wallet is not ready yet. Try again in a moment.';
      setError(message);
      toast.error(message);
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const eip1193 = await embeddedWallet.getEthereumProvider();
      const ethersProvider = new ethers.BrowserProvider(eip1193);
      const signer = await ethersProvider.getSigner();
      const addr = await signer.getAddress();
      const network = await ethersProvider.getNetwork();

      signerRef.current = signer;
      setProvider(eip1193);
      setAddress(addr);
      setChainId(Number(network.chainId));
      setSource('embedded');
      setConnected(true);
      setIsConnecting(false);
      setWalletConnected(true);
      await readBalance(addr, eip1193);
      toast.success('Embedded wallet connected');
    } catch (err: any) {
      setIsConnecting(false);
      setError(err?.message || 'Failed to connect embedded wallet');
      toast.error(err?.message || 'Failed to connect embedded wallet');
    }
  }, [privyReady, privyAuthenticated, embeddedWallet, readBalance, setWalletConnected]);

  const connectInjected = useCallback(async () => {
    if (!window.ethereum) {
      const message = 'Please install MetaMask or another Web3 wallet';
      setError(message);
      toast.error(message);
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const ok = await connectToBlockchain();
      if (!ok) throw new Error('Failed to connect wallet');
      const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) throw new Error('No accounts found');
      let detected: number | null = null;
      try {
        const chainHex: string = await window.ethereum.request({ method: 'eth_chainId' });
        detected = hexToDec(chainHex);
      } catch {
        console.log('[unified-wallet] could not read chain id');
      }
      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await ethersProvider.getSigner().catch(() => null);
      signerRef.current = signer;
      setProvider(window.ethereum);
      setAddress(accounts[0]);
      setChainId(detected);
      setSource('injected');
      setConnected(true);
      setIsConnecting(false);
      setWalletConnected(true);
      await readBalance(accounts[0], window.ethereum);
      toast.success('Wallet connected successfully!');
    } catch (err: any) {
      setIsConnecting(false);
      setError(err?.message || 'Failed to connect wallet');
      toast.error(err?.message || 'Failed to connect wallet');
    }
  }, [readBalance, setWalletConnected]);

  const disconnect = useCallback(async () => {
    // Detaches the active trading wallet only. Does NOT log out of
    // Privy or Supabase auth.
    setDisconnected();
    toast.info('Wallet disconnected');
  }, [setDisconnected]);

  const switchNetwork = useCallback(
    async (targetChainId: number) => {
      const hex = `0x${targetChainId.toString(16)}`;
      try {
        if (source === 'embedded' && provider?.request) {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hex }],
          });
          setChainId(targetChainId);
          return;
        }
        if (window.ethereum) {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hex }],
          });
          setChainId(targetChainId);
        }
      } catch (err: any) {
        if (err?.code === 4902) toast.error('Network not found in wallet');
        else toast.error('Failed to switch network');
        throw err;
      }
    },
    [source, provider],
  );

  const refreshBalance = useCallback(async () => {
    if (address && provider) await readBalance(address, provider);
  }, [address, provider, readBalance]);

  useEffect(() => {
    if (source !== 'injected' || !window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) setDisconnected();
      else {
        setAddress(accounts[0]);
        readBalance(accounts[0], window.ethereum);
      }
    };
    const handleChainChanged = (chainHex: string) => setChainId(hexToDec(chainHex));
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [source, readBalance, setDisconnected]);

  const value = useMemo(
    () => ({
      address,
      chainId,
      provider,
      signer: signerRef.current,
      source,
      connected,
      isConnecting,
      error,
      balance,
      connectEmbedded,
      connectInjected,
      disconnect,
      switchNetwork,
      refreshBalance,
    }),
    [address, chainId, provider, source, connected, isConnecting, error, balance,
      connectEmbedded, connectInjected, disconnect, switchNetwork, refreshBalance],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useUnifiedWallet = (): UnifiedWalletContextValue => {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useUnifiedWallet must be used within a WalletProvider');
  return ctx;
};


