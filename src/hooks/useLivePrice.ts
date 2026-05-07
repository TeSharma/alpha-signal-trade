import { useSharedMarketData } from '@/contexts/MarketDataContext';

/** Live price for a single pair. Returns null until populated. */
export const useLivePrice = (pair: string | undefined): number | null => {
  const { pricesMap } = useSharedMarketData();
  if (!pair) return null;
  const p = pricesMap[pair]?.price;
  return typeof p === 'number' && p > 0 ? p : null;
};
