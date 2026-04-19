UPDATE public.sellers s
SET auth_user_id = u.id
FROM auth.users u
WHERE s.auth_user_id IS NULL
  AND LOWER(COALESCE(s.email, '')) = LOWER(COALESCE(u.email, ''));

CREATE OR REPLACE FUNCTION public.ensure_profile_for_auth_user(
  p_user_id UUID,
  p_fallback_name TEXT DEFAULT NULL,
  p_fallback_email TEXT DEFAULT NULL,
  p_fallback_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_name TEXT;
  v_lastname TEXT;
  v_city TEXT;
  v_state TEXT;
  v_phone TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT
    COALESCE(NULLIF(TRIM(u.email), ''), NULLIF(TRIM(COALESCE(p_fallback_email, '')), '')),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), NULLIF(TRIM(COALESCE(p_fallback_name, '')), ''), 'Usuário'),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'lastname'), ''), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'city'), ''), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'state'), ''), ''),
    NULLIF(
      REGEXP_REPLACE(
        COALESCE(
          NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''),
          NULLIF(TRIM(COALESCE(p_fallback_phone, '')), ''),
          ''
        ),
        '\D',
        '',
        'g'
      ),
      ''
    )
  INTO
    v_email,
    v_name,
    v_lastname,
    v_city,
    v_state,
    v_phone
  FROM auth.users u
  WHERE u.id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    name,
    lastname,
    city,
    state,
    reputation_score,
    current_balance,
    is_active,
    created_at,
    updated_at,
    email,
    phone,
    plan_status
  )
  VALUES (
    p_user_id,
    COALESCE(v_name, 'Usuário'),
    COALESCE(v_lastname, ''),
    COALESCE(v_city, ''),
    COALESCE(v_state, ''),
    0,
    0,
    TRUE,
    NOW(),
    NOW(),
    v_email,
    v_phone,
    'none'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = CASE
      WHEN btrim(COALESCE(public.profiles.name, '')) = '' THEN EXCLUDED.name
      ELSE public.profiles.name
    END,
    email = COALESCE(NULLIF(EXCLUDED.email, ''), public.profiles.email),
    phone = COALESCE(NULLIF(EXCLUDED.phone, ''), public.profiles.phone),
    updated_at = NOW();

  RETURN p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_profile_for_auth_user(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_profile_for_auth_user(UUID, TEXT, TEXT, TEXT) TO service_role;

SELECT public.ensure_profile_for_auth_user(
  s.auth_user_id,
  s.name,
  s.email,
  s.phone
)
FROM public.sellers s
WHERE s.auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.seller_commission_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  seller_auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan_purchase_id UUID NOT NULL UNIQUE REFERENCES public.plan_purchases(id) ON DELETE RESTRICT,
  transaction_id UUID NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seller_commission_credits_seller_idx
  ON public.seller_commission_credits (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_commission_credits_auth_user_idx
  ON public.seller_commission_credits (seller_auth_user_id, created_at DESC);

ALTER TABLE public.seller_commission_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seller_commission_credits_select_own ON public.seller_commission_credits;
CREATE POLICY seller_commission_credits_select_own
ON public.seller_commission_credits
FOR SELECT
TO authenticated
USING (auth.uid() = seller_auth_user_id);

DROP POLICY IF EXISTS seller_commission_credits_admin_select ON public.seller_commission_credits;
CREATE POLICY seller_commission_credits_admin_select
ON public.seller_commission_credits
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

CREATE OR REPLACE FUNCTION public.credit_seller_commission_for_plan_purchase(
  p_plan_purchase_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.plan_purchases%ROWTYPE;
  v_seller public.sellers%ROWTYPE;
  v_amount NUMERIC(12,2);
  v_transaction_id UUID;
  v_new_balance NUMERIC(12,2);
  v_plan_label TEXT;
BEGIN
  IF p_plan_purchase_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Plan purchase inválido');
  END IF;

  SELECT *
  INTO v_plan
  FROM public.plan_purchases
  WHERE id = p_plan_purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Plan purchase não encontrado');
  END IF;

  IF v_plan.seller_id IS NULL OR COALESCE(v_plan.status, '') = 'cancelled' THEN
    RETURN jsonb_build_object('status', 'skipped', 'message', 'Compra sem vendedor elegível');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.seller_commission_credits scc
    WHERE scc.plan_purchase_id = v_plan.id
  ) THEN
    RETURN jsonb_build_object('status', 'already_credited', 'message', 'Comissão já creditada');
  END IF;

  SELECT *
  INTO v_seller
  FROM public.sellers
  WHERE id = v_plan.seller_id
  LIMIT 1;

  IF NOT FOUND OR v_seller.auth_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'skipped', 'message', 'Vendedor sem usuário autenticável para saque');
  END IF;

  v_amount := ROUND(
    COALESCE(public.resolve_plan_purchase_amount(v_plan.plan_id, v_plan.validation_credit_total), 0) * 0.20,
    2
  );

  IF COALESCE(v_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('status', 'skipped', 'message', 'Comissão calculada zerada');
  END IF;

  PERFORM public.ensure_profile_for_auth_user(
    v_seller.auth_user_id,
    v_seller.name,
    v_seller.email,
    v_seller.phone
  );

  UPDATE public.profiles
  SET
    current_balance = COALESCE(current_balance, 0) + v_amount,
    updated_at = NOW()
  WHERE id = v_seller.auth_user_id
  RETURNING current_balance INTO v_new_balance;

  v_plan_label := CASE v_plan.plan_id
    WHEN 'starter' THEN 'Básico'
    WHEN 'pro' THEN 'Médio'
    WHEN 'expert' THEN 'Máximo'
    WHEN 'starter_weekly' THEN 'Semanal Básico'
    WHEN 'pro_weekly' THEN 'Semanal Médio'
    WHEN 'expert_weekly' THEN 'Semanal Máximo'
    WHEN 'starter_monthly' THEN 'Mensal Básico'
    WHEN 'pro_monthly' THEN 'Mensal Médio'
    WHEN 'expert_monthly' THEN 'Mensal Máximo'
    ELSE COALESCE(v_plan.plan_id, 'Plano')
  END;

  INSERT INTO public.transactions (
    user_id,
    amount,
    type,
    description,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_seller.auth_user_id,
    v_amount,
    'credit',
    'Comissão comercial do vendedor - ' || v_plan_label,
    'completed',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO public.seller_commission_credits (
    seller_id,
    seller_auth_user_id,
    referred_user_id,
    plan_purchase_id,
    transaction_id,
    amount,
    created_at,
    updated_at
  ) VALUES (
    v_seller.id,
    v_seller.auth_user_id,
    v_plan.user_id,
    v_plan.id,
    v_transaction_id,
    v_amount,
    NOW(),
    NOW()
  );

  RETURN jsonb_build_object(
    'status', 'credited',
    'seller_id', v_seller.id,
    'seller_auth_user_id', v_seller.auth_user_id,
    'plan_purchase_id', v_plan.id,
    'transaction_id', v_transaction_id,
    'amount', v_amount,
    'new_balance', COALESCE(v_new_balance, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.credit_seller_commission_for_plan_purchase(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_seller_commission_for_plan_purchase(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_seller_commission_credit_after_plan_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.seller_id IS NULL OR COALESCE(NEW.status, '') = 'cancelled' THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.credit_seller_commission_for_plan_purchase(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Falha ao creditar comissão do vendedor para plan_purchase %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_seller_commission_after_plan_purchase ON public.plan_purchases;
CREATE TRIGGER trg_credit_seller_commission_after_plan_purchase
AFTER INSERT ON public.plan_purchases
FOR EACH ROW
EXECUTE FUNCTION public.handle_seller_commission_credit_after_plan_purchase();

SELECT public.credit_seller_commission_for_plan_purchase(pp.id)
FROM public.plan_purchases pp
LEFT JOIN public.seller_commission_credits scc
  ON scc.plan_purchase_id = pp.id
WHERE pp.seller_id IS NOT NULL
  AND COALESCE(pp.status, '') <> 'cancelled'
  AND scc.id IS NULL;
