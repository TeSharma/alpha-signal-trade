// Utilities for interacting with TronLink and TronWeb
// We rely on the injected window.tronWeb instance from the TronLink extension.

// Helper: wait until TronLink injects tronWeb and it's ready
const waitForTronReady = async (timeoutMs = 15000): Promise<any> => {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      const tw = (window as any).tronWeb;
      const tl = (window as any).tronLink;

      if (tw && tw.ready) {
        return resolve(tw);
      }

      // If tronLink is present but not connected yet, request accounts once
      if (tl && typeof tl.request === 'function') {
        try {
          // Some TronLink versions require explicit account request
          await tl.request({ method: 'tron_requestAccounts' });
        } catch (e) {
          // ignore user rejection here and keep polling
        }
      }

      if (Date.now() - start > timeoutMs) {
        return reject(new Error('Timed out waiting for TronLink. Please open TronLink and try again.'));
      }
      setTimeout(tick, 250);
    };
    tick();
  });
};

export const connectTronWallet = async () => {
  const tl = (window as any).tronLink;
  const tw = (window as any).tronWeb;

  if (!tl && !tw) {
    throw new Error('TronLink is not installed. Please install TronLink to continue.');
  }

  try {
    // Prefer the official request flow when available
    if (tl && typeof tl.request === 'function') {
      try {
        await tl.request({ method: 'tron_requestAccounts' });
      } catch (err: any) {
        if (err?.code === 4001) {
          // User rejected
          throw new Error('Please approve the connection request in TronLink');
        }
        // fallback to waiting below
      }
    }

    const tronWeb = await waitForTronReady();
    const address = tronWeb?.defaultAddress?.base58;
    if (!address) {
      throw new Error('No Tron account found. Please unlock TronLink.');
    }

    return {
      address,
      isConnected: true,
    };
  } catch (error) {
    console.error('Error connecting to Tron wallet:', error);
    throw error;
  }
};

export const getTronWebClient = (): any => {
  const tw = (window as any).tronWeb;
  if (!tw) throw new Error('TronWeb is not available. Please install/open TronLink.');
  return tw;
};

export const getTronBalance = async (address: string) => {
  try {
    const tw = getTronWebClient();
    const balance = await tw.trx.getBalance(address);
    return tw.fromSun(balance);
  } catch (error) {
    console.error('Error getting TRX balance:', error);
    throw error;
  }
};

export const getUSDTBalance = async (address: string) => {
  try {
    const tw = getTronWebClient();
    // USDT TRC-20 contract address on Tron mainnet
    const usdtContract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const contract = await tw.contract().at(usdtContract);
    const balance = await contract.balanceOf(address).call();
    // USDT has 6 decimals
    return parseFloat(balance.toString()) / 1_000_000;
  } catch (error) {
    console.error('Error getting USDT balance:', error);
    throw error;
  }
};

export const isValidTronAddress = (address: string): boolean => {
  try {
    const tw = getTronWebClient();
    return tw.isAddress(address);
  } catch {
    return false;
  }
};

export const getTronAccountInfo = async (address: string) => {
  try {
    const tw = getTronWebClient();
    const account = await tw.trx.getAccount(address);
    return account;
  } catch (error) {
    console.error('Error getting Tron account info:', error);
    throw error;
  }
};

// Event listeners for account changes
export const setupTronEventListeners = (onAccountChange: (address: string | null) => void) => {
  const tl = (window as any).tronLink;

  // Prefer native events when available
  let offFns: Array<() => void> = [];
  if (tl && typeof tl.on === 'function') {
    const onAccountsChanged = (accs: string[] | string) => {
      const addr = Array.isArray(accs) ? accs[0] : accs;
      onAccountChange(addr || null);
    };
    const onChainChanged = () => {
      const tw = (window as any).tronWeb;
      const addr = tw?.defaultAddress?.base58 || null;
      onAccountChange(addr);
    };
    tl.on('accountsChanged', onAccountsChanged);
    tl.on('chainChanged', onChainChanged);
    offFns.push(() => tl.removeListener?.('accountsChanged', onAccountsChanged));
    offFns.push(() => tl.removeListener?.('chainChanged', onChainChanged));
  }

  // Fallback polling in case events are not supported
  let lastAddress = (window as any).tronWeb?.defaultAddress?.base58;
  const interval = window.setInterval(() => {
    const currentAddress = (window as any).tronWeb?.defaultAddress?.base58;
    if (currentAddress !== lastAddress) {
      lastAddress = currentAddress;
      onAccountChange(currentAddress || null);
    }
  }, 1000);

  return () => {
    offFns.forEach((off) => off());
    clearInterval(interval);
  };
};

// Types for TronLink
declare global {
  interface Window {
    tronWeb: any;
    tronLink?: any;
  }
}
