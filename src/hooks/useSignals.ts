import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SignalObject } from '@/types/signal';
import { isExpired } from '@/types/signal';
import { useToast } from '@/components/ui/use-toast';

export function useSignals() {
  const [signals, setSignals] = useState<SignalObject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const fetchSignals = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from('trading_signals')
        .select('*') as any)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const mapped: SignalObject[] = (data || []).map((row: any) => {
        if (row.signal_data && typeof row.signal_data === 'object' && row.signal_data.id) {
          return { ...row.signal_data, status: row.status, created_at: row.created_at } as SignalObject;
        }
        return {
          id: row.id,
          market: row.market || 'CRYPTO',
          pair: row.pair,
          direction: row.direction === 'buy' || row.direction === 'LONG' ? 'LONG' : 'SHORT',
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

      // Filter out expired signals client-side
      const activeSignals = mapped.filter(s => !isExpired(s));
      setSignals(activeSignals);

      console.info('[Signals] Fetched %d signals, %d active', mapped.length, activeSignals.length);
    } catch (err: any) {
      console.error('Failed to fetch signals:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateSignal = useCallback(async (pair: string, timeframe = '15m') => {
    setIsGenerating(true);
    console.info('[Signals] Generating signal for %s @ %s', pair, timeframe);
    try {
      const { data, error } = await supabase.functions.invoke('generate-signal', {
        body: { pair, timeframe }
      });

      if (error) {
        if (error.message?.includes('429')) {
          toast({ title: 'Rate Limited', description: 'Too many requests. Try again shortly.', variant: 'destructive' });
          return null;
        }
        if (error.message?.includes('402')) {
          toast({ title: 'Credits Exhausted', description: 'AI credits used up. Add more in workspace settings.', variant: 'destructive' });
          return null;
        }
        
        console.error('Edge function error:', error);
        toast({ title: 'Error', description: error.message || 'Signal generation failed', variant: 'destructive' });
        return null;
      }

      if (!data) {
        toast({ title: 'Error', description: 'No data returned from signal service', variant: 'destructive' });
        return null;
      }

      if (data.error) {
        toast({ title: 'Signal Error', description: data.error, variant: 'destructive' });
        return null;
      }

      if (data.filtered) {
        toast({ title: 'Low Confidence', description: `Signal for ${pair} below threshold (${(data.confidence * 100).toFixed(0)}%). Not published.` });
        return null;
      }

      const signal = data as SignalObject;
      console.info('[Signals] Generated: %s %s — %d%% confidence', signal.direction, pair, (signal.confidence * 100).toFixed(0));
      toast({ title: 'Signal Generated', description: `${signal.direction} ${pair} — ${(signal.confidence * 100).toFixed(0)}% confidence` });

      // Add to local state immediately so it appears without waiting for DB sync
      setSignals(prev => {
        const exists = prev.some(s => s.id === signal.id);
        if (exists) return prev;
        return [signal, ...prev];
      });

      // Also refresh from DB in background
      fetchSignals();
      return signal;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.error('Generate signal error:', errMsg, err);
      toast({ title: 'Error', description: `Signal generation failed: ${errMsg}`, variant: 'destructive' });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [fetchSignals, toast]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  useEffect(() => {
    const channel = supabase
      .channel('trading_signals_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trading_signals' }, () => {
        fetchSignals();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchSignals]);

  return { signals, isLoading, isGenerating, generateSignal, refreshSignals: fetchSignals };
}
