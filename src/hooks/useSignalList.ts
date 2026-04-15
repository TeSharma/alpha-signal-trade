import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SignalObject } from '@/types/signal';
import { useToast } from '@/components/ui/use-toast';

export interface SignalFilters {
  status?: string[];
  tradeStatus?: string[];
  result?: string[];
  market?: string[];
  direction?: string[];
  strategy?: string[];
  modelVersion?: string[];
  confidenceMin?: number;
  confidenceMax?: number;
  timeframe?: string[];
  pair?: string[];
  myTrades?: boolean;
}

export interface SignalSort {
  field: 'confidence' | 'created_at' | 'expires_at' | 'trade_pnl';
  direction: 'asc' | 'desc';
}

export interface SignalPagination {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export function useSignalList() {
  const [signals, setSignals] = useState<SignalObject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<SignalFilters>({});
  const [sort, setSort] = useState<SignalSort>({
    field: 'confidence',
    direction: 'desc'
  });
  const [pagination, setPagination] = useState<SignalPagination>({
    page: 1,
    pageSize: 5,
    total: 0,
    hasMore: true
  });
  
  const lastCursor = useRef<string | null>(null);
  const { toast } = useToast();

  // Debounced filter update
  const debouncedFilters = useRef<SignalFilters>(filters);
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      debouncedFilters.current = filters;
      refreshSignals(true);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  const buildQuery = useCallback((baseQuery: any) => {
    const f = debouncedFilters.current;
    
    // Status filters — default to active only
    if (f.status && f.status.length > 0) {
      baseQuery = baseQuery.in('signal_status', f.status);
    } else {
      baseQuery = baseQuery.eq('signal_status', 'active');
    }
    
    // Trade status filters
    if (f.tradeStatus && f.tradeStatus.length > 0) {
      baseQuery = baseQuery.in('trade_status', f.tradeStatus);
    }
    
    // Result filters
    if (f.result && f.result.length > 0) {
      baseQuery = baseQuery.in('trade_result', f.result);
    }
    
    // Market filters
    if (f.market && f.market.length > 0) {
      baseQuery = baseQuery.in('market', f.market);
    }
    
    // Direction filters
    if (f.direction && f.direction.length > 0) {
      baseQuery = baseQuery.in('direction', f.direction);
    }
    
    // Strategy filters
    if (f.strategy && f.strategy.length > 0) {
      baseQuery = baseQuery.in('strategy', f.strategy);
    }
    
    // Model version filters
    if (f.modelVersion && f.modelVersion.length > 0) {
      baseQuery = baseQuery.in('model_version', f.modelVersion);
    }
    
    // Confidence range
    if (f.confidenceMin !== undefined) {
      baseQuery = baseQuery.gte('confidence', f.confidenceMin);
    }
    if (f.confidenceMax !== undefined) {
      baseQuery = baseQuery.lte('confidence', f.confidenceMax);
    }
    
    // Timeframe filters
    if (f.timeframe && f.timeframe.length > 0) {
      baseQuery = baseQuery.in('timeframe', f.timeframe);
    }
    
    // Pair filters
    if (f.pair && f.pair.length > 0) {
      baseQuery = baseQuery.in('pair', f.pair);
    }
    
    // My trades filter
    if (f.myTrades) {
      baseQuery = baseQuery.not('trade_id', 'is', null);
    }
    
    return baseQuery;
  }, []);

