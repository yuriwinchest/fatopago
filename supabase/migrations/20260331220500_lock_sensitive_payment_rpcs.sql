-- Lock sensitive payment RPCs so end-users cannot invoke activation/reversal paths directly.

CREATE OR REPLACE FUNCTION public.expire_stale_pix_payments(
  p_limit INTEGER DEFAULT 200
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH candidates AS (
    SELECT id
    FROM public.pix_payments
    WHERE plan_activated_at IS NULL
      AND status IN ('pending', 'in_process')
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    ORDER BY expires_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 200), 1)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.pix_payments px
  SET
    status = 'expired',
    updated_at = NOW()
  FROM candidates c
  WHERE px.id = c.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_pix_payments(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_pix_payments(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.activate_pix_payment(
  p_mp_payment_id TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.pix_payments%ROWTYPE;
  v_existing_active public.plan_purchases%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_plan_purchase_id UUID;
  v_max_validations INTEGER;
  v_has_credit_counter BOOLEAN;
  v_is_exhausted BOOLEAN;
  v_is_expired BOOLEAN;
BEGIN
  IF p_mp_payment_id IS NULL OR btrim(p_mp_payment_id) = '' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Pagamento inválido');
  END IF;

  SELECT *
  INTO v_payment
  FROM public.pix_payments
  WHERE mp_payment_id = btrim(p_mp_payment_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Pagamento não encontrado');
  END IF;

  IF NOT (
    COALESCE(auth.role(), '') = 'service_role'
    OR public.is_admin_user(auth.uid())
    OR auth.uid() = v_payment.user_id
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Acesso negado');
  END IF;

  IF p_user_id IS NOT NULL AND v_payment.user_id <> p_user_id THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Pagamento inválido');
  END IF;

  IF v_payment.plan_activated_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_activated', 'message', 'Pagamento já ativado');
  END IF;

  IF COALESCE(v_payment.amount, 0) <= 0 OR COALESCE(v_payment.plan_id, '') = '' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Pagamento inválido');
  END IF;

  IF COALESCE(LOWER(v_payment.status), '') NOT IN ('approved', 'paid', 'completed', 'authorized', 'active') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Pagamento ainda não aprovado');
  END IF;

  SELECT *
  INTO v_existing_active
  FROM public.plan_purchases
  WHERE user_id = v_payment.user_id
    AND status = 'active'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_has_credit_counter := v_existing_active.validation_credit_remaining IS NOT NULL;

    v_is_exhausted :=
      CASE
        WHEN v_has_credit_counter THEN COALESCE(v_existing_active.validation_credit_remaining, 0) <= 0.009
        ELSE COALESCE(v_existing_active.max_validations, 0) > 0
          AND COALESCE(v_existing_active.used_validations, 0) >= COALESCE(v_existing_active.max_validations, 0)
      END;

    v_is_expired :=
      v_existing_active.started_at IS NOT NULL
      AND public.get_plan_purchase_expires_at(v_existing_active.plan_id, v_existing_active.started_at) <= v_now;

    IF v_is_exhausted OR v_is_expired THEN
      UPDATE public.plan_purchases
      SET status = 'completed',
          completed_at = v_now,
          updated_at = v_now
      WHERE id = v_existing_active.id;
    ELSE
      RETURN jsonb_build_object(
        'status', 'blocked_active_plan',
        'message', 'Usuário já possui um pacote ativo'
      );
    END IF;
  END IF;

  v_max_validations := GREATEST(FLOOR(v_payment.amount / 0.60)::INTEGER, 6);

  INSERT INTO public.plan_purchases (
    user_id,
    plan_id,
    status,
    max_validations,
    used_validations,
    validation_credit_total,
    validation_credit_remaining,
    seller_id,
    seller_referral_id,
    seller_source,
    started_at,
    updated_at
  ) VALUES (
    v_payment.user_id,
    v_payment.plan_id,
    'active',
    v_max_validations,
    0,
    v_payment.amount,
    v_payment.amount,
    v_payment.seller_id,
    v_payment.seller_referral_id,
    v_payment.seller_source,
    v_now,
    v_now
  )
  RETURNING id INTO v_plan_purchase_id;

  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_payment.user_id,
    v_payment.amount,
    'debit',
    'Compra Plano ' || upper(left(v_payment.plan_id, 1)) || substring(v_payment.plan_id from 2) || ' (PIX)',
    'completed',
    v_now,
    v_now
  );

  UPDATE public.pix_payments
  SET
    plan_activated_at = v_now,
    activated_plan_purchase_id = v_plan_purchase_id,
    updated_at = v_now
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'status', 'activated',
    'message', 'Pagamento ativado com sucesso',
    'plan_purchase_id', v_plan_purchase_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_pix_payment(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_pix_payment(TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.process_pix_payment_reversal(
  p_mp_payment_id TEXT,
  p_reversal_status TEXT DEFAULT 'refunded',
  p_reversal_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.pix_payments%ROWTYPE;
  v_plan public.plan_purchases%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_status TEXT := LOWER(COALESCE(p_reversal_status, 'refunded'));
BEGIN
  IF p_mp_payment_id IS NULL OR btrim(p_mp_payment_id) = '' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Pagamento inválido');
  END IF;

  SELECT *
  INTO v_payment
  FROM public.pix_payments
  WHERE mp_payment_id = btrim(p_mp_payment_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Pagamento não encontrado');
  END IF;

  IF NOT (
    COALESCE(auth.role(), '') = 'service_role'
    OR public.is_admin_user(auth.uid())
    OR auth.uid() = v_payment.user_id
  ) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Acesso negado');
  END IF;

  IF v_payment.reversal_processed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_processed', 'message', 'Estorno já processado');
  END IF;

  IF v_payment.plan_activated_at IS NULL THEN
    UPDATE public.pix_payments
    SET
      reversal_processed_at = v_now,
      reversal_reason = LEFT(COALESCE(NULLIF(TRIM(p_reversal_reason), ''), v_status), 240),
      updated_at = v_now
    WHERE id = v_payment.id;

    RETURN jsonb_build_object('status', 'recorded_without_activation', 'message', 'Estorno registrado sem plano ativo');
  END IF;

  IF v_payment.activated_plan_purchase_id IS NOT NULL THEN
    SELECT *
    INTO v_plan
    FROM public.plan_purchases
    WHERE id = v_payment.activated_plan_purchase_id
      AND user_id = v_payment.user_id
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    SELECT *
    INTO v_plan
    FROM public.plan_purchases
    WHERE user_id = v_payment.user_id
      AND plan_id = v_payment.plan_id
      AND started_at >= (v_payment.plan_activated_at - INTERVAL '5 minutes')
    ORDER BY started_at ASC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF FOUND AND v_plan.status = 'active' THEN
    UPDATE public.plan_purchases
    SET
      status = 'cancelled',
      completed_at = COALESCE(completed_at, v_now),
      validation_credit_remaining = 0,
      updated_at = v_now
    WHERE id = v_plan.id;
  END IF;

  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_payment.user_id,
    v_payment.amount,
    'debit',
    'Estorno/MED PIX (' || v_status || ')',
    'completed',
    v_now,
    v_now
  );

  UPDATE public.pix_payments
  SET
    reversal_processed_at = v_now,
    reversal_reason = LEFT(COALESCE(NULLIF(TRIM(p_reversal_reason), ''), v_status), 240),
    updated_at = v_now
  WHERE id = v_payment.id;

  RETURN jsonb_build_object(
    'status', 'reversed',
    'message', 'Estorno processado com sucesso',
    'plan_purchase_id', v_plan.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_pix_payment_reversal(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_pix_payment_reversal(TEXT, TEXT, TEXT) TO service_role;
