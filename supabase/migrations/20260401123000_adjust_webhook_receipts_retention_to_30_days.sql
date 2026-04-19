-- Ajuste operacional: reduzir retenção de receipts de webhook de 45 para 30 dias.
-- Estratégia:
-- 1) Atualizar default da função de purge para 30 dias.
-- 2) Reagendar o job diário para chamar explicitamente 30 dias.

CREATE OR REPLACE FUNCTION public.purge_mercadopago_webhook_receipts(
  p_retention_days INTEGER DEFAULT 30,
  p_batch_limit INTEGER DEFAULT 10000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retention_days INTEGER := LEAST(GREATEST(COALESCE(p_retention_days, 30), 1), 365);
  v_batch_limit INTEGER := LEAST(GREATEST(COALESCE(p_batch_limit, 10000), 100), 50000);
  v_cutoff TIMESTAMPTZ := NOW() - make_interval(days => v_retention_days);
  v_deleted_count INTEGER := 0;
BEGIN
  IF NOT (
    COALESCE(auth.role(), '') = 'service_role'
    OR public.is_admin_user(auth.uid())
    OR current_user = 'postgres'
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH doomed AS (
    SELECT request_id
    FROM public.mercadopago_webhook_receipts
    WHERE received_at < v_cutoff
    ORDER BY received_at ASC
    LIMIT v_batch_limit
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM public.mercadopago_webhook_receipts r
  USING doomed d
  WHERE r.request_id = d.request_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'ok',
    'deleted', v_deleted_count,
    'retention_days', v_retention_days,
    'batch_limit', v_batch_limit,
    'cutoff', v_cutoff
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_mercadopago_webhook_receipts(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_mercadopago_webhook_receipts(INTEGER, INTEGER) TO service_role;

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
    '17 3 * * *',
    $job$select public.purge_mercadopago_webhook_receipts(30, 10000);$job$
  );
END;
$$;
