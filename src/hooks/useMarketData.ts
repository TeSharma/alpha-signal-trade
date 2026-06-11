import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { V1_SIGNAL_MARKETS, V1_TRADING_MARKETS, MARKET_METADATA } from '@/config/markets';

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
  source: 'binance' | 'twelvedata' | 'exchangerate.host' | 'oracle';
  updatedAt?: number;
}

const CRYPTO_PAIRS = [...V1_TRADING_MARKETS];
const FOREX_PAIRS = [...V1_SIGNAL_MARKETS];
const CRYPTO_REFRESH_INTERVAL = 10000;
const FOREX_REFRESH_INTERVAL = 60000;

export const useMarketData = (_accountMode: 'demo' | 'live' = 'demo') => {
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const openPricesRef = useRef<Record<string, number>>({});
  const forexBasePricesRef = useRef<Record<string, number>>({});
  const cryptoConnectedRef = useRef(false);
  const forexConnectedRef = useRef(false);

  const setConnectionState = useCallback((source: 'crypto' | 'forex', connected: boolean) => {
    if (source === 'crypto') {
      cryptoConnectedRef.current = connected;
    } else {
      forexConnectedRef.current = connected;
    }

    setIsConnected(cryptoConnectedRef.current || forexConnectedRef.current);
  }, []);

  // --- Crypto polling via edge function ---
  const fetch24hrData = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('crypto-prices', {
        method: 'GET',
      });

      if (error) {
        setConnectionState('crypto', false);
        console.error('[useMarketData] Crypto fetch error:', error);
        return;
      }

      const newPrices: Record<string, MarketPrice> = {};
      for (const pair of CRYPTO_PAIRS) {
        const market = data?.prices?.[pair];
        if (!market) continue;

        const price = parseFloat(market.lastPrice);
        const openPrice = parseFloat(market.openPrice);
        const bid = parseFloat(market.bidPrice);
        const ask = parseFloat(market.askPrice);

        if (!Number.isFinite(price) || !Number.isFinite(openPrice) || openPrice <= 0) {
          continue;
        }

        openPricesRef.current[pair] = openPrice;
        const change = price - openPrice;
        const changePercent = openPrice > 0 ? (change / openPrice) * 100 : 0;
        const meta = MARKET_METADATA[pair];
        const dec = meta?.decimals ?? 2;
        const derivedSpread = price * 0.0001;
        const spread = Number.isFinite(ask - bid) && ask >= bid ? ask - bid : derivedSpread;

        newPrices[pair] = {
          pair,
          price: Number(price.toFixed(dec)),
          change: Number(change.toFixed(dec)),
          changePercent: Number(changePercent.toFixed(2)),
          volume: formatVolume(parseFloat(market.quoteVolume)),
          bid: Number((Number.isFinite(bid) ? bid : price - spread / 2).toFixed(dec)),
          ask: Number((Number.isFinite(ask) ? ask : price + spread / 2).toFixed(dec)),
          spread: Number(spread.toFixed(dec)),
          high24h: Number(parseFloat(market.highPrice).toFixed(dec)),
          low24h: Number(parseFloat(market.lowPrice).toFixed(dec)),
          lastUpdate: new Date(),
          isOraclePrice: false,
          source: 'binance',
        };
      }

      setPrices(prev => ({ ...prev, ...newPrices }));
      setConnectionState('crypto', Object.keys(newPrices).length > 0);
    } catch (err) {
      setConnectionState('crypto', false);
      console.error('[useMarketData] 24hr fetch error:', err);
    }
  }, [setConnectionState]);

  // --- Forex REST polling via edge function ---
  const fetchForexPrices = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('forex-prices', {
        method: 'GET',
      });

      if (error) {
        setConnectionState('forex', false);
        console.error('[useMarketData] Forex fetch error:', error);
        return;
      }

      if (data?.marketOpen === false) {
        setConnectionState('forex', false);
        setPrices(prev => {
          const next = { ...prev };
          for (const pair of FOREX_PAIRS) {
            delete next[pair];
          }
          return next;
        });
        return;
      }

      if (data?.prices) {
        const forexPrices: Record<string, MarketPrice> = {};
        for (const pair of FOREX_PAIRS) {
          const price = data.prices[pair];
          if (!price || price <= 0) continue;

          // Store base price for change calculation
          if (!forexBasePricesRef.current[pair]) {
            forexBasePricesRef.current[pair] = price;
          }

          const basePrice = forexBasePricesRef.current[pair];
          const change = price - basePrice;
          const changePercent = basePrice > 0 ? (change / basePrice) * 100 : 0;
          const meta = MARKET_METADATA[pair];
          const dec = meta?.decimals ?? 5;
          const spreadPips = pair.includes('JPY') ? 0.03 : 0.0003;

          forexPrices[pair] = {
            pair,
            price: Number(price.toFixed(dec)),
            change: Number(change.toFixed(dec)),
            changePercent: Number(changePercent.toFixed(2)),
            volume: '—',
            bid: Number((price - spreadPips / 2).toFixed(dec)),
            ask: Number((price + spreadPips / 2).toFixed(dec)),
            spread: Number(spreadPips.toFixed(dec)),
            high24h: Number((price * 1.005).toFixed(dec)),
            low24h: Number((price * 0.995).toFixed(dec)),
            lastUpdate: new Date(),
            isOraclePrice: false,
            source: 'twelvedata',
          };
        }
        setPrices(prev => ({ ...prev, ...forexPrices }));
        setConnectionState('forex', Object.keys(forexPrices).length > 0);
      }
    } catch (err) {
      setConnectionState('forex', false);
      console.error('[useMarketData] Forex polling error:', err);
    }
  }, [setConnectionState]);

  // --- Initialize ---
  useEffect(() => {
    setIsLoading(true);

    Promise.all([fetch24hrData(), fetchForexPrices()]).finally(() => {
      setIsLoading(false);
    });

    const cryptoInterval = setInterval(fetch24hrData, CRYPTO_REFRESH_INTERVAL);
    const forexInterval = setInterval(fetchForexPrices, FOREX_REFRESH_INTERVAL);

    return () => {
      clearInterval(cryptoInterval);
      clearInterval(forexInterval);
    };
  }, [fetch24hrData, fetchForexPrices]);

  const updatePrices = useCallback(async () => {
    await fetch24hrData();
    await fetchForexPrices();
  }, [fetch24hrData, fetchForexPrices]);

  const getPrice = (pair: string): MarketPrice | null => prices[pair] || null;
  const getCurrentPrice = (pair: string): number => prices[pair]?.price || 0;
  const getBidPrice = (pair: string): number => prices[pair]?.bid || getCurrentPrice(pair);
  const getAskPrice = (pair: string): number => prices[pair]?.ask || getCurrentPrice(pair);

  return {
    prices: Object.values(prices),
    pricesMap: prices,
    isConnected,
    isLoading,
    oracleAvailable: false, // Reserved for future oracle overlay
    getPrice,
    getCurrentPrice,
    getBidPrice,
    getAskPrice,
    updatePrices,
  };
};

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
  return vol.toFixed(0);
}
