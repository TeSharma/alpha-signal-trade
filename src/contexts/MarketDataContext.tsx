import React, { createContext, useContext, ReactNode } from 'react';
import { useMarketData, MarketPrice } from '@/hooks/useMarketData';

interface MarketDataContextValue {
  pricesMap: Record<string, MarketPrice>;
  getCurrentPrice: (pair: string) => number;
  isConnected: boolean;
  isLoading: boolean;
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

export const MarketDataProvider = ({ children }: { children: ReactNode }) => {
  const md = useMarketData('demo');
  return (
    <MarketDataContext.Provider
      value={{
        pricesMap: md.pricesMap,
        getCurrentPrice: md.getCurrentPrice,
        isConnected: md.isConnected,
        isLoading: md.isLoading,
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
};

export const useSharedMarketData = (): MarketDataContextValue => {
  const ctx = useContext(MarketDataContext);
  if (ctx) return ctx;
  // Fallback if provider missing — preserves backwards compatibility.
  const md = useMarketData('demo');
  return {
    pricesMap: md.pricesMap,
    getCurrentPrice: md.getCurrentPrice,
    isConnected: md.isConnected,
    isLoading: md.isLoading,
  };
};
