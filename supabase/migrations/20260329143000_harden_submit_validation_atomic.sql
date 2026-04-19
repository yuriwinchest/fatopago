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
  v_justification TEXT;
  v_proof_link TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  v_justification := NULLIF(btrim(COALESCE(p_justification, '')), '');
  v_proof_link := NULLIF(btrim(COALESCE(p_proof_link, '')), '');

  IF v_justification IS NOT NULL THEN
    v_justification := regexp_replace(v_justification, '[[:cntrl:]]', '', 'g');

    IF length(v_justification) > 1000 THEN
      RETURN json_build_object('status', 'error', 'message', 'Justificativa excede o limite permitido');
    END IF;

    IF v_justification ~ '<[^>]+>' THEN
      RETURN json_build_object('status', 'error', 'message', 'Justificativa inválida');
    END IF;
  END IF;

  IF v_proof_link IS NOT NULL THEN
    IF length(v_proof_link) > 1000 OR v_proof_link !~* '^https?://' THEN
      RETURN json_build_object('status', 'error', 'message', 'Link de prova inválido');
    END IF;
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
  LIMIT 1
  FOR UPDATE;

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
    v_justification,
    v_proof_link
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
