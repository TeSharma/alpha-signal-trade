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
  is_metal BOOLEAN;
  is_jpy BOOLEAN;
BEGIN
  IF p_current_price IS NULL OR p_current_price <= 0 OR p_current_price > 10000000 THEN
    RAISE EXCEPTION 'Invalid current price: must be between 0 and 10,000,000';
  END IF;

  SELECT * INTO trade_record FROM trades WHERE id = p_trade_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  is_crypto := trade_record.pair IN (
    'BTC/USD','ETH/USD','POL/USD','SOL/USD','BNB/USD','XRP/USD',
    'ADA/USD','DOGE/USD','AVAX/USD','MATIC/USD','LINK/USD','DOT/USD'
  );
  is_metal := trade_record.pair IN ('XAU/USD','XAG/USD');
  is_jpy := trade_record.pair LIKE '%JPY%';

  IF is_crypto THEN
    multiplier := 1;            -- lot_size = units of base asset
  ELSIF is_metal THEN
    multiplier := 100;          -- metals standard lot = 100 troy ounces
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