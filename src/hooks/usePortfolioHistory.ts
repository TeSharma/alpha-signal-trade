import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

interface PortfolioSnapshot {
  timestamp: string;
  equity: number;
  balance: number;
  openPositions: number;
}

interface PortfolioMetrics {
  history: PortfolioSnapshot[];
  maxDrawdown: number;
  maxDrawdownPercent: number;
  peakEquity: number;
  currentEquity: number;
  totalReturn: number;
  totalReturnPercent: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  loading: boolean;
}

type TimeRange = '1d' | '7d' | '30d' | 'all';

export function usePortfolioHistory(accountMode: 'demo' | 'live', timeRange: TimeRange = '7d') {
  const [metrics, setMetrics] = useState<PortfolioMetrics>({
    history: [],
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    peakEquity: 0,
    currentEquity: 0,
    totalReturn: 0,
    totalReturnPercent: 0,
    profitFactor: 0,
    avgWin: 0,
    avgLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    loading: true,
  });

  const calculateMaxDrawdown = (history: PortfolioSnapshot[]): { drawdown: number; percent: number; peak: number } => {
    if (history.length === 0) return { drawdown: 0, percent: 0, peak: 0 };

    let peak = history[0].equity;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const snapshot of history) {
      if (snapshot.equity > peak) {
        peak = snapshot.equity;
      }
      const drawdown = peak - snapshot.equity;
      const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownPercent = drawdownPercent;
      }
    }

    return { drawdown: maxDrawdown, percent: maxDrawdownPercent, peak };
  };

  const calculateTradingMetrics = (trades: Tables<'trades'>[]) => {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnl !== null);
    
    if (closedTrades.length === 0) {
      return {
        profitFactor: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
      };
    }

    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);

    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;
    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
    const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl || 0)) : 0;
    const largestLoss = losingTrades.length > 0 ? Math.abs(Math.min(...losingTrades.map(t => t.pnl || 0))) : 0;

    return {
      profitFactor,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
    };
  };

  const fetchData = async () => {
    try {
      setMetrics(prev => ({ ...prev, loading: true }));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMetrics(prev => ({ ...prev, loading: false }));
        return;
      }

      // Calculate time range filter
      let timeFilter: string | undefined;
      const now = new Date();
      if (timeRange === '1d') {
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      } else if (timeRange === '7d') {
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (timeRange === '30d') {
        timeFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      // Fetch portfolio history
      let historyQuery = supabase
        .from('portfolio_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('account_mode', accountMode)
        .order('created_at', { ascending: true });

      if (timeFilter) {
        historyQuery = historyQuery.gte('created_at', timeFilter);
      }

      const { data: historyData, error: historyError } = await historyQuery;

      if (historyError) throw historyError;

      // Fetch closed trades for metrics
      let tradesQuery = supabase
        .from('trades')
        .select('*')
        .eq('user_id', user.id)
        .eq('account_mode', accountMode)
        .eq('status', 'closed');

      if (timeFilter) {
        tradesQuery = tradesQuery.gte('closed_at', timeFilter);
      }

      const { data: tradesData, error: tradesError } = await tradesQuery;

      if (tradesError) throw tradesError;

      // Transform history data
      const history: PortfolioSnapshot[] = (historyData || []).map(h => ({
        timestamp: h.created_at || '',
        equity: Number(h.equity),
        balance: Number(h.balance),
        openPositions: h.open_positions,
      }));

      // Calculate metrics
      const { drawdown, percent, peak } = calculateMaxDrawdown(history);
      const tradingMetrics = calculateTradingMetrics(tradesData || []);

      const currentEquity = history.length > 0 ? history[history.length - 1].equity : 0;
      const startingEquity = history.length > 0 ? history[0].equity : 10000; // Default demo balance
      const totalReturn = currentEquity - startingEquity;
      const totalReturnPercent = startingEquity > 0 ? (totalReturn / startingEquity) * 100 : 0;

      setMetrics({
        history,
        maxDrawdown: drawdown,
        maxDrawdownPercent: percent,
        peakEquity: peak,
        currentEquity,
        totalReturn,
        totalReturnPercent,
        ...tradingMetrics,
        loading: false,
      });
    } catch (error) {
      console.error('Error fetching portfolio history:', error);
      setMetrics(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchData();

    // Subscribe to portfolio_history changes
    const portfolioChannel = supabase
      .channel('portfolio_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'portfolio_history',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to trades changes
    const tradesChannel = supabase
      .channel('trades_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(portfolioChannel);
      supabase.removeChannel(tradesChannel);
    };
  }, [accountMode, timeRange]);

  return metrics;
}
