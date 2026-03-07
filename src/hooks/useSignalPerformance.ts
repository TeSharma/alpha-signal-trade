import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PerformanceStats {
  total: number;
  wins: number;
  losses: number;
  open: number;
  expired: number;
  winRate: number;
  avgPnl: number;
  avgRR: number;
  bestStrategy: string | null;
  strategyBreakdown: Array<{
    strategy: string;
    total: number;
    wins: number;
    winRate: number;
    avgPnl: number;
  }>;
}

export function useSignalPerformance() {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPerformance = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from('signal_performance' as any)
        .select('*') as any);

      if (error) throw error;
      if (!data || data.length === 0) {
        setStats({ total: 0, wins: 0, losses: 0, open: 0, expired: 0, winRate: 0, avgPnl: 0, avgRR: 0, bestStrategy: null, strategyBreakdown: [] });
        setIsLoading(false);
        return;
      }

      const rows = data as any[];
      const wins = rows.filter(r => r.result === 'win').length;
      const losses = rows.filter(r => r.result === 'loss').length;
      const open = rows.filter(r => r.result === 'open').length;
      const expired = rows.filter(r => r.result === 'expired').length;
      const decided = wins + losses;
      const winRate = decided > 0 ? (wins / decided) * 100 : 0;
      const closedRows = rows.filter(r => r.result === 'win' || r.result === 'loss');
      const avgPnl = closedRows.length > 0 ? closedRows.reduce((sum: number, r: any) => sum + (r.pnl_percent || 0), 0) / closedRows.length : 0;

      // Strategy breakdown
      const stratMap = new Map<string, { total: number; wins: number; pnlSum: number }>();
      for (const r of rows) {
        const s = r.strategy || 'Unknown';
        const entry = stratMap.get(s) || { total: 0, wins: 0, pnlSum: 0 };
        entry.total++;
        if (r.result === 'win') entry.wins++;
        if (r.result === 'win' || r.result === 'loss') entry.pnlSum += r.pnl_percent || 0;
        stratMap.set(s, entry);
      }

      const strategyBreakdown = Array.from(stratMap.entries()).map(([strategy, v]) => ({
        strategy,
        total: v.total,
        wins: v.wins,
        winRate: v.total > 0 ? (v.wins / v.total) * 100 : 0,
        avgPnl: v.total > 0 ? v.pnlSum / v.total : 0,
      })).sort((a, b) => b.winRate - a.winRate);

      const bestStrategy = strategyBreakdown.length > 0 ? strategyBreakdown[0].strategy : null;

      setStats({ total: rows.length, wins, losses, open, expired, winRate, avgPnl, avgRR: 0, bestStrategy, strategyBreakdown });
    } catch (err) {
      console.error('Failed to fetch signal performance:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  return { stats, isLoading, refresh: fetchPerformance };
}
