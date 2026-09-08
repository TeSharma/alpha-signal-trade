import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { V1_SIGNAL_MARKETS, V1_TRADING_MARKETS, MARKET_METADATA, getMarketsForMode } from '@/config/markets';
import { useOraclePrice } from '@/hooks/useOraclePrice';

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
  source: 'binance' | 'coingecko' | 'twelvedata' | 'exchangerate.host' | 'oracle';
  updatedAt?: number;
}

const CRYPTO_PAIRS = [...V1_TRADING_MARKETS];
const FOREX_PAIRS = [...V1_SIGNAL_MARKETS];
const CRYPTO_REFRESH_INTERVAL = 10000;
const FOREX_REFRESH_INTERVAL = 60000;

const ORACLE_REFRESH_INTERVAL = 30000;
const ORACLE_MAX_AGE_SECONDS = 120; // must match TradingPlatformV2 priceTimeout

export const useMarketData = (_accountMode: 'demo' | 'live' = 'demo') => {
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const openPricesRef = useRef<Record<string, number>>({});
  const forexBasePricesRef = useRef<Record<string, number>>({});
  const cryptoConnectedRef = useRef(false);
  const forexConnectedRef = useRef(false);
  const [oracleAvailable, setOracleAvailable] = useState(false);
  const { fetchMultiplePrices, prices: oraclePrices } = useOraclePrice(_accountMode);


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
        const change = parseFloat(market.priceChange);
        const changePercent = parseFloat(market.priceChangePercent);

        if (!Number.isFinite(price) || price <= 0) {
          continue;
        }

        const openPrice = price - (Number.isFinite(change) ? change : 0);
        openPricesRef.current[pair] = openPrice;
        const meta = MARKET_METADATA[pair];
        const dec = meta?.decimals ?? 2;
        const spread = price * 0.0001;
        const src: 'binance' | 'coingecko' = market.source === 'coingecko' ? 'coingecko' : 'binance';

        newPrices[pair] = {
          pair,
          price: Number(price.toFixed(dec)),
          change: Number((Number.isFinite(change) ? change : 0).toFixed(dec)),
          changePercent: Number((Number.isFinite(changePercent) ? changePercent : 0).toFixed(2)),
          volume: formatVolume(parseFloat(market.volume)),
          bid: Number((price - spread / 2).toFixed(dec)),
          ask: Number((price + spread / 2).toFixed(dec)),
          spread: Number(spread.toFixed(dec)),
          high24h: Number(parseFloat(market.highPrice).toFixed(dec)),
          low24h: Number(parseFloat(market.lowPrice).toFixed(dec)),
          lastUpdate: new Date(),
          isOraclePrice: false,
          source: src,
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
        const responseSource: 'twelvedata' | 'exchangerate.host' =
          data.source === 'exchangerate.host' ? 'exchangerate.host' : 'twelvedata';
        const forexPrices: Record<string, MarketPrice> = {};
        for (const pair of FOREX_PAIRS) {
          const price = data.prices[pair];
          if (!price || price <= 0) continue;

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
            source: responseSource,
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

  // --- Live mode: overlay on-chain Chainlink oracle prices ---
  useEffect(() => {
    if (_accountMode !== 'live') {
      setOracleAvailable(false);
      return;
    }
    const livePairs = getMarketsForMode('live');
    const poll = () => { void fetchMultiplePrices(livePairs); };
    poll();
    const id = setInterval(poll, ORACLE_REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [_accountMode, fetchMultiplePrices]);

  // Merge oracle readings over the off-chain feed in live mode
  const effectivePrices = (() => {
    if (_accountMode !== 'live') return prices;
    const now = Math.floor(Date.now() / 1000);
    const merged: Record<string, MarketPrice> = { ...prices };
    for (const [pair, data] of Object.entries(oraclePrices)) {
      const base = merged[pair];
      if (!base || !data?.isValid) continue;
      const fresh = now - data.timestamp <= ORACLE_MAX_AGE_SECONDS;
      if (!fresh) continue;
      const dec = MARKET_METADATA[pair]?.decimals ?? 2;
      const price = Number(Number(data.price).toFixed(dec));
      if (!Number.isFinite(price) || price <= 0) continue;
      const spread = base.spread || price * 0.0001;
      merged[pair] = {
        ...base,
        price,
        bid: Number((price - spread / 2).toFixed(dec)),
        ask: Number((price + spread / 2).toFixed(dec)),
        isOraclePrice: true,
        source: 'oracle',
        updatedAt: data.timestamp,
      };
    }
    return merged;
  })();

  useEffect(() => {
    if (_accountMode !== 'live') return;
    setOracleAvailable(Object.values(effectivePrices).some(p => p.isOraclePrice));
  }, [_accountMode, effectivePrices]);

  const updatePrices = useCallback(async () => {
    await fetch24hrData();
    await fetchForexPrices();
  }, [fetch24hrData, fetchForexPrices]);

  const getPrice = (pair: string): MarketPrice | null => effectivePrices[pair] || null;
  const getCurrentPrice = (pair: string): number => effectivePrices[pair]?.price || 0;
  const getBidPrice = (pair: string): number => effectivePrices[pair]?.bid || getCurrentPrice(pair);
  const getAskPrice = (pair: string): number => effectivePrices[pair]?.ask || getCurrentPrice(pair);

  return {
    prices: Object.values(effectivePrices),
    pricesMap: effectivePrices,
    isConnected,
    isLoading,
    oracleAvailable,
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
