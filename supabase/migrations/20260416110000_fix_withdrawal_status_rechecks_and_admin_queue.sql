-- Corrige o repoll de saques com external_payout_id e cria fila administrativa de saques.

CREATE INDEX IF NOT EXISTS pix_withdrawals_status_updated_idx
  ON public.pix_withdrawals (status, updated_at ASC);

CREATE INDEX IF NOT EXISTS pix_withdrawals_processing_recheck_idx
  ON public.pix_withdrawals (status, external_payout_id, updated_at ASC)
  WHERE status = 'processing';

DROP FUNCTION IF EXISTS public.claim_pending_pix_withdrawals(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.claim_pending_pix_withdrawals(
  p_limit INTEGER DEFAULT 25,
  p_max_retries INTEGER DEFAULT 8
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  amount NUMERIC,
  pix_key TEXT,
  pix_key_type TEXT,
  idempotency_key TEXT,
  payout_attempts INTEGER,
  status TEXT,
  external_payout_id TEXT,
  external_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_max_retries INTEGER := LEAST(GREATEST(COALESCE(p_max_retries, 8), 1), 100);
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT pw.id
    FROM public.pix_withdrawals pw
    WHERE pw.status = 'pending'
       OR (
         pw.status = 'processing'
         AND pw.updated_at < NOW() - INTERVAL '2 minutes'
         AND (
           pw.external_payout_id IS NOT NULL
           OR COALESCE(pw.payout_attempts, 0) < v_max_retries
         )
       )
    ORDER BY
      CASE
        WHEN pw.status = 'pending' THEN 0
        WHEN pw.external_payout_id IS NOT NULL THEN 1
        ELSE 2
      END,
      pw.created_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.pix_withdrawals pw
    SET
      status = 'processing',
      processing_started_at = COALESCE(pw.processing_started_at, NOW()),
      payout_attempts = COALESCE(pw.payout_attempts, 0) + 1,
      updated_at = NOW()
    FROM candidates c
    WHERE pw.id = c.id
    RETURNING
      pw.id,
      pw.user_id,
      pw.amount,
      pw.pix_key,
      pw.pix_key_type,
      pw.idempotency_key,
      pw.payout_attempts,
      pw.status,
      pw.external_payout_id,
      pw.external_status
  )
  SELECT
    c.id,
    c.user_id,
    c.amount,
    c.pix_key,
    c.pix_key_type,
    c.idempotency_key,
    c.payout_attempts,
    c.status,
    c.external_payout_id,
    c.external_status
  FROM claimed c;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_pix_withdrawals(
  p_limit INTEGER DEFAULT 80,
  p_statuses TEXT[] DEFAULT ARRAY['pending_manual_review', 'pending', 'processing', 'failed', 'completed']
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_lastname TEXT,
  user_email TEXT,
  amount NUMERIC,
  pix_key_masked TEXT,
  pix_key_type TEXT,
  status TEXT,
  manual_review_required BOOLEAN,
  review_reason TEXT,
  payout_attempts INTEGER,
  external_payout_id TEXT,
  external_status TEXT,
  failed_reason TEXT,
  transaction_status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 80), 1), 200);
  v_statuses TEXT[] := COALESCE(
    p_statuses,
    ARRAY['pending_manual_review', 'pending', 'processing', 'failed', 'completed']
  );
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    pw.id,
    pw.user_id,
    COALESCE(NULLIF(TRIM(p.name), ''), 'Sem nome') AS user_name,
    NULLIF(TRIM(p.lastname), '') AS user_lastname,
    COALESCE(NULLIF(TRIM(p.email), ''), pw.user_id::TEXT) AS user_email,
    pw.amount,
    CASE
      WHEN NULLIF(TRIM(pw.pix_key), '') IS NULL THEN 'Nao informado'
      WHEN char_length(pw.pix_key) <= 4 THEN repeat('*', GREATEST(char_length(pw.pix_key) - 1, 0)) || right(pw.pix_key, 1)
      ELSE left(pw.pix_key, 2) || repeat('*', GREATEST(char_length(pw.pix_key) - 4, 2)) || right(pw.pix_key, 2)
    END AS pix_key_masked,
    pw.pix_key_type,
    pw.status,
    pw.manual_review_required,
    pw.review_reason,
    COALESCE(pw.payout_attempts, 0) AS payout_attempts,
    pw.external_payout_id,
    pw.external_status,
    pw.failed_reason,
    tx.status AS transaction_status,
    pw.created_at,
    pw.updated_at,
    pw.processing_started_at,
    pw.completed_at,
    pw.failed_at,
    pw.reviewed_at
  FROM public.pix_withdrawals pw
  LEFT JOIN public.profiles p
    ON p.id = pw.user_id
  LEFT JOIN public.transactions tx
    ON tx.id = pw.transaction_id
  WHERE COALESCE(array_length(v_statuses, 1), 0) = 0
     OR pw.status = ANY(v_statuses)
  ORDER BY
    CASE pw.status
      WHEN 'pending_manual_review' THEN 0
      WHEN 'pending' THEN 1
      WHEN 'processing' THEN 2
      WHEN 'failed' THEN 3
      WHEN 'completed' THEN 4
      ELSE 5
    END,
    pw.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_pix_withdrawals(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_pix_withdrawals(INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.admin_list_pix_withdrawals(INTEGER, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_pix_withdrawals(INTEGER, TEXT[]) TO authenticated, service_role;
