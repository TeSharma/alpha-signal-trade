-- Create signal_overview view that combines trading_signals with trade and performance data
CREATE OR REPLACE VIEW public.signal_overview AS
SELECT 
  s.id,
  s.user_id,
  COALESCE(s.market, 'CRYPTO') as market,
  s.pair,
  s.direction,
  s.entry_zone,
  s.stop_loss,
  s.take_profit,
  s.timeframe,
  s.strategy,
  s.confidence,
  s.risk_data as risk,
  s.execution_type,
  s.explanation,
  s.expires_at,
  s.created_at,
  s.status as signal_status,
  s.model_version,
  s.confidence as signal_strength, -- Using confidence as signal_strength for now
  -- Trade context fields (from trades table)
  t.id as trade_id,
  t.status as trade_status,
  t.entry_price as trade_entry_price,
  t.exit_price as trade_exit_price,
  t.pnl as trade_pnl,
  CASE 
    WHEN t.pnl > 0 THEN 'WIN'
    WHEN t.pnl < 0 THEN 'LOSS'
    ELSE NULL
  END as trade_result,
  t.account_mode as trade_account_mode,
  -- Performance context fields (from signal_performance table)
  sp.result as signal_performance_result,
  sp.pnl_percent as signal_performance_pnl,
  EXTRACT(EPOCH FROM sp.time_to_target) as signal_time_to_target,
  sp.model_version as signal_model_version,
  sp.strategy as signal_strategy
FROM trading_signals s
LEFT JOIN trades t ON s.id = t.signal_id
LEFT JOIN signal_performance sp ON s.id = sp.signal_id;

-- Note: Views do not support RLS policies correctly, so we apply RLS to underlying tables instead
-- The view will inherit the RLS policies from the underlying tables

-- Enable realtime for the view
ALTER VIEW public.signal_overview REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.signal_overview;
