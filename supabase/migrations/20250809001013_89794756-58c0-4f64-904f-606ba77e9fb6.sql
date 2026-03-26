-- Create tables for trading system
CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  lot_size DECIMAL(10, 4) NOT NULL,
  entry_price DECIMAL(15, 8) NOT NULL,
  exit_price DECIMAL(15, 8),
  stop_loss DECIMAL(15, 8),
  take_profit DECIMAL(15, 8),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  pnl DECIMAL(15, 2) DEFAULT 0,
  account_mode TEXT NOT NULL DEFAULT 'demo' CHECK (account_mode IN ('demo', 'live')),
  contract_address TEXT,
  transaction_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own trades" 
ON public.trades 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own trades" 
ON public.trades 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades" 
ON public.trades 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades" 
ON public.trades 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trading signals table
CREATE TABLE public.trading_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('LONG', 'SHORT')),
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  recommendation TEXT NOT NULL,
  signal_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for signals
ALTER TABLE public.trading_signals ENABLE ROW LEVEL SECURITY;

-- Create policies for signals
CREATE POLICY "Users can view their own signals" 
ON public.trading_signals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own signals" 
ON public.trading_signals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create account balances table
CREATE TABLE public.account_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  demo_balance DECIMAL(15, 2) NOT NULL DEFAULT 10000.00,
  live_balance DECIMAL(15, 8) NOT NULL DEFAULT 0,
  total_pnl DECIMAL(15, 2) NOT NULL DEFAULT 0,
  today_pnl DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security for balances
ALTER TABLE public.account_balances ENABLE ROW LEVEL SECURITY;

-- Create policies for balances
CREATE POLICY "Users can view their own balance" 
ON public.account_balances 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own balance" 
ON public.account_balances 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own balance" 
ON public.account_balances 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_trades_updated_at
BEFORE UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_account_balances_updated_at
BEFORE UPDATE ON public.account_balances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to calculate PnL
CREATE OR REPLACE FUNCTION public.calculate_trade_pnl(
  p_trade_id UUID,
  p_current_price DECIMAL(15, 8)
) 
RETURNS DECIMAL(15, 2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trade_record RECORD;
  pnl_amount DECIMAL(15, 2);
BEGIN
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

-- Create function to close trade
CREATE OR REPLACE FUNCTION public.close_trade(
  p_trade_id UUID,
  p_exit_price DECIMAL(15, 8)
) 
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  final_pnl DECIMAL(15, 2);
BEGIN
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
  
  -- Update user balance
  UPDATE account_balances 
  SET 
    demo_balance = CASE 
      WHEN (SELECT account_mode FROM trades WHERE id = p_trade_id) = 'demo' 
      THEN demo_balance + final_pnl 
      ELSE demo_balance 
    END,
    total_pnl = total_pnl + final_pnl,
    today_pnl = today_pnl + final_pnl,
    updated_at = now()
  WHERE user_id = auth.uid();
  
  RETURN p_trade_id;
END;
$$;