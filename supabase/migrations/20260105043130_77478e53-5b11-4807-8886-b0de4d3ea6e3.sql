-- Add input validation to RPC functions

-- Drop existing functions to recreate with validation
DROP FUNCTION IF EXISTS public.close_trade(uuid, numeric);
DROP FUNCTION IF EXISTS public.calculate_trade_pnl(uuid, numeric);
DROP FUNCTION IF EXISTS public.cancel_trade(uuid);
DROP FUNCTION IF EXISTS public.create_notification(uuid, text, text, text, text, jsonb);

-- Recreate close_trade with input validation
CREATE OR REPLACE FUNCTION public.close_trade(p_trade_id uuid, p_exit_price numeric)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  final_pnl DECIMAL(15, 2);
  trade_mode TEXT;
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
  
  RETURN p_trade_id;
END;
$$;

-- Recreate calculate_trade_pnl with input validation
CREATE OR REPLACE FUNCTION public.calculate_trade_pnl(p_trade_id uuid, p_current_price numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  trade_record RECORD;
  pnl_amount DECIMAL(15, 2);
BEGIN
  -- Input validation: price must be positive and within reasonable range
  IF p_current_price IS NULL OR p_current_price <= 0 OR p_current_price > 1000000 THEN
    RAISE EXCEPTION 'Invalid current price: must be between 0 and 1,000,000';
  END IF;

  SELECT * INTO trade_record FROM trades WHERE id = p_trade_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Calculate PnL based on direction
  IF trade_record.direction = 'buy' THEN
    pnl_amount := (p_current_price - trade_record.entry_price) * trade_record.lot_size * 100000;
  ELSE
    pnl_amount := (trade_record.entry_price - p_current_price) * trade_record.lot_size * 100000;
  END IF;
  
  -- Update the trade's PnL
  UPDATE trades 
  SET pnl = pnl_amount, updated_at = now() 
  WHERE id = p_trade_id;
  
  RETURN pnl_amount;
END;
$$;

-- Recreate cancel_trade (unchanged but consistent style)
CREATE OR REPLACE FUNCTION public.cancel_trade(p_trade_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Recreate create_notification with input validation and rate limiting
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, 
  p_title text, 
  p_message text, 
  p_type text DEFAULT 'info'::text, 
  p_action_url text DEFAULT NULL::text, 
  p_metadata jsonb DEFAULT NULL::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  notification_id uuid;
  recent_count integer;
BEGIN
  -- Input validation: title length
  IF p_title IS NULL OR length(p_title) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;
  IF length(p_title) > 200 THEN
    RAISE EXCEPTION 'Title must be 200 characters or less';
  END IF;
  
  -- Input validation: message length
  IF p_message IS NULL OR length(p_message) = 0 THEN
    RAISE EXCEPTION 'Message is required';
  END IF;
  IF length(p_message) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;
  
  -- Input validation: type must be valid
  IF p_type NOT IN ('info', 'success', 'warning', 'error') THEN
    RAISE EXCEPTION 'Invalid notification type';
  END IF;
  
  -- Rate limiting: max 20 notifications per minute per user
  SELECT COUNT(*) INTO recent_count
  FROM public.notifications
  WHERE user_id = p_user_id
    AND created_at > now() - interval '1 minute';
  
  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded: maximum 20 notifications per minute';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, action_url, metadata)
  VALUES (p_user_id, p_title, p_message, p_type, p_action_url, p_metadata)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;

-- Add index on notifications.created_at for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications(user_id, created_at DESC);