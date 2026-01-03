import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Trade {
  id: string;
  user_id: string;
  pair: string;
  direction: 'buy' | 'sell';
  lot_size: number;
  entry_price: number;
  exit_price?: number;
  stop_loss?: number;
  take_profit?: number;
  status: 'open' | 'closed' | 'cancelled';
  pnl: number;
  account_mode: 'demo' | 'live';
  contract_address?: string;
  transaction_hash?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface AccountBalance {
  id: string;
  user_id: string;
  demo_balance: number;
  live_balance: number;
  total_pnl: number;
  today_pnl: number;
  created_at: string;
  updated_at: string;
}

export const useTrades = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accountBalance, setAccountBalance] = useState<AccountBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTrades = async () => {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrades((data as Trade[]) || []);
    } catch (error) {
      console.error('Error fetching trades:', error);
      toast({
        title: "Error",
        description: "Failed to fetch trades",
        variant: "destructive"
      });
    }
  };

  const fetchAccountBalance = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('account_balances')
        .select('*')
        .eq('user_id', user.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (!data) {
        // Create initial balance record
        const { data: newBalance, error: createError } = await supabase
          .from('account_balances')
          .insert({
            user_id: user.user.id,
            demo_balance: 10000,
            live_balance: 0,
            total_pnl: 0,
            today_pnl: 0
          })
          .select()
          .single();

        if (createError) throw createError;
        setAccountBalance(newBalance);
      } else {
        setAccountBalance(data);
      }
    } catch (error) {
      console.error('Error fetching account balance:', error);
      toast({
        title: "Error",
        description: "Failed to fetch account balance",
        variant: "destructive"
      });
    }
  };

  const createTrade = async (tradeData: {
    pair: string;
    direction: 'buy' | 'sell';
    lot_size: number;
    entry_price: number;
    stop_loss?: number;
    take_profit?: number;
    account_mode: 'demo' | 'live';
    contract_address?: string;
    transaction_hash?: string;
  }) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast({
          title: "Error",
          description: "You must be logged in to create trades",
          variant: "destructive"
        });
        return null;
      }

      const { data, error } = await supabase
        .from('trades')
        .insert({
          ...tradeData,
          user_id: user.user.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: `${tradeData.direction.toUpperCase()} order placed for ${tradeData.pair}`,
      });

      await fetchTrades();
      return data;
    } catch (error) {
      console.error('Error creating trade:', error);
      toast({
        title: "Error",
        description: "Failed to create trade",
        variant: "destructive"
      });
      return null;
    }
  };

  const closeTrade = async (tradeId: string, exitPrice: number) => {
    try {
      const { data, error } = await supabase.rpc('close_trade', {
        p_trade_id: tradeId,
        p_exit_price: exitPrice
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Trade closed successfully",
      });

      await fetchTrades();
      await fetchAccountBalance();
      return data;
    } catch (error) {
      console.error('Error closing trade:', error);
      toast({
        title: "Error",
        description: "Failed to close trade",
        variant: "destructive"
      });
      return null;
    }
  };

  const updatePnL = async (tradeId: string, currentPrice: number) => {
    try {
      const { data, error } = await supabase.rpc('calculate_trade_pnl', {
        p_trade_id: tradeId,
        p_current_price: currentPrice
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating PnL:', error);
      return null;
    }
  };

  const cancelTrade = async (tradeId: string) => {
    try {
      const { data, error } = await supabase.rpc('cancel_trade', {
        p_trade_id: tradeId
      });

      if (error) throw error;

      toast({
        title: "Trade Cancelled",
        description: "Your trade has been cancelled successfully",
      });

      await fetchTrades();
      return data;
    } catch (error) {
      console.error('Error cancelling trade:', error);
      toast({
        title: "Error",
        description: "Failed to cancel trade",
        variant: "destructive"
      });
      return null;
    }
  };

  const resetDemoBalance = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return null;

      const { data, error } = await supabase
        .from('account_balances')
        .update({
          demo_balance: 10000,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.user.id)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Demo reset',
        description: 'Demo balance has been reset to $10,000',
      });

      await fetchAccountBalance();
      return data;
    } catch (error) {
      console.error('Error resetting demo balance:', error);
      toast({
        title: 'Error',
        description: 'Failed to reset demo balance',
        variant: 'destructive',
      });
      return null;
    }
  };


  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([fetchTrades(), fetchAccountBalance()]);
      setLoading(false);
    };

    initializeData();

    // Set up real-time subscriptions
    const tradesSubscription = supabase
      .channel('trades-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'trades' }, 
        (payload) => {
          console.log('Trade change received:', payload);
          fetchTrades();
        }
      )
      .subscribe();

    const balanceSubscription = supabase
      .channel('balance-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'account_balances' }, 
        (payload) => {
          console.log('Balance change received:', payload);
          fetchAccountBalance();
        }
      )
      .subscribe();

    return () => {
      tradesSubscription.unsubscribe();
      balanceSubscription.unsubscribe();
    };
  }, []);

  return {
    trades,
    accountBalance,
    loading,
    createTrade,
    closeTrade,
    cancelTrade,
    resetDemoBalance,
    updatePnL,
    fetchTrades,
    fetchAccountBalance
  };
};
