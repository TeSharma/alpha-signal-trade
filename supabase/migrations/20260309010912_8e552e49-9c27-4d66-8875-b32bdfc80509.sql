-- Update close_trade function to capture portfolio snapshots
CREATE OR REPLACE FUNCTION public.close_trade(p_trade_id uuid, p_exit_price numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  final_pnl DECIMAL(15, 2);
  trade_mode TEXT;
  current_balance NUMERIC;
  current_equity NUMERIC;
  open_count INTEGER;
  unrealized_pnl NUMERIC;
BEGIN
  -- Input validation: price must be positive and within reasonable range
  IF p_exit_price IS NULL OR p_exit_price <= 0 OR p_exit_price > 1000000 THEN
    RAISE EXCEPTION 'Invalid exit price: must be between 0 and 1,000,000';
  END IF;

  -- Get the trade's account mode
  SELECT account_mode INTO trade_mode FROM trades WHERE id = p_trade_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found';
  END IF;
  
  -- Calculate final PnL
  SELECT calculate_trade_pnl(p_trade_id, p_exit_price) INTO final_pnl;
  
  -- Close the trade
  UPDATE trades 
  SET 
    status = 'closed',
    exit_price = p_exit_price,
    pnl = final_pnl,
    closed_at = now(),
    updated_at = now()
  WHERE id = p_trade_id AND auth.uid() = user_id;
  
  -- Update user balance based on account mode
  UPDATE account_balances 
  SET 
    demo_balance = CASE 
      WHEN trade_mode = 'demo' THEN demo_balance + final_pnl 
      ELSE demo_balance 
    END,
    live_balance = CASE 
      WHEN trade_mode = 'live' THEN live_balance + final_pnl 
      ELSE live_balance 
    END,
    total_pnl = total_pnl + final_pnl,
    today_pnl = today_pnl + final_pnl,
    updated_at = now()
  WHERE user_id = auth.uid();
  
  -- Get updated balance after PnL update
  SELECT 
    CASE WHEN trade_mode = 'demo' THEN demo_balance ELSE live_balance END
  INTO current_balance
  FROM account_balances 
  WHERE user_id = auth.uid();
  
  -- Calculate unrealized PnL from remaining open trades
  SELECT 
    COUNT(*), 
    COALESCE(SUM(pnl), 0)
  INTO open_count, unrealized_pnl
  FROM trades 
  WHERE user_id = auth.uid() 
    AND status = 'open' 
    AND account_mode = trade_mode;
  
  -- Calculate current equity
  current_equity := current_balance + unrealized_pnl;
  
  -- Insert portfolio snapshot
  INSERT INTO portfolio_history (user_id, account_mode, balance, equity, open_positions)
  VALUES (auth.uid(), trade_mode, current_balance, current_equity, open_count);
  
  RETURN p_trade_id;
END;
$$;