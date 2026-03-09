-- Allow authenticated users to view executed/closed signals (not just active ones)
CREATE POLICY "Users can view executed signals they traded"
ON public.trading_signals
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trades WHERE trades.signal_id = trading_signals.id AND trades.user_id = auth.uid()
  )
);

-- Allow service role / edge function to update any signal status (for execute-trade)
-- The execute-trade function runs as the user, so we need to allow users to update signals they execute
CREATE POLICY "Users can update signals they execute"
ON public.trading_signals
FOR UPDATE
TO authenticated
USING (
  status = 'active' AND (
    user_id = auth.uid() OR user_id IS NULL
  )
)
WITH CHECK (
  status IN ('executed', 'closed', 'expired')
);