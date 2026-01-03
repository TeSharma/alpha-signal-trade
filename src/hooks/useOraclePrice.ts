import { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { ORACLE_ADDRESS } from './useTokenContracts';

const ORACLE_ABI = [
  {
    inputs: [{ name: 'pair', type: 'string' }],
    name: 'getLatestPrice',
    outputs: [
      { name: 'price', type: 'int256' },
      { name: 'timestamp', type: 'uint256' },
      { name: 'roundId', type: 'uint80' },
      { name: 'isValid', type: 'bool' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'pair', type: 'string' }],
    name: 'getLatestValidPrice',
    outputs: [{ name: 'price', type: 'int256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'pair', type: 'string' }],
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
    if (typeof window.ethereum !== 'undefined') {
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);
      setIsConnected(true);
    } else {
      // Fallback to public RPC for read-only operations
      const web3Instance = new Web3('https://polygon-rpc.com/');
      setWeb3(web3Instance);
      setIsConnected(true);
    }
  };

  const getOracleContract = useCallback(() => {
    if (!web3) return null;

    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const oracleAddress = (ORACLE_ADDRESS as unknown as string).toLowerCase();

    if (oracleAddress === ZERO_ADDRESS) {
      return null; // Oracle not deployed yet
    }

    return new web3.eth.Contract(ORACLE_ABI as any, oracleAddress);
  }, [web3]);

  const fetchPrice = async (pair: string): Promise<OraclePriceData | null> => {
    const contract = getOracleContract();
    if (!contract) {
      console.warn('Oracle contract not deployed yet');
      return null;
    }

    try {
      const result: any = await contract.methods
        .getLatestPrice(pair)
        .call();
      
      const [price, timestamp, , isValid] = result;
      const decimals: any = await contract.methods.getDecimals(pair).call();

      const formattedPrice = (Number(price) / Math.pow(10, Number(decimals))).toFixed(8);

      return {
        price: formattedPrice,
        timestamp: Number(timestamp),
        isValid: Boolean(isValid),
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
