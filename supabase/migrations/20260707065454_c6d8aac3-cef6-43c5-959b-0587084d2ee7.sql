
-- Remove permissive service_role RLS policies (service_role bypasses RLS anyway)
DROP POLICY IF EXISTS "Service role can insert performance" ON public.signal_performance;
DROP POLICY IF EXISTS "Service role can update performance" ON public.signal_performance;

-- Revoke EXECUTE from authenticated on internal helper (only called by close_trade)
REVOKE EXECUTE ON FUNCTION public.calculate_trade_pnl(uuid, numeric) FROM authenticated, PUBLIC;
