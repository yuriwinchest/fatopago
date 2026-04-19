-- Allow users to validate the same news task multiple times within the same cycle.
-- Business rule change: each validation consumes 1 plan validation and grants reward.
-- (Previously blocked by "already voted" check.)

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
  v_reward NUMERIC;
  v_cycle_start TIMESTAMPTZ;
  v_task_created TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  -- Get task reward and cycle boundaries (cycle is per task, 24h from cycle_start_at)
  SELECT (content->>'reward')::NUMERIC, cycle_start_at, created_at
  INTO v_reward, v_cycle_start, v_task_created
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

  /*
    Atomically consume 1 validation from the user's active plan.
    The WHERE clause guarantees we never increment past max_validations.
    Under concurrency, only the first N updates will succeed, where N is the remaining validations.
  */
  UPDATE public.plan_purchases
  SET
    used_validations = used_validations + 1,
    last_validation_at = NOW(),
    updated_at = NOW(),
    status = CASE WHEN used_validations + 1 >= max_validations THEN 'completed' ELSE 'active' END,
    completed_at = CASE WHEN used_validations + 1 >= max_validations THEN NOW() ELSE NULL END
  WHERE user_id = v_user_id
    AND status = 'active'
    AND used_validations < max_validations
  RETURNING * INTO v_plan;

  IF NOT FOUND THEN
    -- No active plan: return a clearer message.
    SELECT * INTO v_plan
    FROM public.plan_purchases
    WHERE user_id = v_user_id AND status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object('status', 'error', 'message', 'Nenhum plano ativo encontrado');
    END IF;

    -- Active plan exists but it's exhausted; close it to allow renew.
    UPDATE public.plan_purchases
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_plan.id;

    RETURN json_build_object('status', 'error', 'message', 'Limite de validações do plano atingido');
  END IF;

  -- Insert validation record (plan usage is already reserved above; the function is transactional)
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

  -- Update user profile earnings and reputation
  UPDATE public.profiles
  SET
    current_balance = COALESCE(current_balance, 0) + COALESCE(v_reward, 0),
    reputation_score = COALESCE(reputation_score, 0) + 10,
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN json_build_object(
    'status', 'success',
    'reward', v_reward,
    'used_validations', v_plan.used_validations,
    'max_validations', v_plan.max_validations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

