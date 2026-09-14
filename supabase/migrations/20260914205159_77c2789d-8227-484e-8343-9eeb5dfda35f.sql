ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS chain_position_id BIGINT,
  ADD COLUMN IF NOT EXISTS close_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS close_requested_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS trades_open_status_idx ON public.trades (status) WHERE status = 'open';