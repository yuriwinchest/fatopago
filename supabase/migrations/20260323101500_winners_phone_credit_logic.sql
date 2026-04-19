ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

UPDATE public.profiles AS p
SET phone = NULLIF(REGEXP_REPLACE(COALESCE(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), '')
FROM auth.users AS u
WHERE u.id = p.id
  AND COALESCE(NULLIF(TRIM(p.phone), ''), '') = ''
  AND COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''), '') <> '';

UPDATE public.plan_purchases
SET
  status = 'completed',
  completed_at = COALESCE(completed_at, NOW()),
  updated_at = NOW()
WHERE status = 'active'
  AND COALESCE(validation_credit_remaining, 0) <= 0.009;

CREATE OR REPLACE FUNCTION public.user_has_active_seller_link()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_affiliate_code TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.seller_referrals sr
    JOIN public.sellers s
      ON s.id = sr.seller_id
     AND s.is_active = TRUE
    WHERE sr.referred_user_id = v_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  SELECT NULLIF(TRIM(affiliate_code), '')
  INTO v_affiliate_code
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_affiliate_code IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.sellers s
    WHERE s.seller_code = v_affiliate_code
      AND s.is_active = TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_active_seller_link() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_active_seller_link() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_cycle_winners(
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  cycle_offset INTEGER,
  cycle_number INTEGER,
  cycle_start_at TIMESTAMPTZ,
  cycle_end_at TIMESTAMPTZ,
  is_active BOOLEAN,
  winner_user_id UUID,
  winner_name TEXT,
  winner_lastname TEXT,
  winner_email TEXT,
  winner_phone TEXT,
  winner_city TEXT,
  winner_state TEXT,
  validations_count BIGINT,
  last_validation_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND LOWER(COALESCE(u.email, '')) = 'fatopago@gmail.com'
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH offsets AS (
    SELECT generate_series(0, GREATEST(COALESCE(p_limit, 12), 1) - 1) AS cycle_offset
  ),
  cycles AS (
    SELECT
      o.cycle_offset,
      meta.cycle_number,
      meta.cycle_start_at,
      meta.cycle_end_at,
      meta.is_active
    FROM offsets o
    CROSS JOIN LATERAL public.get_validation_cycle_meta(o.cycle_offset) AS meta
    WHERE meta.cycle_start_at IS NOT NULL
  )
  SELECT
    c.cycle_offset,
    c.cycle_number,
    c.cycle_start_at,
    c.cycle_end_at,
    c.is_active,
    r.id AS winner_user_id,
    COALESCE(p.name, r.name, 'Sem vencedor') AS winner_name,
    COALESCE(p.lastname, r.lastname, '') AS winner_lastname,
    p.email AS winner_email,
    p.phone AS winner_phone,
    COALESCE(p.city, r.city, '') AS winner_city,
    COALESCE(p.state, r.state, '') AS winner_state,
    COALESCE(r.validations_count, 0)::BIGINT AS validations_count,
    r.last_validation_at
  FROM cycles c
  LEFT JOIN LATERAL (
    SELECT rank_row.*
    FROM public.get_live_validation_ranking(NULL, NULL, 1, c.cycle_offset) AS rank_row
    ORDER BY rank_row.validations_count DESC, rank_row.last_validation_at ASC NULLS LAST
    LIMIT 1
  ) AS r ON TRUE
  LEFT JOIN public.profiles p
    ON p.id = r.id
  ORDER BY c.cycle_start_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_cycle_winners(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_cycle_winners(INTEGER) TO authenticated;

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
  v_plan_cycle_start TIMESTAMPTZ;
  v_plan_cycle_end TIMESTAMPTZ;
  v_plan_next_cycle_start TIMESTAMPTZ;
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

  SELECT cycle_start_at, cycle_end_at, next_cycle_start_at
  INTO v_plan_cycle_start
      , v_plan_cycle_end
      , v_plan_next_cycle_start
  FROM public.get_weekly_cycle_window(v_plan.started_at, 0)
  LIMIT 1;

  IF v_plan_cycle_start IS NULL THEN
    v_plan_cycle_start := v_plan.started_at;
    v_plan_cycle_end := v_plan.started_at + INTERVAL '6 days 23 hours';
    v_plan_next_cycle_start := v_plan.started_at + INTERVAL '7 days';
  END IF;

  IF v_plan.started_at >= v_plan_cycle_end AND v_plan.started_at < v_plan_next_cycle_start THEN
    v_plan_cycle_start := v_plan_next_cycle_start;
  END IF;

  IF v_plan.plan_id IN ('starter_monthly', 'pro_monthly', 'expert_monthly') THEN
    v_plan_expires_at := v_plan_cycle_start + INTERVAL '27 days 23 hours';
  ELSE
    v_plan_expires_at := v_plan_cycle_start + INTERVAL '6 days 23 hours';
  END IF;

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
