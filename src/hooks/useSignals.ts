import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SignalObject } from '@/types/signal';
import { isExpired } from '@/types/signal';

export function useSignals() {
  const [signals, setSignals] = useState<SignalObject[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSignals = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from('trading_signals')
        .select('*') as any)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped: SignalObject[] = (data || []).map((row: any) => {
        if (row.signal_data && typeof row.signal_data === 'object' && row.signal_data.id) {
          return { ...row.signal_data, status: row.status, created_at: row.created_at } as SignalObject;
        }
        return {
          id: row.id,
          market: row.market || 'CRYPTO',
          pair: row.pair,
          direction: row.direction === 'buy' || row.direction === 'long' || row.direction === 'LONG' ? 'LONG' : 'SHORT',
          entry_zone: row.entry_zone || [0, 0],
          stop_loss: row.stop_loss || 0,
          take_profit: row.take_profit || [],
          timeframe: row.timeframe || '15m',
          strategy: row.strategy || row.recommendation || 'Unknown',
          confidence: row.confidence,
          risk: row.risk_data || { rr: 0, risk_level: 'MODERATE' },
          execution: { type: row.execution_type || 'ON_CHAIN', supported: true },
          explanation: row.explanation || [],
          expires_at: row.expires_at ? Math.floor(new Date(row.expires_at).getTime() / 1000) : 0,
          created_at: row.created_at,
          status: row.status,
        } as SignalObject;
      });

      const activeSignals = mapped.filter(s => !isExpired(s));
      setSignals(activeSignals);
      console.info('[Signals] Fetched %d signals, %d active', mapped.length, activeSignals.length);
    } catch (err: any) {
      console.error('Failed to fetch signals:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSignals();
  }, [refreshSignals]);

  useEffect(() => {
    const channel = supabase
      .channel('trading_signals_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_signals' }, () => {
        refreshSignals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refreshSignals]);

  return { signals, isLoading, refreshSignals };
}
