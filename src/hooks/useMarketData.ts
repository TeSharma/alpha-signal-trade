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
  source: 'binance' | 'twelvedata' | 'oracle';
  updatedAt?: number;
}

// Binance symbol mapping
const BINANCE_SYMBOL_MAP: Record<string, string> = {
  'BTC/USD': 'btcusdt',
  'ETH/USD': 'ethusdt',
  'POL/USD': 'maticusdt',
};

const BINANCE_TO_PAIR: Record<string, string> = {};
for (const [pair, sym] of Object.entries(BINANCE_SYMBOL_MAP)) {
  BINANCE_TO_PAIR[sym.toUpperCase()] = pair;
}

const CRYPTO_PAIRS = [...V1_TRADING_MARKETS];
const FOREX_PAIRS = [...V1_SIGNAL_MARKETS];

export const useMarketData = (_accountMode: 'demo' | 'live' = 'demo') => {
  const [prices, setPrices] = useState<Record<string, MarketPrice>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectAttemptsRef = useRef(0);
  const openPricesRef = useRef<Record<string, number>>({});
  const forexBasePricesRef = useRef<Record<string, number>>({});

  // --- Binance 24hr initial fetch for open prices ---
  const fetch24hrData = useCallback(async () => {
    try {
      const symbols = CRYPTO_PAIRS.map(p => BINANCE_SYMBOL_MAP[p]).filter(Boolean);
      const results = await Promise.all(
        symbols.map(async (sym) => {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym.toUpperCase()}`);
          if (!res.ok) return null;
          return res.json();
        })
      );

      const newPrices: Record<string, MarketPrice> = {};
      results.forEach((data) => {
        if (!data) return;
        const pair = BINANCE_TO_PAIR[data.symbol];
        if (!pair) return;
        const price = parseFloat(data.lastPrice);
        const openPrice = parseFloat(data.openPrice);
        openPricesRef.current[pair] = openPrice;
        const change = price - openPrice;
        const changePercent = openPrice > 0 ? (change / openPrice) * 100 : 0;
        const meta = MARKET_METADATA[pair];
        const spreadPips = price * 0.0001;

        newPrices[pair] = {
          pair,
          price: Number(price.toFixed(meta?.decimals ?? 2)),
          change: Number(change.toFixed(meta?.decimals ?? 2)),
          changePercent: Number(changePercent.toFixed(2)),
          volume: formatVolume(parseFloat(data.quoteVolume)),
          bid: Number((price - spreadPips / 2).toFixed(meta?.decimals ?? 2)),
          ask: Number((price + spreadPips / 2).toFixed(meta?.decimals ?? 2)),
          spread: Number(spreadPips.toFixed(meta?.decimals ?? 2)),
          high24h: Number(parseFloat(data.highPrice).toFixed(meta?.decimals ?? 2)),
          low24h: Number(parseFloat(data.lowPrice).toFixed(meta?.decimals ?? 2)),
          lastUpdate: new Date(),
          isOraclePrice: false,
          source: 'binance',
        };
      });

      setPrices(prev => ({ ...prev, ...newPrices }));
    } catch (err) {
      console.error('[useMarketData] 24hr fetch error:', err);
    }
  }, []);

  // --- Binance WebSocket ---
  const connectWebSocket = useCallback(() => {
    const streams = CRYPTO_PAIRS
      .map(p => BINANCE_SYMBOL_MAP[p])
      .filter(Boolean)
      .map(s => `${s}@miniTicker`)
      .join('/');

    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      console.log('[useMarketData] Binance WS connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const data = msg.data;
        if (!data?.s) return;

        const pair = BINANCE_TO_PAIR[data.s];
        if (!pair) return;

        const price = parseFloat(data.c); // close price
        const high24h = parseFloat(data.h);
        const low24h = parseFloat(data.l);
        const volume = parseFloat(data.q); // quote volume
        const openPrice = openPricesRef.current[pair] || parseFloat(data.o);
        const change = price - openPrice;
        const changePercent = openPrice > 0 ? (change / openPrice) * 100 : 0;
        const meta = MARKET_METADATA[pair];
        const dec = meta?.decimals ?? 2;
        const spreadPips = price * 0.0001;

        setPrices(prev => ({
          ...prev,
          [pair]: {
            pair,
            price: Number(price.toFixed(dec)),
            change: Number(change.toFixed(dec)),
            changePercent: Number(changePercent.toFixed(2)),
            volume: formatVolume(volume),
            bid: Number((price - spreadPips / 2).toFixed(dec)),
            ask: Number((price + spreadPips / 2).toFixed(dec)),
            spread: Number(spreadPips.toFixed(dec)),
            high24h: Number(high24h.toFixed(dec)),
            low24h: Number(low24h.toFixed(dec)),
            lastUpdate: new Date(),
            isOraclePrice: false,
            source: 'binance',
          },
        }));
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('[useMarketData] Binance WS disconnected');
      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
    };

    ws.onerror = (err) => {
      console.error('[useMarketData] Binance WS error:', err);
      ws.close();
    };
  }, []);

  // --- Forex REST polling via edge function ---
  const fetchForexPrices = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('forex-prices', {
        method: 'GET',
      });

      if (error) {
        console.error('[useMarketData] Forex fetch error:', error);
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
      }
    } catch (err) {
      console.error('[useMarketData] Forex polling error:', err);
    }
  }, []);

  // --- Initialize ---
  useEffect(() => {
    setIsLoading(true);

    // Fetch initial 24hr data, then connect WS
    fetch24hrData().then(() => {
      connectWebSocket();
      setIsLoading(false);
    });

    // Forex polling
    fetchForexPrices();
    const forexInterval = setInterval(fetchForexPrices, 60000);

    return () => {
      clearInterval(forexInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [fetch24hrData, connectWebSocket, fetchForexPrices]);

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
