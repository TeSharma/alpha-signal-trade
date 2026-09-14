import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LiquidityStatus = 'SAFE' | 'LOW' | 'BLOCKED' | 'UNKNOWN';

export interface PlatformLiquidity {
  platformAddress: string;
  /** USDC held by the live trading platform, or null when it could not be read. */
  balance: number | null;
  /** Worst-case payable exposure of all open live positions, in USDC. */
  liability: number;
  available: number | null;
  buffer: number;
  status: LiquidityStatus;
  openLivePositions: number;
  checkedAt: string;
}

/**
 * Read-only platform settlement liquidity, computed server-side so it covers
 * every open live position (not just the signed-in user's).
 */
export const usePlatformLiquidity = (enabled: boolean) => {
  const [data, setData] = useState<PlatformLiquidity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke(
        'platform-liquidity',
      );
      if (fnError) throw fnError;
      setData(result as PlatformLiquidity);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read platform liquidity');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [enabled, refresh]);

  return { data, loading, error, refresh };
};
