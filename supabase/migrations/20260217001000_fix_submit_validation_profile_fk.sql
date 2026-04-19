-- Fix validation FK errors when user exists in auth.users but profile row is missing.
-- validations.user_id references public.profiles(id), so we must guarantee profile exists.

-- 1) Backfill missing profile rows for already registered auth users.
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
  plan_status
)
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), 'Usuário'),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'lastname'), ''), ''),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'city'), ''), ''),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'state'), ''), ''),
  0,
  0,
  TRUE,
  COALESCE(u.created_at, NOW()),
  NOW(),
  u.email,
  'none'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

-- 2) Replace submit_validation with profile guard before insert into validations.
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
  v_task_created TIMESTAMPTZ;
  v_category TEXT;
  v_cost NUMERIC(12,2);
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_lastname TEXT;
  v_user_city TEXT;
  v_user_state TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  -- Guarantee profile row exists for this auth user to satisfy validations_user_id_fkey.
  SELECT
    u.email,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), 'Usuário'),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'lastname'), ''), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'city'), ''), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'state'), ''), '')
  INTO
    v_user_email,
    v_user_name,
    v_user_lastname,
    v_user_city,
    v_user_state
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
    'none'
  )
  ON CONFLICT (id) DO NOTHING;

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

  IF NOW() > v_cycle_start + INTERVAL '24 hours' THEN
    RETURN json_build_object('status', 'error', 'message', 'Este ciclo de votação foi encerrado');
  END IF;

  v_cost := GREATEST(COALESCE(public.get_validation_cost_by_category(v_category), 0.75), 0.01);

  -- Atomically consume 1 validation from active plan.
  UPDATE public.plan_purchases
  SET
    used_validations = used_validations + 1,
    validation_credit_remaining = GREATEST(COALESCE(validation_credit_remaining, 0) - v_cost, 0),
    last_validation_at = NOW(),
    updated_at = NOW(),
    status = CASE WHEN used_validations + 1 >= max_validations THEN 'completed' ELSE 'active' END,
    completed_at = CASE WHEN used_validations + 1 >= max_validations THEN NOW() ELSE NULL END
  WHERE user_id = v_user_id
    AND status = 'active'
    AND used_validations < max_validations
  RETURNING * INTO v_plan;

  IF NOT FOUND THEN
    SELECT * INTO v_plan
    FROM public.plan_purchases
    WHERE user_id = v_user_id AND status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object('status', 'error', 'message', 'Nenhum plano ativo encontrado');
    END IF;

    UPDATE public.plan_purchases
    SET status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
    WHERE id = v_plan.id
      AND used_validations >= max_validations;

    RETURN json_build_object('status', 'error', 'message', 'Limite de validações do plano atingido');
  END IF;

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
