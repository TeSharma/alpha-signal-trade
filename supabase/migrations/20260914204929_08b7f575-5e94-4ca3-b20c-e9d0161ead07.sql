CREATE OR REPLACE FUNCTION public.close_trade_system(p_trade_id uuid, p_exit_price numeric, p_reason text DEFAULT 'auto')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t RECORD;
  multiplier NUMERIC;
  price_diff NUMERIC;
  final_pnl NUMERIC;
  is_crypto BOOLEAN;
  is_metal BOOLEAN;
  is_jpy BOOLEAN;
  current_balance NUMERIC;
  open_count INTEGER;
  unrealized NUMERIC;
BEGIN
  IF p_exit_price IS NULL OR p_exit_price <= 0 OR p_exit_price > 10000000 THEN
    RAISE EXCEPTION 'Invalid exit price: must be between 0 and 10,000,000';
  END IF;

  -- Lock the row and only proceed if still open (idempotent)
  SELECT * INTO t FROM trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('closed', false, 'reason', 'not_found');
  END IF;
  IF t.status <> 'open' THEN
    RETURN jsonb_build_object('closed', false, 'reason', 'already_' || t.status);
  END IF;

  is_crypto := t.pair IN (
    'BTC/USD','ETH/USD','POL/USD','SOL/USD','BNB/USD','XRP/USD',
    'ADA/USD','DOGE/USD','AVAX/USD','MATIC/USD','LINK/USD','DOT/USD'
  );
  is_metal := t.pair IN ('XAU/USD','XAG/USD');
  is_jpy := t.pair LIKE '%JPY%';

  IF is_crypto THEN
    multiplier := 1;
  ELSIF is_metal THEN
    multiplier := 100;
  ELSIF is_jpy THEN
    multiplier := 1000;
  ELSE
    multiplier := 100000;
  END IF;

  IF t.direction IN ('buy','long','LONG') THEN
    price_diff := p_exit_price - t.entry_price;
  ELSE
    price_diff := t.entry_price - p_exit_price;
  END IF;

  final_pnl := ROUND(price_diff * t.lot_size * multiplier, 2);

  UPDATE trades
  SET status = 'closed',
      exit_price = p_exit_price,
      pnl = final_pnl,
      closed_at = now(),
      updated_at = now()
  WHERE id = p_trade_id;

  UPDATE account_balances
  SET demo_balance = CASE WHEN t.account_mode = 'demo' THEN demo_balance + final_pnl ELSE demo_balance END,
      live_balance = CASE WHEN t.account_mode = 'live' THEN live_balance + final_pnl ELSE live_balance END,
      total_pnl = total_pnl + final_pnl,
      today_pnl = today_pnl + final_pnl,
      updated_at = now()
  WHERE user_id = t.user_id;

  SELECT CASE WHEN t.account_mode = 'demo' THEN demo_balance ELSE live_balance END
  INTO current_balance
  FROM account_balances WHERE user_id = t.user_id;

  IF current_balance IS NOT NULL THEN
    SELECT COUNT(*), COALESCE(SUM(pnl), 0)
    INTO open_count, unrealized
    FROM trades
    WHERE user_id = t.user_id AND status = 'open' AND account_mode = t.account_mode;

    INSERT INTO portfolio_history (user_id, account_mode, balance, equity, open_positions)
    VALUES (t.user_id, t.account_mode, current_balance, current_balance + unrealized, open_count);
  END IF;

  RETURN jsonb_build_object(
    'closed', true,
    'trade_id', p_trade_id,
    'exit_price', p_exit_price,
    'pnl', final_pnl,
    'reason', p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_trade_system(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_trade_system(uuid, numeric, text) FROM anon;
REVOKE ALL ON FUNCTION public.close_trade_system(uuid, numeric, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.close_trade_system(uuid, numeric, text) TO service_role;