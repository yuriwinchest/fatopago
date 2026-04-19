-- Alinha fonte de verdade do limite de retry entre worker e claim RPC.
-- Evita drift de configuracao (env x SQL hardcoded) que pode deixar saque preso em processing.

DROP FUNCTION IF EXISTS public.claim_pending_pix_withdrawals(INTEGER);

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
  payout_attempts INTEGER
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
         AND pw.external_payout_id IS NULL
         AND pw.processing_started_at IS NOT NULL
         AND pw.processing_started_at < NOW() - INTERVAL '2 minutes'
         AND COALESCE(pw.payout_attempts, 0) < v_max_retries
       )
    ORDER BY
      CASE WHEN pw.status = 'pending' THEN 0 ELSE 1 END,
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
    RETURNING pw.id, pw.user_id, pw.amount, pw.pix_key, pw.pix_key_type, pw.idempotency_key, pw.payout_attempts
  )
  SELECT
    c.id,
    c.user_id,
    c.amount,
    c.pix_key,
    c.pix_key_type,
    c.idempotency_key,
    c.payout_attempts
  FROM claimed c;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_pix_withdrawals(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_pix_withdrawals(INTEGER, INTEGER) TO service_role;
