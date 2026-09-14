import { useState, useEffect, useCallback, useRef } from 'react';
import Web3 from 'web3';
import { getContractAddresses, getRpcUrls, type AccountMode } from '@/config/contracts';

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

export const useOraclePrice = (accountMode: AccountMode = 'demo') => {
  const [prices, setPrices] = useState<OraclePrices>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const endpointIndexRef = useRef(0);
  // Web3 instance lives in a ref: rotating the endpoint must not change the
  // identity of the fetch callbacks, otherwise consumers that depend on them
  // re-run their polling effect immediately and spin in a request loop.
  const web3Ref = useRef<Web3 | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    // Use public RPC for read operations to avoid MetaMask provider overload
    endpointIndexRef.current = 0;
    web3Ref.current = new Web3(getRpcUrls(accountMode)[0]);
    setPrices({});
    setIsConnected(true);
  }, [accountMode]);

  // Rotate to the next endpoint when the current one stops answering
  const rotateEndpoint = useCallback(() => {
    const endpoints = getRpcUrls(accountMode);
    if (endpoints.length < 2) return;
    endpointIndexRef.current = (endpointIndexRef.current + 1) % endpoints.length;
    web3Ref.current = new Web3(endpoints[endpointIndexRef.current]);
  }, [accountMode]);

  const getOracleContract = useCallback(() => {
    const web3 = web3Ref.current;
    if (!web3) return null;

    const oracleAddress = getContractAddresses(accountMode).PriceOracleV2;
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    if (!oracleAddress || oracleAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      return null;
    }

    return new web3.eth.Contract(PRICE_ORACLE_V2_ABI as any, oracleAddress);
  }, [accountMode]);

  const fetchPrice = useCallback(async (pair: string): Promise<OraclePriceData | null> => {
    const contract = getOracleContract();
    const web3 = web3Ref.current;
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
  }, [getOracleContract]);

  const fetchMultiplePrices = useCallback(async (pairs: string[]): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
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

      if (pairs.length > 0 && Object.keys(newPrices).length === 0) {
        // Current endpoint answered nothing — switch to the next one for the
        // following poll instead of reporting the oracle as offline.
        rotateEndpoint();
      }

      setPrices(prev => ({ ...prev, ...newPrices }));
    } catch (error) {
      rotateEndpoint();
      console.error('Error fetching multiple prices:', error);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [fetchPrice, rotateEndpoint]);


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
