-- 1. Fix calculate_trade_pnl to branch by pair type (crypto vs forex vs JPY)
CREATE OR REPLACE FUNCTION public.calculate_trade_pnl(p_trade_id uuid, p_current_price numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  trade_record RECORD;
  pnl_amount DECIMAL(15, 2);
  price_diff NUMERIC;
  multiplier NUMERIC;
  is_crypto BOOLEAN;
  is_jpy BOOLEAN;
BEGIN
  IF p_current_price IS NULL OR p_current_price <= 0 OR p_current_price > 10000000 THEN
    RAISE EXCEPTION 'Invalid current price: must be between 0 and 10,000,000';
  END IF;

  SELECT * INTO trade_record FROM trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Detect asset class from pair
  is_crypto := trade_record.pair IN (
    'BTC/USD','ETH/USD','POL/USD','SOL/USD','BNB/USD','XRP/USD',
    'ADA/USD','DOGE/USD','AVAX/USD','MATIC/USD','LINK/USD','DOT/USD'
  );
  is_jpy := trade_record.pair LIKE '%JPY%';

  -- Choose multiplier per asset class
  IF is_crypto THEN
    multiplier := 1;            -- lot_size = units of base asset
  ELSIF is_jpy THEN
    multiplier := 1000;         -- JPY standard lot
  ELSE
    multiplier := 100000;       -- forex standard lot
  END IF;

  IF trade_record.direction = 'buy' THEN
    price_diff := p_current_price - trade_record.entry_price;
  ELSE
    price_diff := trade_record.entry_price - p_current_price;
  END IF;

  pnl_amount := price_diff * trade_record.lot_size * multiplier;

  UPDATE trades
  SET pnl = pnl_amount, updated_at = now()
  WHERE id = p_trade_id;

  RETURN pnl_amount;
END;
$function$;

-- 2. Recompute pnl on previously-closed crypto trades that were inflated by the old 100000 multiplier
UPDATE public.trades
SET pnl = CASE
    WHEN direction = 'buy' THEN (exit_price - entry_price) * lot_size
    ELSE (entry_price - exit_price) * lot_size
  END,
  updated_at = now()
WHERE status = 'closed'
  AND exit_price IS NOT NULL
  AND pair IN ('BTC/USD','ETH/USD','POL/USD','SOL/USD','BNB/USD','XRP/USD',
               'ADA/USD','DOGE/USD','AVAX/USD','MATIC/USD','LINK/USD','DOT/USD');

-- 3. Cancel any still-open demo trades on crypto pairs (likely corrupt sizing)
UPDATE public.trades
SET status = 'cancelled', closed_at = now(), updated_at = now(), pnl = 0
WHERE status = 'open'
  AND account_mode = 'demo'
  AND pair IN ('BTC/USD','ETH/USD','POL/USD','SOL/USD','BNB/USD','XRP/USD',
               'ADA/USD','DOGE/USD','AVAX/USD','MATIC/USD','LINK/USD','DOT/USD');

-- 4. Reset all corrupted demo balances (>$50k or <$0 = clearly broken)
UPDATE public.account_balances
SET demo_balance = 10000,
    total_pnl = 0,
    today_pnl = 0,
    updated_at = now()
WHERE demo_balance > 50000 OR demo_balance < 0 OR total_pnl > 50000 OR total_pnl < -50000;

-- 5. Expire any active signals with broken SL geometry
UPDATE public.trading_signals
SET status = 'expired'
WHERE status = 'active'
  AND stop_loss IS NOT NULL
  AND entry_zone IS NOT NULL
  AND (
    (direction IN ('LONG','buy')  AND stop_loss >= COALESCE((entry_zone->>'low')::numeric,  (entry_zone->>'min')::numeric))
    OR
    (direction IN ('SHORT','sell') AND stop_loss <= COALESCE((entry_zone->>'high')::numeric, (entry_zone->>'max')::numeric))
  );
