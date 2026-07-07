
-- 1. Notifications: restrict INSERT to service_role
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;
CREATE POLICY "Service can insert notifications"
ON public.notifications FOR INSERT TO service_role
WITH CHECK (true);

-- 2. Trading signals: restrict AI INSERT to service_role
DROP POLICY IF EXISTS "Allow AI insert " ON public.trading_signals;
DROP POLICY IF EXISTS "Allow AI insert" ON public.trading_signals;
CREATE POLICY "Service can insert AI signals"
ON public.trading_signals FOR INSERT TO service_role
WITH CHECK (true);

-- 3. user_roles: restrictive policy blocks non-admin/non-service self-insert
DROP POLICY IF EXISTS "Only admins or service can insert roles" ON public.user_roles;
CREATE POLICY "Only admins or service can insert roles"
ON public.user_roles AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. signal_overview view: switch to SECURITY INVOKER
ALTER VIEW public.signal_overview SET (security_invoker = true);

-- 5. Storage: remove broad public SELECT policy on avatars bucket (public URLs still work)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- 6. Revoke EXECUTE on internal/trigger SECURITY DEFINER functions from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_signal_performance_result() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Trading RPCs: keep authenticated access, revoke from anon
REVOKE EXECUTE ON FUNCTION public.close_trade(uuid, numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_trade(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calculate_trade_pnl(uuid, numeric) FROM PUBLIC, anon;

-- has_role: needs to remain callable for RLS evaluation, but only by authenticated users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
