-- Restrict trading_signals updates: drop the policy that allowed authenticated users
-- to update system-generated (user_id IS NULL) signals
DROP POLICY IF EXISTS "Users can update signals they execute" ON public.trading_signals;

-- Defensive: ensure no permissive insert/update policies exist on signal_performance
DROP POLICY IF EXISTS "Anyone can insert signal performance" ON public.signal_performance;
DROP POLICY IF EXISTS "Anyone can update signal performance" ON public.signal_performance;
DROP POLICY IF EXISTS "Public can insert signal performance" ON public.signal_performance;
DROP POLICY IF EXISTS "Public can update signal performance" ON public.signal_performance;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.signal_performance;
DROP POLICY IF EXISTS "Enable update for all users" ON public.signal_performance;