-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule evaluate-signals every 15 minutes
SELECT cron.schedule(
  'evaluate-signals-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://trbgjsurjfubezcdzpao.supabase.co/functions/v1/evaluate-signals',
    headers:='{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyYmdqc3VyamZ1YmV6Y2R6cGFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkyMjc4ODksImV4cCI6MjA2NDgwMzg4OX0._3CDlFbsFa-K805nSh5n6OGJfs-o0eHlceaMm-ykroo"}'::jsonb
  ) as request_id;
  $$
);