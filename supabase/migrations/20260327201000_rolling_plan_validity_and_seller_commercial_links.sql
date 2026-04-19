CREATE OR REPLACE FUNCTION public.get_plan_purchase_expires_at(
  p_plan_id TEXT,
  p_started_at TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_period TEXT;
BEGIN
  IF p_started_at IS NULL THEN
    RETURN NOW();
  END IF;

  SELECT pc.period
  INTO v_period
  FROM public.plan_catalog pc
  WHERE pc.plan_id = p_plan_id
    AND pc.is_active = TRUE
  LIMIT 1;

  CASE COALESCE(v_period, '')
    WHEN 'monthly' THEN
      RETURN p_started_at + INTERVAL '1 month';
    WHEN 'weekly' THEN
      RETURN p_started_at + INTERVAL '7 days';
    ELSE
      RETURN p_started_at + INTERVAL '1 day';
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.get_plan_purchase_expires_at(TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_plan_purchase_expires_at(TEXT, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_campaign_attributed_plan_id(p_plan_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.plan_catalog pc
    WHERE pc.plan_id = p_plan_id
      AND pc.is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_campaign_attributed_plan_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_campaign_attributed_plan_id(TEXT) TO authenticated;

UPDATE public.pix_payments px
SET
  seller_id = sr.seller_id,
  seller_referral_id = sr.id,
  seller_source = sr.source
FROM public.seller_referrals sr
WHERE px.user_id = sr.referred_user_id
  AND px.seller_id IS NULL
  AND public.is_campaign_attributed_plan_id(px.plan_id)
  AND px.created_at >= sr.campaign_enabled_at;

UPDATE public.plan_purchases pp
SET
  seller_id = sr.seller_id,
  seller_referral_id = sr.id,
  seller_source = sr.source
FROM public.seller_referrals sr
WHERE pp.user_id = sr.referred_user_id
  AND pp.seller_id IS NULL
  AND public.is_campaign_attributed_plan_id(pp.plan_id)
  AND pp.created_at >= sr.campaign_enabled_at;

CREATE OR REPLACE FUNCTION public.submit_validation(
  p_task_id UUID,
  p_verdict BOOLEAN,
  p_justification TEXT DEFAULT NULL,
  p_proof_link TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_plan RECORD;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
  v_task_created TIMESTAMPTZ;
  v_category TEXT;
  v_cost NUMERIC(12,2);
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_lastname TEXT;
  v_user_city TEXT;
  v_user_state TEXT;
  v_user_phone TEXT;
  v_plan_expires_at TIMESTAMPTZ;
  v_remaining_after NUMERIC(12,2);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  SELECT
    u.email,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), 'Usuário'),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'lastname'), ''), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'city'), ''), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'state'), ''), ''),
    NULLIF(REGEXP_REPLACE(COALESCE(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), '')
  INTO
    v_user_email,
    v_user_name,
    v_user_lastname,
    v_user_city,
    v_user_state,
    v_user_phone
  FROM auth.users u
  WHERE u.id = v_user_id;

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
    v_user_id,
    COALESCE(v_user_name, 'Usuário'),
    COALESCE(v_user_lastname, ''),
    COALESCE(v_user_city, ''),
    COALESCE(v_user_state, ''),
    0,
    0,
    TRUE,
    NOW(),
    NOW(),
    v_user_email,
    v_user_phone,
    'none'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = NOW();

  SELECT content->>'category', cycle_start_at, created_at
  INTO v_category, v_cycle_start, v_task_created
  FROM public.news_tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Tarefa não encontrada');
  END IF;

  IF v_cycle_start IS NULL THEN
    v_cycle_start := v_task_created;
  END IF;

  v_cycle_end := v_cycle_start + INTERVAL '6 days 23 hours';
  IF NOW() >= v_cycle_end THEN
    RETURN json_build_object('status', 'error', 'message', 'Este ciclo semanal já foi encerrado');
  END IF;

  v_cost := GREATEST(COALESCE(public.get_validation_cost_by_category(v_category), 0.75), 0.01);

  SELECT *
  INTO v_plan
  FROM public.plan_purchases
  WHERE user_id = v_user_id
    AND status = 'active'
  ORDER BY started_at DESC, created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Nenhum plano ativo encontrado');
  END IF;

  v_plan_expires_at := public.get_plan_purchase_expires_at(v_plan.plan_id, v_plan.started_at);

  IF NOW() >= v_plan_expires_at THEN
    UPDATE public.plan_purchases
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
    WHERE id = v_plan.id;

    RETURN json_build_object('status', 'error', 'message', 'Seu saldo expirou. Compre um novo plano para continuar.');
  END IF;

  IF COALESCE(v_plan.validation_credit_remaining, 0) <= 0.009 THEN
    UPDATE public.plan_purchases
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
    WHERE id = v_plan.id;

    RETURN json_build_object('status', 'error', 'message', 'Você não tem saldo para validar. Escolha um novo plano para continuar.');
  END IF;

  IF COALESCE(v_plan.validation_credit_remaining, 0) < v_cost THEN
    UPDATE public.plan_purchases
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
    WHERE id = v_plan.id;

    RETURN json_build_object('status', 'error', 'message', 'Saldo insuficiente para esta notícia. Compre um novo plano para continuar.');
  END IF;

  v_remaining_after := GREATEST(COALESCE(v_plan.validation_credit_remaining, 0) - v_cost, 0);

  UPDATE public.plan_purchases
  SET
    used_validations = COALESCE(used_validations, 0) + 1,
    validation_credit_remaining = v_remaining_after,
    last_validation_at = NOW(),
    updated_at = NOW(),
    status = CASE WHEN v_remaining_after <= 0.009 THEN 'completed' ELSE 'active' END,
    completed_at = CASE WHEN v_remaining_after <= 0.009 THEN NOW() ELSE NULL END
  WHERE id = v_plan.id
  RETURNING * INTO v_plan;

  INSERT INTO public.validations (
    task_id,
    user_id,
    plan_purchase_id,
    verdict,
    justification,
    proof_link
  ) VALUES (
    p_task_id,
    v_user_id,
    v_plan.id,
    p_verdict,
    p_justification,
    p_proof_link
  );

  UPDATE public.profiles
  SET
    reputation_score = COALESCE(reputation_score, 0) + 10,
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN json_build_object(
    'status', 'success',
    'cost', v_cost,
    'used_validations', v_plan.used_validations,
    'max_validations', v_plan.max_validations,
    'remaining_credit', v_plan.validation_credit_remaining
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

