
ALTER TABLE trading_signals ALTER COLUMN user_id DROP NOT NULL;

-- Allow anyone to view signals with null user_id (public signals)
CREATE POLICY "Anyone can view public signals"
ON public.trading_signals
FOR SELECT
USING (user_id IS NULL);
