-- Fix close_trade function to update live_balance for live trades
CREATE OR REPLACE FUNCTION public.close_trade(p_trade_id uuid, p_exit_price numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  final_pnl DECIMAL(15, 2);
  trade_mode TEXT;
BEGIN
  -- Get the trade's account mode
  SELECT account_mode INTO trade_mode FROM trades WHERE id = p_trade_id;
  
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
  
  RETURN p_trade_id;
END;
$function$;

-- Add cancel_trade function to cancel open trades without affecting balance
CREATE OR REPLACE FUNCTION public.cancel_trade(p_trade_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only cancel if trade is still open and belongs to user
  UPDATE trades 
  SET 
    status = 'cancelled',
    closed_at = now(),
    updated_at = now(),
    pnl = 0
  WHERE id = p_trade_id 
    AND auth.uid() = user_id 
    AND status = 'open';
  
  RETURN p_trade_id;
END;
$function$;