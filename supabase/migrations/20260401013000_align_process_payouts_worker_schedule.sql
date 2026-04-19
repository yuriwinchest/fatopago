-- Align payout worker heartbeat to 5 minutes with canonical job name.
-- Security note: token is not embedded in SQL; enqueue_withdrawal_worker_run reads runtime config.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

GRANT USAGE ON SCHEMA cron TO postgres;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  -- Remove legacy job name if present.
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'process-pending-withdrawals-every-2m'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  -- Replace canonical job if it already exists.
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'process-payouts-worker'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'process-payouts-worker',
    '*/5 * * * *',
    $job$select public.enqueue_withdrawal_worker_run();$job$
  );
END;
$$;
