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
  v_profile RECORD;
  v_plan RECORD;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
  v_task_created TIMESTAMPTZ;
  v_task_closed BOOLEAN;
  v_task_status TEXT;
  v_category TEXT;
  v_cost NUMERIC(12,2);
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_lastname TEXT;
  v_user_city TEXT;
  v_user_state TEXT;
  v_user_phone TEXT;
  v_plan_expires_at TIMESTAMPTZ;
  v_plan_id UUID := NULL;
  v_plan_max_validations INTEGER := 0;
  v_plan_used_validations INTEGER := 0;
  v_plan_remaining_after NUMERIC(12,2) := NULL;
  v_comp_balance NUMERIC(12,2) := 0;
  v_comp_used NUMERIC(12,2) := 0;
  v_comp_remaining_after NUMERIC(12,2) := 0;
  v_plan_debit NUMERIC(12,2) := 0;
  v_justification TEXT;
  v_proof_link TEXT;
  v_validation_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  IF p_task_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Tarefa inválida');
  END IF;

  IF p_verdict IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Veredito inválido');
  END IF;

  v_justification := NULLIF(btrim(COALESCE(p_justification, '')), '');
  v_proof_link := NULLIF(btrim(COALESCE(p_proof_link, '')), '');

  IF p_verdict = TRUE THEN
    v_justification := NULL;
    v_proof_link := NULL;
  END IF;

  IF v_justification IS NOT NULL THEN
    v_justification := regexp_replace(v_justification, '[[:cntrl:]]', '', 'g');

    IF length(v_justification) > 1000 THEN
      RETURN json_build_object('status', 'error', 'message', 'Justificativa excede o limite permitido');
    END IF;

    IF v_justification ~ '<[^>]+>' THEN
      RETURN json_build_object('status', 'error', 'message', 'Justificativa inválida');
    END IF;
  END IF;

  IF p_verdict = FALSE THEN
    IF v_justification IS NULL OR length(v_justification) < 10 THEN
      RETURN json_build_object('status', 'error', 'message', 'Para marcar como falsa, informe justificativa com pelo menos 10 caracteres');
    END IF;
  END IF;

  IF v_proof_link IS NOT NULL THEN
    IF length(v_proof_link) > 1000 OR v_proof_link !~* '^https?://' THEN
      RETURN json_build_object('status', 'error', 'message', 'Link de prova inválido');
    END IF;

    IF v_proof_link ~ '[[:space:]]' THEN
      RETURN json_build_object('status', 'error', 'message', 'Link de prova inválido');
    END IF;
  END IF;

  SELECT
    content->>'category',
    cycle_start_at,
    created_at,
    COALESCE(consensus_reached, FALSE),
    COALESCE(consensus_status, 'open')
  INTO
    v_category,
    v_cycle_start,
    v_task_created,
    v_task_closed,
    v_task_status
  FROM public.news_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Tarefa não encontrada');
  END IF;

  IF v_task_closed OR COALESCE(v_task_status, 'open') <> 'open' THEN
    RETURN json_build_object('status', 'error', 'message', 'Esta notícia não está mais aberta para validação');
  END IF;

  IF v_cycle_start IS NULL THEN
    v_cycle_start := v_task_created;
  END IF;

  v_cycle_end := v_cycle_start + INTERVAL '6 days 23 hours';
  IF NOW() >= v_cycle_end THEN
    RETURN json_build_object('status', 'error', 'message', 'Este ciclo semanal já foi encerrado');
  END IF;

  v_cost := GREATEST(COALESCE(public.get_validation_cost_by_category(v_category), 1.00), 0.01);

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT || ':' || p_task_id::TEXT));

  IF EXISTS (
    SELECT 1
    FROM public.validations
    WHERE user_id = v_user_id
      AND task_id = p_task_id
  ) THEN
    RETURN json_build_object('status', 'error', 'message', 'Você já validou esta notícia');
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
    compensatory_credit_balance,
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

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  v_comp_balance := GREATEST(COALESCE(v_profile.compensatory_credit_balance, 0), 0);
  v_comp_used := LEAST(v_comp_balance, v_cost);
  v_plan_debit := GREATEST(v_cost - v_comp_used, 0);
  v_comp_remaining_after := GREATEST(v_comp_balance - v_comp_used, 0);

  IF v_plan_debit > 0.009 THEN
    SELECT *
    INTO v_plan
    FROM public.plan_purchases
    WHERE user_id = v_user_id
      AND status = 'active'
    ORDER BY started_at DESC, created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      IF v_comp_used > 0 THEN
        RETURN json_build_object('status', 'error', 'message', 'Crédito compensatório insuficiente e nenhum plano ativo encontrado');
      END IF;
      RETURN json_build_object('status', 'error', 'message', 'Nenhum plano ativo encontrado');
    END IF;

    v_plan_id := v_plan.id;
    v_plan_max_validations := COALESCE(v_plan.max_validations, 0);
    v_plan_used_validations := COALESCE(v_plan.used_validations, 0);

    v_plan_expires_at := public.get_plan_purchase_expires_at(v_plan.plan_id, v_plan.started_at);

    IF NOW() >= v_plan_expires_at THEN
      UPDATE public.plan_purchases
      SET
        status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
      WHERE id = v_plan.id;

      RETURN json_build_object('status', 'error', 'message', 'Seu pacote expirou. Compre um novo plano para continuar.');
    END IF;

    IF COALESCE(v_plan.validation_credit_remaining, 0) <= 0.009 THEN
      UPDATE public.plan_purchases
      SET
        status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
      WHERE id = v_plan.id;

      RETURN json_build_object('status', 'error', 'message', 'Você não tem notícias disponíveis para validar. Escolha um novo plano para continuar.');
    END IF;

    IF COALESCE(v_plan.validation_credit_remaining, 0) < v_plan_debit THEN
      UPDATE public.plan_purchases
      SET
        status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
      WHERE id = v_plan.id;

      RETURN json_build_object('status', 'error', 'message', 'Este pacote não tem notícias suficientes para esta validação. Compre um novo plano para continuar.');
    END IF;
  END IF;

  BEGIN
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
      v_plan_id,
      p_verdict,
      v_justification,
      v_proof_link
    )
    RETURNING id INTO v_validation_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN json_build_object('status', 'error', 'message', 'Você já validou esta notícia');
  END;

  IF v_comp_used > 0 THEN
    UPDATE public.profiles
    SET
      compensatory_credit_balance = v_comp_remaining_after,
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  IF v_plan_debit > 0.009 THEN
    v_plan_remaining_after := GREATEST(COALESCE(v_plan.validation_credit_remaining, 0) - v_plan_debit, 0);

    UPDATE public.plan_purchases
    SET
      used_validations = COALESCE(used_validations, 0) + 1,
      validation_credit_remaining = v_plan_remaining_after,
      last_validation_at = NOW(),
      updated_at = NOW(),
      status = CASE WHEN v_plan_remaining_after <= 0.009 THEN 'completed' ELSE 'active' END,
      completed_at = CASE WHEN v_plan_remaining_after <= 0.009 THEN NOW() ELSE NULL END
    WHERE id = v_plan.id
    RETURNING * INTO v_plan;

    v_plan_used_validations := COALESCE(v_plan.used_validations, 0);
    v_plan_max_validations := COALESCE(v_plan.max_validations, 0);
    v_plan_remaining_after := COALESCE(v_plan.validation_credit_remaining, 0);
  END IF;

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
    v_user_id,
    'debit',
    v_cost,
    'validations',
    v_validation_id::TEXT,
    'Consumo de notícia do pacote',
    'completed',
    v_user_id,
    jsonb_build_object(
      'task_id', p_task_id,
      'plan_purchase_id', v_plan_id,
      'verdict', p_verdict,
      'compensatory_credit_used', v_comp_used,
      'plan_credit_used', v_plan_debit,
      'compensatory_credit_remaining', v_comp_remaining_after
    )
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;

  RETURN json_build_object(
    'status', 'success',
    'validation_id', v_validation_id,
    'cost', v_cost,
    'used_validations', v_plan_used_validations,
    'max_validations', v_plan_max_validations,
    'remaining_credit', v_plan_remaining_after,
    'used_compensatory_credit', v_comp_used,
    'remaining_compensatory_credit', v_comp_remaining_after,
    'plan_credit_debited', v_plan_debit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
