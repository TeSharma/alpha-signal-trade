import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type Deposit = Database['public']['Tables']['deposits']['Row'];
type Withdrawal = Database['public']['Tables']['withdrawals']['Row'];

export const useDeposits = () => {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDeposits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeposits(data || []);
    } catch (error: any) {
      console.error('Error fetching deposits:', error);
      toast({
        title: "Error",
        description: "Failed to fetch deposits",
        variant: "destructive"
      });
    }
  }, [toast]);

  const fetchWithdrawals = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawals(data || []);
    } catch (error: any) {
      console.error('Error fetching withdrawals:', error);
      toast({
        title: "Error",
        description: "Failed to fetch withdrawals",
        variant: "destructive"
      });
    }
  }, [toast]);

  const createDeposit = useCallback(async (depositData: {
    chain: string;
    asset: string;
    amount: number;
    from_address?: string;
    to_address?: string;
    tx_hash?: string;
    metadata?: any;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('deposits')
        .insert({
          user_id: user.id,
          ...depositData,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      setDeposits(prev => [data, ...prev]);
      toast({
        title: "Deposit Initiated",
        description: `${depositData.amount} ${depositData.asset} deposit on ${depositData.chain} network`
      });

      return data;
    } catch (error: any) {
      console.error('Error creating deposit:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create deposit",
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  const createWithdrawal = useCallback(async (withdrawalData: {
    chain: string;
    asset: string;
    amount: number;
    destination_address: string;
    metadata?: any;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user.id,
          ...withdrawalData,
          status: 'requested'
        })
        .select()
        .single();

      if (error) throw error;

      setWithdrawals(prev => [data, ...prev]);
      toast({
        title: "Withdrawal Requested",
        description: `${withdrawalData.amount} ${withdrawalData.asset} withdrawal to ${withdrawalData.chain} network`
      });

      return data;
    } catch (error: any) {
      console.error('Error creating withdrawal:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create withdrawal",
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDeposits(), fetchWithdrawals()]);
      setLoading(false);
    };

    loadData();

    // Set up real-time subscriptions
    const depositsChannel = supabase
      .channel('deposits-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'deposits'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setDeposits(prev => [payload.new as Deposit, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setDeposits(prev => prev.map(d => 
            d.id === payload.new.id ? payload.new as Deposit : d
          ));
        }
      })
      .subscribe();

    const withdrawalsChannel = supabase
      .channel('withdrawals-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'withdrawals'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setWithdrawals(prev => [payload.new as Withdrawal, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setWithdrawals(prev => prev.map(w => 
            w.id === payload.new.id ? payload.new as Withdrawal : w
          ));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(depositsChannel);
      supabase.removeChannel(withdrawalsChannel);
    };
  }, [fetchDeposits, fetchWithdrawals]);

  return {
    deposits,
    withdrawals,
    loading,
    createDeposit,
    createWithdrawal,
    refreshData: () => Promise.all([fetchDeposits(), fetchWithdrawals()])
  };
};