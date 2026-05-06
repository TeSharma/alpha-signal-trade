import { useMemo } from 'react';
import { useMarketData } from './useMarketData';

/** Subscribe to live price for a single pair. Returns null until the
 *  market data layer has populated a quote for that pair. */
export const useLivePrice = (pair: string | undefined): number | null => {
  const { prices } = useMarketData('demo');
  return useMemo(() => {
    if (!pair) return null;
    const p = prices[pair]?.price;
    return typeof p === 'number' && p > 0 ? p : null;
  }, [pair, prices]);
};
