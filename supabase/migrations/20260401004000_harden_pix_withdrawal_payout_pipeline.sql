-- Harden payout pipeline for PIX withdrawals:
-- 1) explicit withdrawal state machine (including manual review quarantine)
-- 2) idempotency metadata for external payout provider
-- 3) async worker claim RPC + atomic reconciliation/compensation RPCs

ALTER TABLE public.pix_withdrawals
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS compensation_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS external_payout_id TEXT,
  ADD COLUMN IF NOT EXISTS external_status TEXT,
  ADD COLUMN IF NOT EXISTS external_response JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS payout_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS failed_reason TEXT,
  ADD COLUMN IF NOT EXISTS manual_review_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.pix_withdrawals
SET idempotency_key = COALESCE(NULLIF(TRIM(idempotency_key), ''), id::TEXT)
WHERE idempotency_key IS NULL OR TRIM(idempotency_key) = '';

ALTER TABLE public.pix_withdrawals
  ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pix_withdrawals_idempotency_key_idx
  ON public.pix_withdrawals (idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS pix_withdrawals_external_payout_id_idx
  ON public.pix_withdrawals (external_payout_id)
  WHERE external_payout_id IS NOT NULL;

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT c.conname
  INTO v_constraint_name
  FROM pg_constraint c
  WHERE c.conrelid = 'public.pix_withdrawals'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%'
    AND pg_get_constraintdef(c.oid) ILIKE '%pending%'
  ORDER BY c.conname
  LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pix_withdrawals DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.pix_withdrawals
  ADD CONSTRAINT pix_withdrawals_status_check
  CHECK (
    status IN (
      'pending',
      'pending_manual_review',
      'processing',
      'completed',
      'failed',
      'cancelled'
    )
  );

DROP INDEX IF EXISTS public.pix_withdrawals_user_single_open_idx;
CREATE UNIQUE INDEX pix_withdrawals_user_single_open_idx
  ON public.pix_withdrawals (user_id)
  WHERE status IN ('pending', 'pending_manual_review', 'processing');

CREATE OR REPLACE FUNCTION public.request_pix_withdrawal(
  p_amount NUMERIC,
  p_pix_key TEXT,
  p_pix_key_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_withdrawal_id UUID;
  v_transaction_id UUID;
  v_amount NUMERIC(12,2);
  v_pix_key_type TEXT;
  v_pix_key TEXT;
  v_digits TEXT;
  v_manual_review_threshold NUMERIC(12,2) := 500.00;
  v_recent_requests_24h INTEGER := 0;
  v_requires_manual_review BOOLEAN := FALSE;
  v_review_reason TEXT := NULL;
  v_initial_status TEXT := 'pending';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  IF p_amount IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Valor inválido');
  END IF;

  v_amount := round(p_amount::NUMERIC, 2);
  IF v_amount < 10 OR abs(v_amount - p_amount) > 0.000001 THEN
    RETURN json_build_object('status', 'error', 'message', 'Valor inválido');
  END IF;

  v_pix_key_type := lower(btrim(COALESCE(p_pix_key_type, '')));
  IF v_pix_key_type NOT IN ('cpf', 'cnpj', 'email', 'phone', 'random') THEN
    RETURN json_build_object('status', 'error', 'message', 'Tipo de chave PIX inválido');
  END IF;

  v_pix_key := btrim(COALESCE(p_pix_key, ''));
  IF v_pix_key = '' OR char_length(v_pix_key) > 160 THEN
    RETURN json_build_object('status', 'error', 'message', 'Chave PIX inválida');
  END IF;

  CASE v_pix_key_type
    WHEN 'cpf', 'cnpj' THEN
      v_digits := regexp_replace(v_pix_key, '\D', '', 'g');
      IF char_length(v_digits) = 11 THEN
        IF NOT public.is_valid_brazilian_cpf(v_digits) THEN
          RETURN json_build_object('status', 'error', 'message', 'CPF PIX inválido');
        END IF;
      ELSIF char_length(v_digits) = 14 THEN
        -- Aceita CNPJ em cenário onde a chave é informada com tipo legado "cpf".
        NULL;
      ELSE
        RETURN json_build_object('status', 'error', 'message', 'CPF/CNPJ PIX inválido');
      END IF;
      v_pix_key := v_digits;

    WHEN 'email' THEN
      v_pix_key := lower(v_pix_key);
      IF v_pix_key !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
        RETURN json_build_object('status', 'error', 'message', 'E-mail PIX inválido');
      END IF;

    WHEN 'phone' THEN
      v_digits := regexp_replace(v_pix_key, '\D', '', 'g');
      IF v_digits ~ '^55\d{10,11}$' THEN
        v_pix_key := '+' || v_digits;
      ELSIF v_digits ~ '^\d{10,11}$' THEN
        v_pix_key := '+55' || v_digits;
      ELSE
        RETURN json_build_object('status', 'error', 'message', 'Telefone PIX inválido');
      END IF;

    WHEN 'random' THEN
      v_pix_key := lower(v_pix_key);
      IF v_pix_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RETURN json_build_object('status', 'error', 'message', 'Chave aleatória PIX inválida');
      END IF;
  END CASE;

  -- Serialize withdrawals per user on profile row to avoid concurrent drains.
  SELECT current_balance
  INTO v_current_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Perfil não encontrado');
  END IF;

  -- One open withdrawal per user at a time.
  IF EXISTS (
    SELECT 1
    FROM public.pix_withdrawals
    WHERE user_id = v_user_id
      AND status IN ('pending', 'pending_manual_review', 'processing')
    LIMIT 1
  ) THEN
    RETURN json_build_object('status', 'error', 'message', 'Já existe um saque PIX em processamento');
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  IF v_current_balance < v_amount THEN
    RETURN json_build_object('status', 'error', 'message', 'Saldo insuficiente');
  END IF;

  SELECT COUNT(*)
  INTO v_recent_requests_24h
  FROM public.pix_withdrawals
  WHERE user_id = v_user_id
    AND created_at >= NOW() - INTERVAL '24 hours';

  IF v_amount >= v_manual_review_threshold THEN
    v_requires_manual_review := TRUE;
    v_review_reason := format(
      'Valor acima do limite automático de R$ %s',
      to_char(v_manual_review_threshold, 'FM999999990D00')
    );
  END IF;

  IF v_recent_requests_24h >= 3 THEN
    v_requires_manual_review := TRUE;
    v_review_reason := COALESCE(v_review_reason || ' | ', '') ||
      format('Padrão atípico: %s solicitações nas últimas 24h', v_recent_requests_24h);
  END IF;

  IF v_requires_manual_review THEN
    v_initial_status := 'pending_manual_review';
  END IF;

  v_new_balance := v_current_balance - v_amount;

  UPDATE public.profiles
  SET current_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_user_id;

  v_withdrawal_id := gen_random_uuid();

  INSERT INTO public.pix_withdrawals (
    id,
    user_id,
    amount,
    pix_key,
    pix_key_type,
    status,
    idempotency_key,
    manual_review_required,
    review_reason,
    created_at,
    updated_at
  ) VALUES (
    v_withdrawal_id,
    v_user_id,
    v_amount,
    v_pix_key,
    v_pix_key_type,
    v_initial_status,
    v_withdrawal_id::TEXT,
    v_requires_manual_review,
    CASE WHEN v_requires_manual_review THEN LEFT(v_review_reason, 240) ELSE NULL END,
    NOW(),
    NOW()
  );

  INSERT INTO public.transactions (
    user_id, amount, type, description, status, created_at, updated_at
  ) VALUES (
    v_user_id,
    v_amount,
    'debit',
    'Saque PIX (solicitacao)',
    'pending',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  UPDATE public.pix_withdrawals
  SET transaction_id = v_transaction_id,
      updated_at = NOW()
  WHERE id = v_withdrawal_id;

  RETURN json_build_object(
    'status', 'success',
    'withdrawal_id', v_withdrawal_id,
    'new_balance', v_new_balance,
    'withdrawal_status', v_initial_status,
    'manual_review_required', v_requires_manual_review,
    'review_reason', CASE WHEN v_requires_manual_review THEN LEFT(v_review_reason, 240) ELSE NULL END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_pending_pix_withdrawals(
  p_limit INTEGER DEFAULT 25
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
         AND COALESCE(pw.payout_attempts, 0) < 8
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

CREATE OR REPLACE FUNCTION public.reconcile_pix_withdrawal(
  p_withdrawal_id UUID,
  p_target_status TEXT,
  p_external_payout_id TEXT DEFAULT NULL,
  p_external_status TEXT DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL,
  p_external_response JSONB DEFAULT '{}'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal public.pix_withdrawals%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_target_status TEXT := LOWER(COALESCE(p_target_status, ''));
  v_compensation_tx_id UUID := NULL;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Acesso negado');
  END IF;

  IF p_withdrawal_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Saque inválido');
  END IF;

  IF v_target_status NOT IN ('processing', 'completed', 'failed') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Status de reconciliação inválido');
  END IF;

  SELECT *
  INTO v_withdrawal
  FROM public.pix_withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Saque não encontrado');
  END IF;

  IF v_target_status = 'processing' THEN
    IF v_withdrawal.status IN ('completed', 'failed', 'cancelled') THEN
      RETURN jsonb_build_object(
        'status',
        CASE WHEN v_withdrawal.status = 'completed' THEN 'already_completed' ELSE 'already_failed' END,
        'message', 'Saque já finalizado'
      );
    END IF;

    UPDATE public.pix_withdrawals
    SET
      status = 'processing',
      processing_started_at = COALESCE(processing_started_at, v_now),
      external_payout_id = COALESCE(NULLIF(TRIM(p_external_payout_id), ''), external_payout_id),
      external_status = COALESCE(NULLIF(TRIM(p_external_status), ''), external_status),
      external_response = COALESCE(p_external_response, '{}'::JSONB),
      updated_at = v_now
    WHERE id = v_withdrawal.id;

    RETURN jsonb_build_object('status', 'processing', 'message', 'Saque marcado como processing');
  END IF;

  IF v_target_status = 'completed' THEN
    IF v_withdrawal.status = 'completed' THEN
      RETURN jsonb_build_object('status', 'already_completed', 'message', 'Saque já concluído');
    END IF;

    IF v_withdrawal.status IN ('failed', 'cancelled') THEN
      RETURN jsonb_build_object('status', 'already_failed', 'message', 'Saque já finalizado como falha');
    END IF;

    UPDATE public.pix_withdrawals
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, v_now),
      failed_at = NULL,
      failed_reason = NULL,
      external_payout_id = COALESCE(NULLIF(TRIM(p_external_payout_id), ''), external_payout_id),
      external_status = COALESCE(NULLIF(TRIM(p_external_status), ''), external_status),
      external_response = COALESCE(p_external_response, '{}'::JSONB),
      updated_at = v_now
    WHERE id = v_withdrawal.id;

    IF v_withdrawal.transaction_id IS NOT NULL THEN
      UPDATE public.transactions
      SET status = 'completed',
          updated_at = v_now
      WHERE id = v_withdrawal.transaction_id;
    ELSE
      WITH tx AS (
        SELECT id
        FROM public.transactions
        WHERE user_id = v_withdrawal.user_id
          AND type = 'debit'
          AND description = 'Saque PIX (solicitacao)'
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      )
      UPDATE public.transactions t
      SET status = 'completed',
          updated_at = v_now
      FROM tx
      WHERE t.id = tx.id;
    END IF;

    RETURN jsonb_build_object('status', 'completed', 'message', 'Saque concluído com sucesso');
  END IF;

  -- failed
  IF v_withdrawal.status = 'failed' THEN
    RETURN jsonb_build_object(
      'status', 'already_failed',
      'message', 'Saque já marcado como falha',
      'compensation_transaction_id', v_withdrawal.compensation_transaction_id
    );
  END IF;

  IF v_withdrawal.status = 'completed' THEN
    RETURN jsonb_build_object('status', 'already_completed', 'message', 'Saque já concluído');
  END IF;

  v_compensation_tx_id := v_withdrawal.compensation_transaction_id;

  IF v_compensation_tx_id IS NULL THEN
    UPDATE public.profiles
    SET current_balance = COALESCE(current_balance, 0) + COALESCE(v_withdrawal.amount, 0),
        updated_at = v_now
    WHERE id = v_withdrawal.user_id;

    INSERT INTO public.transactions (
      user_id,
      amount,
      type,
      description,
      status,
      created_at,
      updated_at
    ) VALUES (
      v_withdrawal.user_id,
      COALESCE(v_withdrawal.amount, 0),
      'credit',
      'Estorno Saque PIX (falha)',
      'completed',
      v_now,
      v_now
    )
    RETURNING id INTO v_compensation_tx_id;
  END IF;

  UPDATE public.pix_withdrawals
  SET
    status = 'failed',
    failed_at = COALESCE(failed_at, v_now),
    failed_reason = LEFT(
      COALESCE(NULLIF(TRIM(p_failure_reason), ''), 'Falha ao processar saque PIX'),
      240
    ),
    compensation_transaction_id = COALESCE(compensation_transaction_id, v_compensation_tx_id),
    external_payout_id = COALESCE(NULLIF(TRIM(p_external_payout_id), ''), external_payout_id),
    external_status = COALESCE(NULLIF(TRIM(p_external_status), ''), external_status),
    external_response = COALESCE(p_external_response, '{}'::JSONB),
    updated_at = v_now
  WHERE id = v_withdrawal.id;

  IF v_withdrawal.transaction_id IS NOT NULL THEN
    UPDATE public.transactions
    SET status = 'failed',
        updated_at = v_now
    WHERE id = v_withdrawal.transaction_id;
  ELSE
    WITH tx AS (
      SELECT id
      FROM public.transactions
      WHERE user_id = v_withdrawal.user_id
        AND type = 'debit'
        AND description = 'Saque PIX (solicitacao)'
        AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    )
    UPDATE public.transactions t
    SET status = 'failed',
        updated_at = v_now
    FROM tx
    WHERE t.id = tx.id;
  END IF;

  RETURN jsonb_build_object(
    'status', 'failed',
    'message', 'Saque marcado como falha e saldo compensado',
    'compensation_transaction_id', v_compensation_tx_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_pix_withdrawal_manual_review(
  p_withdrawal_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal public.pix_withdrawals%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Acesso negado');
  END IF;

  SELECT *
  INTO v_withdrawal
  FROM public.pix_withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Saque não encontrado');
  END IF;

  IF v_withdrawal.status <> 'pending_manual_review' THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', format('Status inválido para aprovação manual: %s', v_withdrawal.status)
    );
  END IF;

  UPDATE public.pix_withdrawals
  SET
    status = 'pending',
    reviewed_at = v_now,
    reviewed_by = auth.uid(),
    updated_at = v_now
  WHERE id = v_withdrawal.id;

  RETURN jsonb_build_object('status', 'approved', 'message', 'Saque liberado para processamento automático');
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_pix_withdrawal_manual_review(
  p_withdrawal_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Acesso negado');
  END IF;

  v_result := public.reconcile_pix_withdrawal(
    p_withdrawal_id,
    'failed',
    NULL,
    'manual_rejected',
    COALESCE(NULLIF(TRIM(p_reason), ''), 'Saque rejeitado em revisão manual'),
    jsonb_build_object('source', 'manual_review')
  );

  UPDATE public.pix_withdrawals
  SET
    reviewed_at = COALESCE(reviewed_at, NOW()),
    reviewed_by = COALESCE(reviewed_by, auth.uid()),
    updated_at = NOW()
  WHERE id = p_withdrawal_id
    AND status = 'failed';

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.request_pix_withdrawal(NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_pix_withdrawal(NUMERIC, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_pending_pix_withdrawals(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_pix_withdrawals(INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.reconcile_pix_withdrawal(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_pix_withdrawal(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.approve_pix_withdrawal_manual_review(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_pix_withdrawal_manual_review(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.reject_pix_withdrawal_manual_review(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_pix_withdrawal_manual_review(UUID, TEXT) TO authenticated, service_role;
