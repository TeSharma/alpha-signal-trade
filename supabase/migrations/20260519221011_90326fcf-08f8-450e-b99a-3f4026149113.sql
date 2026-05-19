
-- Roles infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- GSC tables
CREATE TABLE public.gsc_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL,
  recipient_email text,
  alert_coverage boolean NOT NULL DEFAULT true,
  alert_sitemap boolean NOT NULL DEFAULT true,
  alert_rank_drop boolean NOT NULL DEFAULT true,
  alert_traffic_drop boolean NOT NULL DEFAULT true,
  rank_drop_threshold int NOT NULL DEFAULT 3,
  traffic_drop_pct numeric NOT NULL DEFAULT 30,
  min_impressions int NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gsc_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL,
  total_clicks numeric DEFAULT 0,
  total_impressions numeric DEFAULT 0,
  avg_position numeric DEFAULT 0,
  avg_ctr numeric DEFAULT 0,
  coverage_errors int DEFAULT 0,
  sitemap_status jsonb,
  queries jsonb,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gsc_snapshots_site_time ON public.gsc_snapshots (site_url, created_at DESC);

CREATE TABLE public.gsc_query_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL,
  query text NOT NULL,
  position numeric NOT NULL,
  clicks numeric NOT NULL DEFAULT 0,
  impressions numeric NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gsc_query_history_q ON public.gsc_query_history (site_url, query, recorded_at DESC);

CREATE TABLE public.gsc_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_url text NOT NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  message text NOT NULL,
  fingerprint text NOT NULL,
  payload jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_type, fingerprint)
);

CREATE INDEX idx_gsc_alerts_created ON public.gsc_alerts (created_at DESC);

ALTER TABLE public.gsc_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsc_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsc_query_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsc_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage gsc_settings" ON public.gsc_settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view gsc_snapshots" ON public.gsc_snapshots
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins view gsc_query_history" ON public.gsc_query_history
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage gsc_alerts" ON public.gsc_alerts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_gsc_settings_updated
  BEFORE UPDATE ON public.gsc_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow notifications to be inserted by service role / triggers (currently no insert policy)
CREATE POLICY "Service can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Enable pg_cron + pg_net for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
