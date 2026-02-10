import { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { CONTRACT_ADDRESSES, AMOY_RPC_URL } from '@/config/contracts';

// PriceOracleV2 ABI (uses bytes32 pairId)
const PRICE_ORACLE_V2_ABI = [
  {
    inputs: [{ name: 'pairId', type: 'bytes32' }],
    name: 'getPrice',
    outputs: [
      { name: 'price', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'pairId', type: 'bytes32' }],
    name: 'hasFeed',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'pairId', type: 'bytes32' }],
    name: 'getDecimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  }
];

interface OraclePriceData {
  price: string;
  timestamp: number;
  isValid: boolean;
  decimals: number;
}

interface OraclePrices {
  [pair: string]: OraclePriceData;
}

export const useOraclePrice = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [prices, setPrices] = useState<OraclePrices>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    initializeWeb3();
  }, []);

  const initializeWeb3 = async () => {
    // Use public RPC for read operations to avoid MetaMask provider overload
    const web3Instance = new Web3(AMOY_RPC_URL);
    setWeb3(web3Instance);
    setIsConnected(true);
  };

  const getOracleContract = useCallback(() => {
    if (!web3) return null;

    const oracleAddress = CONTRACT_ADDRESSES.amoy.PriceOracleV2;
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    if (oracleAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      return null;
    }

    return new web3.eth.Contract(PRICE_ORACLE_V2_ABI as any, oracleAddress);
  }, [web3]);

  const fetchPrice = async (pair: string): Promise<OraclePriceData | null> => {
    const contract = getOracleContract();
    if (!contract || !web3) {
      console.warn('Oracle contract not available');
      return null;
    }

    try {
      const pairId = web3.utils.keccak256(pair);
      
      // Check if feed exists
      const hasFeed: boolean = await contract.methods.hasFeed(pairId).call();
      if (!hasFeed) {
        return null;
      }

      const [priceResult, decimals]: [any, any] = await Promise.all([
        contract.methods.getPrice(pairId).call(),
        contract.methods.getDecimals(pairId).call()
      ]);

      const formattedPrice = (Number(priceResult.price) / Math.pow(10, Number(decimals))).toFixed(8);

      return {
        price: formattedPrice,
        timestamp: Number(priceResult.updatedAt),
        isValid: Number(priceResult.price) > 0,
        decimals: Number(decimals)
      };
    } catch (error) {
      console.error(`Error fetching price for ${pair}:`, error);
      return null;
    }
  };

  const fetchMultiplePrices = async (pairs: string[]): Promise<void> => {
    setIsLoading(true);
    try {
      const pricePromises = pairs.map(pair => fetchPrice(pair));
      const results = await Promise.all(pricePromises);

      const newPrices: OraclePrices = {};
      pairs.forEach((pair, index) => {
        if (results[index]) {
          newPrices[pair] = results[index]!;
        }
      });

      setPrices(prev => ({ ...prev, ...newPrices }));
    } catch (error) {
      console.error('Error fetching multiple prices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPrice = (pair: string): OraclePriceData | null => {
    return prices[pair] || null;
  };

  const getCurrentPrice = (pair: string): string => {
    return prices[pair]?.price || '0';
  };

  return {
    web3,
    prices,
    isConnected,
    isLoading,
    fetchPrice,
    fetchMultiplePrices,
    getPrice,
    getCurrentPrice,
  };
};
