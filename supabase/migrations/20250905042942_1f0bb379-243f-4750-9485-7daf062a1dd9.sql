-- Hybrid architecture Phase 1 DB changes
-- 1) Extend profiles with chain addresses
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tron_address text,
  ADD COLUMN IF NOT EXISTS l2_address text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 2) Deposits table (custodial/off-chain ledger)
CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chain text NOT NULL CHECK (chain IN ('tron','polygon')),
  asset text NOT NULL DEFAULT 'USDT',
  amount numeric(20,6) NOT NULL,
  tx_hash text,
  from_address text,
  to_address text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','failed','credited')),
  confirmed_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_deposits_chain_txhash ON public.deposits(chain, tx_hash) WHERE tx_hash IS NOT NULL;

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own deposits"
ON public.deposits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create their own deposit records"
ON public.deposits FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_deposits_updated_at') THEN
    CREATE TRIGGER update_deposits_updated_at
    BEFORE UPDATE ON public.deposits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 3) Withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chain text NOT NULL CHECK (chain IN ('tron','polygon')),
  asset text NOT NULL DEFAULT 'USDT',
  amount numeric(20,6) NOT NULL,
  destination_address text NOT NULL,
  tx_hash text,
  fee numeric(20,6),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','processing','sent','failed','cancelled','completed')),
  processed_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own withdrawals"
ON public.withdrawals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create their own withdrawals"
ON public.withdrawals FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'requested');

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_withdrawals_updated_at') THEN
    CREATE TRIGGER update_withdrawals_updated_at
    BEFORE UPDATE ON public.withdrawals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 4) Bridge transactions for internal liquidity rebalancing
CREATE TABLE IF NOT EXISTS public.bridge_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_chain text NOT NULL CHECK (from_chain IN ('tron','polygon')),
  to_chain text NOT NULL CHECK (to_chain IN ('tron','polygon')),
  asset text NOT NULL DEFAULT 'USDT',
  amount numeric(20,6) NOT NULL,
  initiated_by uuid,
  source_tx_hash text,
  dest_tx_hash text,
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','bridging','completed','failed','cancelled')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bridge_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own bridge txs"
ON public.bridge_transactions FOR SELECT
USING (initiated_by IS NOT NULL AND auth.uid() = initiated_by);

CREATE POLICY IF NOT EXISTS "Users can create their own bridge txs"
ON public.bridge_transactions FOR INSERT
WITH CHECK (initiated_by IS NOT NULL AND auth.uid() = initiated_by);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_bridge_transactions_updated_at') THEN
    CREATE TRIGGER update_bridge_transactions_updated_at
    BEFORE UPDATE ON public.bridge_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- 5) Extend trades with chain metadata
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS source_chain text,
  ADD COLUMN IF NOT EXISTS settlement_chain text DEFAULT 'polygon';

DO $$ BEGIN
  -- add constraint only if it doesn't exist (by name)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trades_chain_values'
  ) THEN
    ALTER TABLE public.trades
      ADD CONSTRAINT trades_chain_values CHECK (
        (source_chain IS NULL OR source_chain IN ('tron','polygon')) AND
        (settlement_chain IS NULL OR settlement_chain IN ('tron','polygon'))
      );
  END IF;
END $$;