-- Plan credit + validation cost by category.
-- Business rule:
-- 1) package defines how many validations user can perform (starter=6, pro=10, expert=20)
-- 2) each validation consumes part of package credit using category cost
-- 3) package credit does not accumulate to the next package

ALTER TABLE public.plan_purchases
  ADD COLUMN IF NOT EXISTS validation_credit_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_credit_remaining NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Normalize plan limits to the current business rule.
UPDATE public.plan_purchases
SET max_validations = CASE plan_id
  WHEN 'starter' THEN 6
  WHEN 'pro' THEN 10
  WHEN 'expert' THEN 20
  ELSE max_validations
END
WHERE plan_id IN ('starter', 'pro', 'expert');

-- Keep usage coherent after limit normalization.
UPDATE public.plan_purchases
SET
  used_validations = GREATEST(0, LEAST(COALESCE(used_validations, 0), COALESCE(max_validations, 0))),
  status = CASE
    WHEN GREATEST(0, LEAST(COALESCE(used_validations, 0), COALESCE(max_validations, 0))) >= COALESCE(max_validations, 0)
      THEN 'completed'
    ELSE status
  END,
  completed_at = CASE
    WHEN GREATEST(0, LEAST(COALESCE(used_validations, 0), COALESCE(max_validations, 0))) >= COALESCE(max_validations, 0)
      THEN COALESCE(completed_at, NOW())
    ELSE completed_at
  END,
  updated_at = NOW()
WHERE plan_id IN ('starter', 'pro', 'expert');

-- Backfill credit fields for existing rows (proportional by remaining validations).
UPDATE public.plan_purchases
SET
  validation_credit_total = CASE plan_id
    WHEN 'starter' THEN 6.00
    WHEN 'pro' THEN 10.00
    WHEN 'expert' THEN 20.00
    ELSE validation_credit_total
  END,
  validation_credit_remaining = CASE
    WHEN status <> 'active' THEN 0
    WHEN COALESCE(max_validations, 0) <= 0 THEN 0
    ELSE ROUND(
      (
        CASE plan_id
          WHEN 'starter' THEN 6.00
          WHEN 'pro' THEN 10.00
          WHEN 'expert' THEN 20.00
          ELSE COALESCE(validation_credit_total, 0)
        END
      ) * GREATEST(COALESCE(max_validations, 0) - COALESCE(used_validations, 0), 0)::NUMERIC
        / NULLIF(COALESCE(max_validations, 0), 0)::NUMERIC,
      2
    )
  END,
  updated_at = NOW()
WHERE plan_id IN ('starter', 'pro', 'expert');

CREATE OR REPLACE FUNCTION public.get_validation_cost_by_category(p_category TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cat TEXT := LOWER(COALESCE(TRIM(p_category), ''));
BEGIN
  IF v_cat LIKE '%pol%' THEN RETURN 1.00; END IF;
  IF v_cat LIKE '%esport%' THEN RETURN 0.70; END IF;
  IF v_cat LIKE '%entreten%' OR v_cat LIKE '%famos%' THEN RETURN 0.95; END IF;
  IF v_cat LIKE '%econ%' THEN RETURN 0.60; END IF;
  IF v_cat LIKE '%tecn%' THEN RETURN 0.75; END IF;
  IF v_cat LIKE '%ciên%' OR v_cat LIKE '%cien%' THEN RETURN 0.80; END IF;
  IF v_cat LIKE '%saúd%' OR v_cat LIKE '%saud%' THEN RETURN 0.85; END IF;
  IF v_cat LIKE '%mundo%' OR v_cat LIKE '%internac%' THEN RETURN 0.90; END IF;
  IF v_cat LIKE '%brasil%' THEN RETURN 0.70; END IF;
  RETURN 0.75;
END;
$$;

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
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

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

  -- Reputation is still earned; package value is consumed from plan_purchases credit.
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

