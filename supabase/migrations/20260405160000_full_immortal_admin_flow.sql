-- =============================================================================
-- MIGRAÇÃO COMPLETA: MECÂNICA DE NOTÍCIAS ADMIN IMORTAIS (vFinal Fix)
-- 1. Notícias admin NUNCA são liquidadas automaticamente.
-- 2. Notícias admin permitem validação por PACOTE (plan_purchase_id).
-- 3. Ressurreição de notícias admin fechadas (settled/voided).
-- =============================================================================

-- 1) settle_open_news_tasks: EXCLUIR admin posts do settlement automático
CREATE OR REPLACE FUNCTION public.settle_open_news_tasks(
  p_limit INTEGER DEFAULT 50,
  p_min_votes INTEGER DEFAULT 5
)
RETURNS TABLE (
  task_id UUID,
  status TEXT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 50), 1);
  v_task_id UUID;
  v_result JSONB;
BEGIN
  FOR v_task_id IN
    SELECT nt.id
    FROM public.news_tasks nt
    WHERE COALESCE(nt.consensus_reached, FALSE) = FALSE
      AND COALESCE(nt.consensus_status, 'open') = 'open'
      AND COALESCE(nt.is_admin_post, FALSE) = FALSE  -- NUNCA liquidar admin posts
      AND COALESCE(nt.cycle_start_at, nt.created_at) + INTERVAL '6 days 23 hours' <= NOW()
    ORDER BY nt.created_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    v_result := public.settle_news_task(v_task_id, p_min_votes);
    task_id := v_task_id;
    status := COALESCE(v_result->>'status', 'error');
    message := COALESCE(v_result->>'reason', v_result->>'message', '');
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

-- 2) submit_validation: Versão completa com Unicidade por Pacote para Admin
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
  v_task_closed BOOLEAN;
  v_task_status TEXT;
  v_is_admin_post BOOLEAN;
  v_category TEXT;
  v_cost NUMERIC(12,2);
  v_plan_id UUID := NULL;
  v_comp_balance NUMERIC(12,2) := 0;
  v_comp_used NUMERIC(12,2) := 0;
  v_plan_debit NUMERIC(12,2) := 0;
  v_validation_id UUID;
  v_current_cycle_start TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN json_build_object('status', 'error', 'message', 'Não autenticado'); END IF;

  SELECT content->>'category', cycle_start_at, COALESCE(consensus_reached, FALSE), COALESCE(consensus_status, 'open'), COALESCE(is_admin_post, FALSE)
  INTO v_category, v_cycle_start, v_task_closed, v_task_status, v_is_admin_post
  FROM public.news_tasks WHERE id = p_task_id FOR UPDATE;

  IF NOT FOUND THEN RETURN json_build_object('status', 'error', 'message', 'Tarefa não encontrada'); END IF;

  -- Admin posts nunca fecham para o Validador
  IF NOT v_is_admin_post AND (v_task_closed OR v_task_status <> 'open') THEN
    RETURN json_build_object('status', 'error', 'message', 'Esta notícia não está mais aberta');
  END IF;

  SELECT * INTO v_plan FROM public.plan_purchases WHERE user_id = v_user_id AND status = 'active'
  ORDER BY started_at DESC LIMIT 1 FOR UPDATE;

  -- DUPLICIDADE
  IF v_is_admin_post THEN
    IF EXISTS (SELECT 1 FROM public.validations WHERE user_id = v_user_id AND task_id = p_task_id AND plan_purchase_id = v_plan.id) THEN
      RETURN json_build_object('status', 'error', 'message', 'Você já validou esta notícia admin neste pacote');
    END IF;
  ELSE
    SELECT c.cycle_start_at INTO v_current_cycle_start FROM public.get_weekly_cycle_window(NOW(), 0) c;
    IF EXISTS (SELECT 1 FROM public.validations WHERE user_id = v_user_id AND task_id = p_task_id AND created_at >= v_current_cycle_start) THEN
      RETURN json_build_object('status', 'error', 'message', 'Você já validou esta notícia hoje');
    END IF;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  v_cost := GREATEST(COALESCE(public.get_validation_cost_by_category(v_category), 1.00), 0.01);
  v_comp_balance := GREATEST(COALESCE(v_profile.compensatory_credit_balance, 0), 0);
  v_comp_used := LEAST(v_comp_balance, v_cost);
  v_plan_debit := GREATEST(v_cost - v_comp_used, 0);

  IF v_plan_debit > 0 AND (v_plan.id IS NULL OR v_plan.validation_credit_remaining < v_plan_debit) THEN
    RETURN json_build_object('status', 'error', 'message', 'Crédito insuficiente');
  END IF;

  INSERT INTO public.validations (task_id, user_id, plan_purchase_id, verdict, justification, proof_link)
  VALUES (p_task_id, v_user_id, v_plan.id, p_verdict, p_justification, p_proof_link) RETURNING id INTO v_validation_id;

  UPDATE public.profiles SET compensatory_credit_balance = v_comp_balance - v_comp_used WHERE id = v_user_id;
  IF v_plan.id IS NOT NULL THEN
    UPDATE public.plan_purchases 
    SET used_validations = used_validations + 1, 
        validation_credit_remaining = validation_credit_remaining - v_plan_debit,
        status = CASE WHEN (validation_credit_remaining - v_plan_debit) <= 0.009 THEN 'completed' ELSE 'active' END
    WHERE id = v_plan.id;
  END IF;

  RETURN json_build_object('status', 'success', 'validation_id', v_validation_id);
END;
$$;

-- 3) RESSURREIÇÃO: Reabrir Notícias Admin fechadas (settled/voided/manual_review)
UPDATE public.news_tasks
SET
  consensus_reached = FALSE,
  consensus_status = 'open',
  correct_verdict = NULL,
  settled_at = NULL,
  manual_resolved_at = NULL,
  manual_resolved_by = NULL,
  manual_resolution_kind = NULL,
  manual_resolution_note = NULL
WHERE is_admin_post = TRUE;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
