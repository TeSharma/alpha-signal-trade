import { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { ORACLE_ADDRESS } from './useTokenContracts';

// Oracle ABI for price fetching
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
    name: 'getDecimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  }
];

// Supported oracle pairs (match PriceOracle contract)
const ORACLE_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD'];

// Fallback prices when oracle is unavailable
const FALLBACK_PRICES: Record<string, number> = {
  'GBP/JPY': 188.25,
  'EUR/USD': 1.0842,
  'USD/JPY': 149.75,
  'GBP/USD': 1.2567,
  'AUD/USD': 0.6745,
  'USD/CAD': 1.3412,
  'EUR/GBP': 0.8632,
  'CHF/USD': 1.1025,
  'NZD/USD': 0.6234,
  'USD/CHF': 0.9068
};

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
}

export const useMarketData = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [oracleAvailable, setOracleAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize Web3
  useEffect(() => {
    const initWeb3 = async () => {
      let web3Instance: Web3;
      
      if (typeof window.ethereum !== 'undefined') {
        web3Instance = new Web3(window.ethereum);
      } else {
        // Fallback to Polygon Amoy RPC for read-only
        web3Instance = new Web3('https://rpc-amoy.polygon.technology/');
      }
      
      setWeb3(web3Instance);
      setIsConnected(true);
      
      // Check if oracle is deployed (compare as strings)
      const oracleAddress = ORACLE_ADDRESS as string;
      const zeroAddress = '0x0000000000000000000000000000000000000000';
      if (oracleAddress && oracleAddress.toLowerCase() !== zeroAddress.toLowerCase()) {
        setOracleAvailable(true);
      }
    };
    
    initWeb3();
  }, []);

  // Fetch price from oracle
  const fetchOraclePrice = useCallback(async (pair: string): Promise<{ price: number; isValid: boolean } | null> => {
    if (!web3 || !oracleAvailable) return null;
    
    try {
      const contract = new web3.eth.Contract(ORACLE_ABI as any, ORACLE_ADDRESS);
      const result: any = await contract.methods.getLatestPrice(pair).call();
      const decimals: any = await contract.methods.getDecimals(pair).call();
      
      const price = Number(result.price) / Math.pow(10, Number(decimals));
      return { price, isValid: Boolean(result.isValid) };
    } catch (error) {
      console.warn(`Oracle price unavailable for ${pair}:`, error);
      return null;
    }
  }, [web3, oracleAvailable]);

  // Generate simulated price with volatility
  const generateSimulatedPrice = (basePrice: number, currentPrice?: number) => {
    const price = currentPrice || basePrice;
    const volatility = 0.0005;
    const change = (Math.random() - 0.5) * 2 * volatility * price;
    return Math.max(price + change, price * 0.95);
  };

  // Create market price object
  const createMarketPrice = (
    pair: string, 
    newPrice: number, 
    basePrice: number, 
    isOraclePrice: boolean
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
      isOraclePrice
    };
  };

  // Update all prices
  const updatePrices = useCallback(async () => {
    if (!web3) return;
    
    setIsLoading(true);
    
    try {
      const newPrices: Record<string, MarketPrice> = {};
      
      // Fetch oracle prices for supported pairs
      const oraclePricePromises = ORACLE_PAIRS.map(async (pair) => {
        const oracleResult = await fetchOraclePrice(pair);
        return { pair, oracleResult };
      });
      
      const oracleResults = await Promise.all(oraclePricePromises);
      
      // Process all pairs
      Object.keys(FALLBACK_PRICES).forEach((pair) => {
        const basePrice = FALLBACK_PRICES[pair];
        const currentPrice = prices[pair]?.price;
        
        // Check if we have oracle data for this pair
        const oracleData = oracleResults.find(r => r.pair === pair);
        
        if (oracleData?.oracleResult?.isValid && oracleData.oracleResult.price > 0) {
          // Use oracle price with small simulation for spread
          const oraclePrice = oracleData.oracleResult.price;
          newPrices[pair] = createMarketPrice(pair, oraclePrice, basePrice, true);
        } else {
          // Use simulated price
          const simulatedPrice = generateSimulatedPrice(basePrice, currentPrice);
          newPrices[pair] = createMarketPrice(pair, simulatedPrice, basePrice, false);
        }
      });
      
      setPrices(newPrices);
    } catch (error) {
      console.error('Error updating prices:', error);
    } finally {
      setIsLoading(false);
    }
  }, [web3, fetchOraclePrice, prices]);

  // Initial load and periodic updates
  useEffect(() => {
    if (!web3) return;
    
    // Initial fetch
    updatePrices();
    
    // Update every 2 seconds
    const interval = setInterval(updatePrices, 2000);
    
    return () => clearInterval(interval);
  }, [web3]); // Only depend on web3, not updatePrices to avoid infinite loop

  const getPrice = (pair: string): MarketPrice | null => {
    return prices[pair] || null;
  };

  const getCurrentPrice = (pair: string): number => {
    return prices[pair]?.price || FALLBACK_PRICES[pair] || 0;
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