  const fetchSignals = useCallback(async (isRefresh = false) => {
    if (isLoading && !isRefresh) return;
    
    setIsLoading(true);
    try {
      let query = (supabase as any)
        .from('signal_overview')
        .select('*', { count: 'exact' })
        .order(sort.field, { ascending: sort.direction === 'asc' });

      // Apply filters
      query = buildQuery(query);

      // Apply pagination
      if (!isRefresh && lastCursor.current) {
        query = query.lt('created_at', lastCursor.current);
      }

      query = query.limit(pagination.pageSize);

      const { data, error, count } = await query;

      if (error) {
        console.error('Supabase query error:', error);
        toast({
          title: 'Database Error',
          description: 'Failed to fetch signals. Please check your connection and try again.',
          variant: 'destructive',
        });
        setSignals([]);
        setPagination(prev => ({ ...prev, total: 0, hasMore: false }));
        return;
      }

      if (!data) {
        setSignals([]);
        setPagination(prev => ({ ...prev, total: 0, hasMore: false }));
        return;
      }

      // Map data to SignalObject format
      const mappedSignals: SignalObject[] = data.map(row => ({
        id: row.id.toString(),
        user_id: row.user_id,
        market: row.market,
        pair: row.pair,
        direction: row.direction,
        entry_zone: row.entry_zone,
        stop_loss: row.stop_loss,
        take_profit: row.take_profit,
        timeframe: row.timeframe,
        strategy: row.strategy,
        confidence: row.confidence,
        risk: row.risk_data || { rr: 0, risk_level: 'MODERATE' },
        execution: { 
          type: row.execution_type || 'ON_CHAIN', 
          supported: true 
        },
        explanation: row.explanation || [],
        expires_at: row.expires_at ? Math.floor(new Date(row.expires_at).getTime() / 1000) : 0,
        created_at: row.created_at,
        status: row.signal_status,
        model_version: row.model_version,
        signal_strength: row.signal_strength,
        // Add trade context
        trade_id: row.trade_id,
        trade_status: row.trade_status,
        trade_entry_price: row.trade_entry_price,
        trade_exit_price: row.trade_exit_price,
        trade_pnl: row.trade_pnl,
        trade_result: row.trade_result,
        trade_account_mode: row.trade_account_mode,
        // Add performance context
        signal_performance_result: row.signal_performance_result,
        signal_performance_pnl: row.signal_performance_pnl,
        signal_time_to_target: row.signal_time_to_target,
        signal_model_version: row.signal_model_version,
        signal_strategy: row.signal_strategy
      }));

      if (isRefresh) {
        setSignals(mappedSignals);
        lastCursor.current = mappedSignals.length > 0 ? mappedSignals[mappedSignals.length - 1].created_at : null;
      } else {
        setSignals(prev => [...prev, ...mappedSignals]);
        lastCursor.current = mappedSignals.length > 0 ? mappedSignals[mappedSignals.length - 1].created_at : null;
      }

      setPagination(prev => ({
        ...prev,
        total: count || 0,
        hasMore: mappedSignals.length === pagination.pageSize
      }));

    } catch (error: any) {
      console.error('Failed to fetch signals:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch signals. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [sort, pagination.pageSize, buildQuery, toast]);

  const refreshSignals = useCallback(async (reset = false) => {
    setIsRefreshing(true);
    if (reset) {
      lastCursor.current = null;
      setSignals([]);
    }
    await fetchSignals(true);
  }, [fetchSignals]);

  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || isLoading) return;
    await fetchSignals(false);
  }, [pagination.hasMore, isLoading, fetchSignals]);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSort({ field: 'confidence', direction: 'desc' });
    lastCursor.current = null;
    setSignals([]);
    setPagination(prev => ({ ...prev, page: 1, hasMore: true }));
    refreshSignals(true);
  }, [refreshSignals]);

  // Initial load
  useEffect(() => {
    refreshSignals(true);
  }, [refreshSignals]);

  // Real-time updates for relevant changes
  useEffect(() => {
    const setupRealtimeUpdates = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        const channel = supabase
          .channel('signal_overview_realtime')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'trading_signals',
              filter: 'status=eq=active'
            },
            () => {
              refreshSignals(false);
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'trades',
              filter: userId ? `user_id=eq.${userId}` : 'user_id=eq.null'
            },
            () => {
              refreshSignals(false);
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error('Failed to setup realtime updates:', error);
      }
    };

    const cleanup = setupRealtimeUpdates();
    
    return () => {
      cleanup?.then(cleanupFn => cleanupFn?.()).catch(console.error);
    };
  }, [refreshSignals]);

  return {
    signals,
    isLoading,
    isRefreshing,
    filters,
    setFilters,
    sort,
    setSort,
    pagination,
    refreshSignals,
    loadMore,
    clearFilters,
    hasMore: pagination.hasMore
  };
}