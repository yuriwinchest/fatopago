ALTER TABLE public.pix_payments
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS superseded_by_mp_payment_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS superseded_reason TEXT NULL;

COMMENT ON COLUMN public.pix_payments.superseded_at IS 'Momento em que o PIX foi substituído por um checkout mais recente.';
COMMENT ON COLUMN public.pix_payments.superseded_by_mp_payment_id IS 'mp_payment_id do checkout mais recente que substituiu este PIX.';
COMMENT ON COLUMN public.pix_payments.superseded_reason IS 'Motivo operacional da substituição do PIX antes da ativação.';

CREATE INDEX IF NOT EXISTS pix_payments_user_pending_created_idx
  ON public.pix_payments (user_id, created_at DESC)
  WHERE plan_activated_at IS NULL
    AND status IN ('pending', 'in_process');

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

  IF v_payment.superseded_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'superseded',
      'message', 'Pagamento substituído por um PIX mais recente'
    );
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
