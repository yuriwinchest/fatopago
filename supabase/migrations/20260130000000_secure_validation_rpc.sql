-- Secure validation submission via RPC
-- This ensures atomic operations and prevents client-side manipulation of balance/reputation

CREATE OR REPLACE FUNCTION public.submit_validation(
  p_task_id UUID,
  p_verdict BOOLEAN,
  p_justification TEXT DEFAULT NULL,
  p_proof_link TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to update profiles
AS $$
DECLARE
  v_user_id UUID;
  v_active_plan RECORD;
  v_reward NUMERIC;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
  v_already_voted BOOLEAN;
BEGIN
  -- 1. Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  -- 2. Get task and reward
  SELECT (content->>'reward')::NUMERIC, cycle_start_at, created_at 
  INTO v_reward, v_cycle_start, v_cycle_end
  FROM public.news_tasks 
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Tarefa não encontrada');
  END IF;

  -- 3. Check cycle (24h)
  IF v_cycle_start IS NULL THEN
    v_cycle_start := v_cycle_end;
  END IF;
  
  IF NOW() > v_cycle_start + INTERVAL '24 hours' THEN
    RETURN json_build_object('status', 'error', 'message', 'Este ciclo de votação foi encerrado');
  END IF;

  -- 4. Check if already voted
  SELECT EXISTS (
    SELECT 1 FROM public.validations 
    WHERE task_id = p_task_id 
    AND user_id = v_user_id
    AND created_at >= v_cycle_start
  ) INTO v_already_voted;

  IF v_already_voted THEN
    RETURN json_build_object('status', 'error', 'message', 'Você já votou nesta notícia neste ciclo');
  END IF;

  -- 5. Get active plan
  SELECT * INTO v_active_plan 
  FROM public.plan_purchases 
  WHERE user_id = v_user_id AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Nenhum plano ativo encontrado');
  END IF;

  IF v_active_plan.used_validations >= v_active_plan.max_validations THEN
    RETURN json_build_object('status', 'error', 'message', 'Limite de validações do plano atingido');
  END IF;

  -- 6. Perform atomic updates
  -- A. Insert validation
  INSERT INTO public.validations (
    task_id, user_id, plan_purchase_id, verdict, justification, proof_link
  ) VALUES (
    p_task_id, v_user_id, v_active_plan.id, p_verdict, p_justification, p_proof_link
  );

  -- B. Update plan usage
  UPDATE public.plan_purchases 
  SET 
    used_validations = used_validations + 1,
    last_validation_at = NOW(),
    updated_at = NOW(),
    status = CASE WHEN used_validations + 1 >= max_validations THEN 'completed' ELSE 'active' END,
    completed_at = CASE WHEN used_validations + 1 >= max_validations THEN NOW() ELSE NULL END
  WHERE id = v_active_plan.id;

  -- C. Update user profile
  UPDATE public.profiles 
  SET 
    current_balance = COALESCE(current_balance, 0) + v_reward,
    reputation_score = COALESCE(reputation_score, 0) + 10,
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN json_build_object('status', 'success', 'reward', v_reward);
END;
$$;
