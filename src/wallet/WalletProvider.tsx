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

// Which wallet the user wants to trade with. The Privy embedded wallet is the
// default for everyone; MetaMask is only used after an explicit choice.
const PREFERENCE_KEY = 'shtrader.wallet.preference';
type WalletPreference = 'embedded' | 'injected';

const getStoredPreference = (): WalletPreference => {
  try {
    return localStorage.getItem(PREFERENCE_KEY) === 'injected' ? 'injected' : 'embedded';
  } catch {
    return 'embedded';
  }
};

const storePreference = (value: WalletPreference) => {
  try {
    localStorage.setItem(PREFERENCE_KEY, value);
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
  const [preference, setPreference] = useState<WalletPreference>(() => getStoredPreference());
  const preferenceRef = useRef<WalletPreference>(preference);
  // Set when the user explicitly disconnects, so nothing silently re-attaches
  // for the rest of this page session.
  const userDisconnectedRef = useRef(false);
  const attachingRef = useRef(false);
  // Latches the embedded wallet we already auto-attached (or tried to), so a
  // failing auto-attach cannot retry in a loop on unrelated re-renders.
  const autoAttachAttemptedRef = useRef<string | null>(null);
  const signerRef = useRef<any | null>(null);
  const chainIdRef = useRef<number | null>(null);
  const addressRef = useRef<string>('');

  const embeddedWallet = useMemo(
    () =>
      // Only genuine embedded wallets count. Falling back to `privyWallets[0]`
      // could select an externally-linked wallet (e.g. MetaMask linked inside
      // Privy), which would defeat "the embedded wallet is always the default".
      privyWallets.find(
        (w) => w.walletClientType === 'privy' || (w as any).connectorType === 'embedded',
      ) ?? null,
    [privyWallets],
  );

  /** Persist + apply the user's wallet choice (state, ref and storage). */
  const applyPreference = useCallback((next: WalletPreference) => {
    preferenceRef.current = next;
    storePreference(next);
    // Re-arm the one-shot auto-attach latch: a fresh attempt is legitimate when
    // we (re)turn to the embedded wallet.
    if (next === 'embedded') autoAttachAttemptedRef.current = null;
    setPreference(next);
  }, []);

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

  /**
   * Attaches the Privy embedded wallet as the active trading wallet.
   * `silent` is used for the automatic attach on load/login so routine page
   * views do not raise toasts.
   */
  const attachEmbedded = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (attachingRef.current) return;
      if (!privyReady) {
        if (silent) return;
        toast.error('Wallet service is still loading. Try again in a moment.');
        return;
      }
      if (!privyAuthenticated) {
        const message = 'Sign in to create your embedded wallet first.';
        setError(message);
        if (!silent) toast.error(message);
        return;
      }
      if (!embeddedWallet) {
        const message = 'Embedded wallet is not ready yet. Try again in a moment.';
        setError(message);
        if (!silent) toast.error(message);
        return;
      }

      attachingRef.current = true;
      if (!silent) setIsConnecting(true);
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
        setWalletConnected(true);
        userDisconnectedRef.current = false;
        applyPreference('embedded');
        await readBalance(addr, Number(network.chainId));
        if (!silent) toast.success('Embedded wallet connected');
      } catch (err: any) {
        setError(err?.message || 'Failed to connect embedded wallet');
        if (!silent) toast.error(err?.message || 'Failed to connect embedded wallet');
      } finally {
        attachingRef.current = false;
        setIsConnecting(false);
      }
    },
    [privyReady, privyAuthenticated, embeddedWallet, readBalance, setWalletConnected, applyPreference],
  );

  const connectEmbedded = useCallback(async () => {
    await attachEmbedded();
  }, [attachEmbedded]);

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
      userDisconnectedRef.current = false;
      // Explicit choice: honour MetaMask until the user switches back.
      applyPreference('injected');
      await readBalance(accounts[0], detected);
      toast.success('Wallet connected successfully!');
    } catch (err: any) {
      setIsConnecting(false);
      setError(err?.message || 'Failed to connect wallet');
      toast.error(err?.message || 'Failed to connect wallet');
      // MetaMask is not connected → fall back to the embedded wallet.
      applyPreference('embedded');
    }
  }, [readBalance, setWalletConnected, applyPreference]);

  const disconnect = useCallback(async () => {
    // Detaches the active trading wallet only. Does NOT log out of
    // Privy or Supabase auth.
    if (source === 'injected') {
      // Dropping MetaMask hands the session back to the embedded wallet.
      rememberDisconnect(true);
      applyPreference('embedded');
      setDisconnected();
      toast.info('MetaMask disconnected — using your embedded wallet');
      return;
    }
    // Embedded wallet: clear now and stay disconnected for the rest of this
    // page session. The embedded wallet is restored automatically on reload,
    // so returning users always recover the same wallet.
    userDisconnectedRef.current = true;
    rememberDisconnect(true);
    setDisconnected();
    toast.info('Wallet disconnected');
  }, [source, setDisconnected, applyPreference]);

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

  // Make the Privy embedded wallet the default active wallet. As soon as Privy
  // reports an authenticated user with an embedded wallet it is attached
  // automatically — no click needed. window.ethereum is NEVER attached here, so
  // MetaMask is not prioritised just because it exists.
  useEffect(() => {
    if (preference !== 'embedded') return;
    if (!privyReady || !privyAuthenticated || !embeddedWallet) return;
    if (connected || isConnecting) return;
    if (userDisconnectedRef.current) return;
    // Attach each embedded wallet at most once per page session; explicit user
    // actions (connect/disconnect) re-arm this via applyPreference().
    const key = embeddedWallet.address;
    if (autoAttachAttemptedRef.current === key) return;
    autoAttachAttemptedRef.current = key;
    void attachEmbedded({ silent: true });
  }, [preference, privyReady, privyAuthenticated, embeddedWallet, connected, isConnecting, attachEmbedded]);

  // Rehydrate an already-approved injected wallet on page load, so a refresh
  // does not drop the session (eth_accounts does not prompt the user).
  // MetaMask is opt-in: this only runs after an explicit "Connect MetaMask".
  useEffect(() => {
    let cancelled = false;
    const rehydrate = async () => {
      if (preferenceRef.current !== 'injected') return;
      // Respect an explicit disconnect from a previous session.
      if (wasExplicitlyDisconnected()) return;
      if (!window.ethereum) {
        // No injected provider any more — fall back to the embedded wallet.
        applyPreference('embedded');
        return;
      }
      try {
        const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
        if (cancelled) return;
        if (!accounts || accounts.length === 0) {
          // MetaMask is installed but not connected (locked or not authorised)
          // → fall back to the embedded wallet.
          console.log('[unified-wallet] injected wallet not connected on rehydrate; using embedded');
          applyPreference('embedded');
          return;
        }
        // Read the chain id, retrying once — a null chain id would otherwise
        // look identical to "wrong network" to every network check.
        let detected: number | null = null;
        for (let attempt = 0; attempt < 2 && detected == null; attempt++) {
          try {
            const chainHex: string = await window.ethereum.request({ method: 'eth_chainId' });
            detected = hexToDec(chainHex);
          } catch {
            if (attempt === 0) await new Promise((r) => setTimeout(r, 300));
          }
        }
        if (detected == null) {
          console.warn('[unified-wallet] could not read chain id on rehydrate');
        } else {
          console.log('[unified-wallet] rehydrated on chain', detected);
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
        applyPreference('embedded');
      }
    };
    rehydrate();
    return () => {
      cancelled = true;
    };
  }, [readBalance, setWalletConnected, applyPreference]);

  useEffect(() => {
    if (source !== 'injected' || !window.ethereum) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        // MetaMask was disconnected (or all accounts removed): hand the session
        // back to the embedded wallet instead of leaving the user wallet-less.
        applyPreference('embedded');
        setDisconnected();
      } else {
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
  }, [source, readBalance, setDisconnected, applyPreference]);

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


