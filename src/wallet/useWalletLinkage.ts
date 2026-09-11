// user_wallets is created by migration 20260910000000_user_wallets.sql and
// included in the generated Database type (src/integrations/supabase/types.ts).
// Stores public addresses + provider metadata only. No secrets, keys, or custodial material.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LinkedWallet {
  id: string;
  address: string;
  source: 'embedded' | 'injected';
  chain_id: number | null;
  is_primary: boolean;
}

/**
 * Links the active unified wallet address to the authenticated Supabase user.
 * Owner-only via RLS (see migration 20260910000000_user_wallets.sql).
 * Tron / deposit architecture untouched.
 */
export const useWalletLinkage = (
  address: string,
  source: 'embedded' | 'injected',
  chainId: number | null,
) => {
  const [linked, setLinked] = useState<LinkedWallet[]>([]);
  const [linking, setLinking] = useState(false);

  const fetchLinked = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLinked([]);
      return;
    }
    const { data } = await supabase
      .from('user_wallets')
      .select('id, address, source, chain_id, is_primary')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setLinked((data ?? []) as LinkedWallet[]);
  }, []);

  useEffect(() => {
    fetchLinked();
  }, [fetchLinked, address]);

  const linkCurrent = useCallback(async () => {
    if (!address) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setLinking(true);
    try {
      await supabase.from('user_wallets').upsert(
        {
          user_id: user.id,
          address: address.toLowerCase(),
          source,
          chain_id: chainId,
        },
        { onConflict: 'user_id,address' },
      );
      await fetchLinked();
    } finally {
      setLinking(false);
    }
  }, [address, source, chainId, fetchLinked]);

  return { linked, linking, linkCurrent, refreshLinked: fetchLinked };
};
