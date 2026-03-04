ALTER TABLE public.trading_signals
  ADD COLUMN IF NOT EXISTS market text DEFAULT 'CRYPTO',
  ADD COLUMN IF NOT EXISTS entry_zone jsonb,
  ADD COLUMN IF NOT EXISTS stop_loss numeric,
  ADD COLUMN IF NOT EXISTS take_profit jsonb,
  ADD COLUMN IF NOT EXISTS timeframe text DEFAULT '15m',
  ADD COLUMN IF NOT EXISTS strategy text,
  ADD COLUMN IF NOT EXISTS risk_data jsonb,
  ADD COLUMN IF NOT EXISTS explanation text[],
  ADD COLUMN IF NOT EXISTS execution_type text DEFAULT 'ON_CHAIN',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

ALTER TABLE public.trading_signals ALTER COLUMN confidence TYPE numeric USING confidence::numeric;

CREATE INDEX IF NOT EXISTS idx_trading_signals_pair_status_created 
  ON public.trading_signals (pair, status, created_at DESC);

CREATE POLICY "Anyone can view active signals"
  ON public.trading_signals
  FOR SELECT
  TO authenticated
  USING (status = 'active');

CREATE POLICY "Users can update their own signal status"
  ON public.trading_signals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);