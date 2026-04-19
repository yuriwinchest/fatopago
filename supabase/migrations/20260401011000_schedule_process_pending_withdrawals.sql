-- Schedules automatic execution of process-pending-withdrawals worker via pg_cron + pg_net.
-- Secrets are NOT embedded here; runtime token and base URL are read from DB settings:
--   app.settings.withdrawal_worker_token
--   app.settings.supabase_functions_base_url
--   app.settings.withdrawal_worker_limit (optional)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.enqueue_withdrawal_worker_run()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT := NULLIF(current_setting('app.settings.withdrawal_worker_token', true), '');
  v_base_url TEXT := NULLIF(current_setting('app.settings.supabase_functions_base_url', true), '');
  v_limit_raw TEXT := NULLIF(current_setting('app.settings.withdrawal_worker_limit', true), '');
  v_limit INTEGER := 20;
  v_request_id BIGINT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_base_url IS NULL THEN
    RAISE EXCEPTION 'Configuração ausente: app.settings.supabase_functions_base_url';
  END IF;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Configuração ausente: app.settings.withdrawal_worker_token';
  END IF;

  BEGIN
    IF v_limit_raw IS NOT NULL THEN
      v_limit := LEAST(GREATEST(v_limit_raw::INTEGER, 1), 100);
    END IF;
  EXCEPTION
    WHEN others THEN
      v_limit := 20;
  END;

  SELECT net.http_post(
    url := v_base_url || '/process-pending-withdrawals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-token', v_token
    ),
    body := jsonb_build_object('limit', v_limit)
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_withdrawal_worker_run() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_withdrawal_worker_run() TO service_role;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'process-pending-withdrawals-every-2m'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'process-pending-withdrawals-every-2m',
    '*/2 * * * *',
    $job$select public.enqueue_withdrawal_worker_run();$job$
  );
END;
$$;
