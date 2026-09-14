import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import Web3 from 'web3';
import { toast } from 'sonner';
import { useSafePrivy, useSafePrivyWallets } from './safePrivy';
import { connectToBlockchain } from '@/lib/web3';
import { useApp } from '@/contexts/AppContext';
import { getRpcUrlsForChain } from '@/config/contracts';
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

// Remembers an explicit user disconnect so a page reload does not silently
// re-attach the previously approved injected wallet.
const DISCONNECTED_KEY = 'shtrader.wallet.disconnected';

const wasExplicitlyDisconnected = (): boolean => {
  try {
    return localStorage.getItem(DISCONNECTED_KEY) === '1';
  } catch {
    return false;
  }
};

const rememberDisconnect = (value: boolean) => {
  try {
    if (value) localStorage.setItem(DISCONNECTED_KEY, '1');
    else localStorage.removeItem(DISCONNECTED_KEY);
  } catch {
    // storage unavailable — session-only behaviour
  }
};

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
  const { ready: privyReady, authenticated: privyAuthenticated } = useSafePrivy();
  const privyWallets = useSafePrivyWallets();

  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);
  const [source, setSource] = useState<WalletSource>('injected');
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [provider, setProvider] = useState<any | null>(null);
  const signerRef = useRef<any | null>(null);
  const chainIdRef = useRef<number | null>(null);
  const addressRef = useRef<string>('');

  const embeddedWallet = useMemo(
    () => privyWallets.find((w) => w.walletClientType === 'privy') ?? privyWallets[0] ?? null,
    [privyWallets],
  );

  /**
   * Balance is read through the app's own RPC endpoints (with fallbacks) rather
   * than the browser extension's provider, which is frequently rate-limited and
   * used to spam errors + re-renders. Failures stay quiet and simply leave the
   * previous value in place.
   */
  const readBalance = useCallback(
    async (addr: string, chain?: number | null) => {
      if (!addr) return;
      const endpoints = getRpcUrlsForChain(chain ?? chainIdRef.current);
      for (const endpoint of endpoints) {
        try {
          const web3 = new Web3(endpoint);
          const wei = await web3.eth.getBalance(addr);
          const formatted = parseFloat(web3.utils.fromWei(wei, 'ether'));
          setBalance(formatted.toFixed(4));
          updateBalance(formatted);
          return;
        } catch {
          // try the next endpoint
        }
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
      await readBalance(addr, Number(network.chainId));
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
      rememberDisconnect(false);
      await readBalance(accounts[0], detected);
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
    rememberDisconnect(true);
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
    if (address) await readBalance(address, chainId);
  }, [address, chainId, readBalance]);

  // Keep refs in sync so timers/listeners read current values without
  // re-subscribing on every render.
  useEffect(() => {
    chainIdRef.current = chainId;
    addressRef.current = address;
  }, [chainId, address]);

  // Poll the balance on a timer (not on every render) using our own RPC.
  useEffect(() => {
    if (!connected || !address) return;
    const id = setInterval(() => {
      void readBalance(addressRef.current, chainIdRef.current);
    }, 60000);
    return () => clearInterval(id);
  }, [connected, address, readBalance]);

  // Rehydrate an already-approved injected wallet on page load, so a refresh
  // does not drop the session (eth_accounts does not prompt the user).
  useEffect(() => {
    let cancelled = false;
    const rehydrate = async () => {
      if (!window.ethereum) return;
      // Respect an explicit disconnect from a previous session.
      if (wasExplicitlyDisconnected()) return;
      try {
        const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
        if (cancelled || !accounts || accounts.length === 0) return;
        let detected: number | null = null;
        try {
          const chainHex: string = await window.ethereum.request({ method: 'eth_chainId' });
          detected = hexToDec(chainHex);
        } catch {
          console.log('[unified-wallet] could not read chain id on rehydrate');
        }
        if (cancelled) return;
        try {
          const ethersProvider = new ethers.BrowserProvider(window.ethereum);
          signerRef.current = await ethersProvider.getSigner().catch(() => null);
        } catch {
          signerRef.current = null;
        }
        if (cancelled) return;
        setProvider(window.ethereum);
        setAddress(accounts[0]);
        setChainId(detected);
        setSource('injected');
        setConnected(true);
        setWalletConnected(true);
        await readBalance(accounts[0], detected);
      } catch (err) {
        console.log('[unified-wallet] rehydrate skipped:', err);
      }
    };
    rehydrate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (source !== 'injected' || !window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) setDisconnected();
      else {
        setAddress(accounts[0]);
        readBalance(accounts[0], chainIdRef.current);
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


