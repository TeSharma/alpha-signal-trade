// @ts-ignore - TronWeb types are complex, using any for simplicity
const TronWeb = (window as any).TronWeb || null;

const TRON_FULL_NODE = 'https://api.trongrid.io';
const TRON_SOLIDITY_NODE = 'https://api.trongrid.io';
const TRON_EVENT_SERVER = 'https://api.trongrid.io';

// TronWeb instance for reading data (will be initialized when TronWeb is available)
export let tronWeb: any = null;

// Initialize TronWeb when available
if (typeof window !== 'undefined' && TronWeb) {
  tronWeb = new TronWeb(
    TRON_FULL_NODE,
    TRON_SOLIDITY_NODE,
    TRON_EVENT_SERVER
  );
}

export const connectTronWallet = async () => {
  if (!window.tronWeb) {
    throw new Error('TronLink is not installed. Please install TronLink to continue.');
  }

  try {
    // Check if TronLink is ready
    if (!window.tronWeb.ready) {
      await new Promise(resolve => {
        const checkReady = () => {
          if (window.tronWeb.ready) {
            resolve(true);
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }

    // Request account access
    const address = window.tronWeb.defaultAddress.base58;
    if (!address) {
      throw new Error('No Tron account found. Please unlock TronLink.');
    }

    return {
      address,
      isConnected: true
    };
  } catch (error) {
    console.error('Error connecting to Tron wallet:', error);
    throw error;
  }
};

export const getTronBalance = async (address: string) => {
  try {
    const balance = await tronWeb.trx.getBalance(address);
    return tronWeb.fromSun(balance);
  } catch (error) {
    console.error('Error getting TRX balance:', error);
    throw error;
  }
};

export const getUSDTBalance = async (address: string) => {
  try {
    // USDT TRC-20 contract address on Tron mainnet
    const usdtContract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
    const contract = await tronWeb.contract().at(usdtContract);
    const balance = await contract.balanceOf(address).call();
    // USDT has 6 decimals
    return parseFloat(balance.toString()) / 1000000;
  } catch (error) {
    console.error('Error getting USDT balance:', error);
    throw error;
  }
};

export const isValidTronAddress = (address: string): boolean => {
  return tronWeb.isAddress(address);
};

export const getTronAccountInfo = async (address: string) => {
  try {
    const account = await tronWeb.trx.getAccount(address);
    return account;
  } catch (error) {
    console.error('Error getting Tron account info:', error);
    throw error;
  }
};

// Event listeners for account changes
export const setupTronEventListeners = (onAccountChange: (address: string | null) => void) => {
  if (window.tronWeb) {
    // Check for account changes periodically
    let lastAddress = window.tronWeb.defaultAddress?.base58;
    
    const checkAccountChange = () => {
      const currentAddress = window.tronWeb?.defaultAddress?.base58;
      if (currentAddress !== lastAddress) {
        lastAddress = currentAddress;
        onAccountChange(currentAddress || null);
      }
    };

    const interval = setInterval(checkAccountChange, 1000);
    return () => clearInterval(interval);
  }
  return () => {};
};

// Types for TronLink
declare global {
  interface Window {
    tronWeb: any;
  }
}