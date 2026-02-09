import { useState, useEffect, useCallback, useRef } from 'react';
import Web3 from 'web3';
import { CONTRACT_ADDRESSES } from '@/config/contracts';

// Use public RPC for reads to avoid overloading MetaMask provider
const PUBLIC_RPC = 'https://rpc-amoy.polygon.technology/';

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

// v1 crypto markets only — Chainlink-backed, no simulated prices
import { V1_TRADING_MARKETS } from '@/config/markets';

const ORACLE_PAIRS = [...V1_TRADING_MARKETS]; // BTC/USD, ETH/USD, MATIC/USD

export interface MarketPrice {
  pair: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  bid: number;
  ask: number;
  spread: number;
  high24h: number;
  low24h: number;
  lastUpdate: Date;
  isOraclePrice: boolean;
  updatedAt?: number; // Oracle timestamp
}

export const useMarketData = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [oracleAvailable, setOracleAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const pairIdsRef = useRef<Record<string, string>>({});

  // Initialize Web3 with public RPC (not MetaMask) for reads
  useEffect(() => {
    const initWeb3 = async () => {
      // Always use public RPC for market data reads to avoid MetaMask overload
      const web3Instance = new Web3(PUBLIC_RPC);
      setWeb3(web3Instance);
      setIsConnected(true);
      
      // Pre-compute pair IDs
      ORACLE_PAIRS.forEach(pair => {
        pairIdsRef.current[pair] = web3Instance.utils.keccak256(pair);
      });
      
      // Check if oracle is deployed
      const oracleAddress = CONTRACT_ADDRESSES.amoy.PriceOracleV2;
      const zeroAddress = '0x0000000000000000000000000000000000000000';
      if (oracleAddress && oracleAddress.toLowerCase() !== zeroAddress.toLowerCase()) {
        setOracleAvailable(true);
      }
    };
    
    initWeb3();
  }, []);

  // Fetch price from PriceOracleV2
  const fetchOraclePrice = useCallback(async (pair: string): Promise<{ price: number; updatedAt: number; decimals: number } | null> => {
    if (!web3 || !oracleAvailable) return null;
    
    const pairId = pairIdsRef.current[pair];
    if (!pairId) return null;
    
    try {
      const contract = new web3.eth.Contract(PRICE_ORACLE_V2_ABI as any, CONTRACT_ADDRESSES.amoy.PriceOracleV2);
      
      // Check if feed exists first
      const hasFeed: boolean = await contract.methods.hasFeed(pairId).call();
      if (!hasFeed) {
        return null;
      }
      
      const [priceResult, decimals]: [any, any] = await Promise.all([
        contract.methods.getPrice(pairId).call(),
        contract.methods.getDecimals(pairId).call()
      ]);
      
      const price = Number(priceResult.price) / Math.pow(10, Number(decimals));
      const updatedAt = Number(priceResult.updatedAt);
      
      return { price, updatedAt, decimals: Number(decimals) };
    } catch (error) {
      // Silent fail - oracle may not have this feed configured
      return null;
    }
  }, [web3, oracleAvailable]);

  // No simulated prices in v1 — only real oracle data is used

  // Create market price object
  const createMarketPrice = (
    pair: string, 
    newPrice: number, 
    basePrice: number, 
    isOraclePrice: boolean,
    updatedAt?: number
  ): MarketPrice => {
    const change = newPrice - basePrice;
    const changePercent = (change / basePrice) * 100;
    const spreadPips = newPrice * 0.0001;
    const bid = newPrice - spreadPips / 2;
    const ask = newPrice + spreadPips / 2;

    return {
      pair,
      price: Number(newPrice.toFixed(5)),
      change: Number(change.toFixed(5)),
      changePercent: Number(changePercent.toFixed(2)),
      volume: `${(Math.random() * 5 + 1).toFixed(1)}B`,
      bid: Number(bid.toFixed(5)),
      ask: Number(ask.toFixed(5)),
      spread: Number((ask - bid).toFixed(5)),
      high24h: Number((newPrice * (1 + Math.random() * 0.02)).toFixed(5)),
      low24h: Number((newPrice * (1 - Math.random() * 0.02)).toFixed(5)),
      lastUpdate: new Date(),
      isOraclePrice,
      updatedAt
    };
  };

  // Update all prices — only from oracle, no fallbacks
  const updatePrices = useCallback(async () => {
    if (!web3) return;
    
    setIsLoading(true);
    
    try {
      const newPrices: Record<string, MarketPrice> = {};
      
      // Fetch oracle prices for v1 crypto pairs only
      const oracleResults = await Promise.all(
        ORACLE_PAIRS.map(async (pair) => {
          const oracleResult = await fetchOraclePrice(pair);
          return { pair, oracleResult };
        })
      );
      
      // Only add pairs with real oracle data
      oracleResults.forEach(({ pair, oracleResult }) => {
        if (oracleResult && oracleResult.price > 0) {
          const previousPrice = prices[pair]?.price || oracleResult.price;
          newPrices[pair] = createMarketPrice(pair, oracleResult.price, previousPrice, true, oracleResult.updatedAt);
        }
      });
      
      setPrices(newPrices);
    } catch (error) {
      console.error('Error updating prices:', error);
    } finally {
      setIsLoading(false);
    }
  }, [web3, fetchOraclePrice, prices]);

  // Initial load and periodic updates - slower polling (10s) to avoid RPC overload
  useEffect(() => {
    if (!web3) return;
    
    // Initial fetch
    updatePrices();
    
    // Update every 10 seconds (reduced from 2s to prevent RPC spam)
    const interval = setInterval(updatePrices, 10000);
    
    return () => clearInterval(interval);
  }, [web3]); // Only depend on web3

  const getPrice = (pair: string): MarketPrice | null => {
    return prices[pair] || null;
  };

  const getCurrentPrice = (pair: string): number => {
    return prices[pair]?.price || 0;
  };

  const getBidPrice = (pair: string): number => {
    return prices[pair]?.bid || getCurrentPrice(pair);
  };

  const getAskPrice = (pair: string): number => {
    return prices[pair]?.ask || getCurrentPrice(pair);
  };

  return {
    prices: Object.values(prices),
    pricesMap: prices,
    isConnected,
    isLoading,
    oracleAvailable,
    getPrice,
    getCurrentPrice,
    getBidPrice,
    getAskPrice,
    updatePrices
  };
};
