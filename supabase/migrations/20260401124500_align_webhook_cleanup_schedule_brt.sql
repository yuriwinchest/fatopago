-- Ajuste de horário operacional:
-- banco em UTC, operação no Brasil (America/Sao_Paulo, UTC-3).
-- 03:17 BRT => 06:17 UTC.

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'cleanup-mercadopago-webhook-receipts'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'cleanup-mercadopago-webhook-receipts',
    '17 6 * * *',
    $job$select public.purge_mercadopago_webhook_receipts(30, 10000);$job$
  );
END;
$$;
