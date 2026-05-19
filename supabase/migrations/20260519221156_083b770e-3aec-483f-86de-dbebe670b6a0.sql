
INSERT INTO public.gsc_settings (site_url)
SELECT 'https://alpha-signal-trade.lovable.app/'
WHERE NOT EXISTS (SELECT 1 FROM public.gsc_settings);

DO $$
DECLARE
  existing_job int;
BEGIN
  SELECT jobid INTO existing_job FROM cron.job WHERE jobname = 'gsc-monitor-6h';
  IF existing_job IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job);
  END IF;
END $$;

SELECT cron.schedule(
  'gsc-monitor-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://trbgjsurjfubezcdzpao.supabase.co/functions/v1/gsc-monitor',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyYmdqc3VyamZ1YmV6Y2R6cGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMjc4ODksImV4cCI6MjA2NDgwMzg4OX0._3CDlFbsFa-K805nSh5n6OGJfs-o0eHlceaMm-ykroo"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);
