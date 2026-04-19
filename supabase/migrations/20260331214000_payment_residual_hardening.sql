-- Residual hardening for payment flow:
-- 1) automatic stale PIX expiration helper
-- 2) MED/refund reversal handling
-- 3) immutable financial ledger (append-only)
-- 4) strict table grants (authenticated cannot INSERT/UPDATE/DELETE in financial tables)

ALTER TABLE public.pix_payments
  ADD COLUMN IF NOT EXISTS activated_plan_purchase_id UUID REFERENCES public.plan_purchases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversal_processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

CREATE INDEX IF NOT EXISTS pix_payments_pending_expiry_idx
  ON public.pix_payments (status, expires_at)
  WHERE plan_activated_at IS NULL;

CREATE INDEX IF NOT EXISTS pix_payments_activated_purchase_idx
  ON public.pix_payments (activated_plan_purchase_id);

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
GRANT EXECUTE ON FUNCTION public.expire_stale_pix_payments(INTEGER) TO authenticated, service_role;

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
GRANT EXECUTE ON FUNCTION public.activate_pix_payment(TEXT, UUID) TO authenticated, service_role;

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
GRANT EXECUTE ON FUNCTION public.process_pix_payment_reversal(TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.financial_ledger (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'debit', 'adjustment')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency_code TEXT NOT NULL DEFAULT 'BRL',
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  transaction_status TEXT,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT financial_ledger_source_unique UNIQUE (source_table, source_id)
);

CREATE INDEX IF NOT EXISTS financial_ledger_user_created_idx
  ON public.financial_ledger (user_id, created_at DESC);

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_ledger_select_own ON public.financial_ledger;
CREATE POLICY financial_ledger_select_own
ON public.financial_ledger
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS financial_ledger_admin_select ON public.financial_ledger;
CREATE POLICY financial_ledger_admin_select
ON public.financial_ledger
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.prevent_financial_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'financial_ledger é append-only e não permite %', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_financial_ledger_immutable ON public.financial_ledger;
CREATE TRIGGER trg_financial_ledger_immutable
BEFORE UPDATE OR DELETE ON public.financial_ledger
FOR EACH ROW
EXECUTE FUNCTION public.prevent_financial_ledger_mutation();

CREATE OR REPLACE FUNCTION public.capture_transaction_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.financial_ledger (
    user_id,
    entry_type,
    amount,
    source_table,
    source_id,
    description,
    transaction_status,
    actor_user_id,
    metadata
  )
  VALUES (
    NEW.user_id,
    CASE WHEN NEW.type = 'credit' THEN 'credit' ELSE 'debit' END,
    COALESCE(NEW.amount, 0),
    'transactions',
    NEW.id::TEXT,
    COALESCE(NEW.description, ''),
    COALESCE(NEW.status, ''),
    COALESCE(auth.uid(), NEW.user_id),
    jsonb_build_object(
      'transaction_type', NEW.type,
      'transaction_created_at', NEW.created_at
    )
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_transaction_to_ledger ON public.transactions;
CREATE TRIGGER trg_capture_transaction_to_ledger
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.capture_transaction_to_ledger();

REVOKE INSERT, UPDATE, DELETE ON TABLE public.transactions FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.pix_payments FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.pix_withdrawals FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.plan_purchases FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.financial_ledger FROM authenticated, anon;

GRANT SELECT ON TABLE public.transactions TO authenticated;
GRANT SELECT ON TABLE public.pix_payments TO authenticated;
GRANT SELECT ON TABLE public.pix_withdrawals TO authenticated;
GRANT SELECT ON TABLE public.plan_purchases TO authenticated;
GRANT SELECT ON TABLE public.financial_ledger TO authenticated;
