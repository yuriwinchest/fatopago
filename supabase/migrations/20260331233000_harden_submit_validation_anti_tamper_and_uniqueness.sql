-- submit_validation hardening (anti-tamper / anti-duplicidade / trilha imutavel)
-- Objetivos:
-- 1) impedir dupla validacao do mesmo fato por usuario (nivel de banco)
-- 2) serializar concorrencia user+task (advisory lock transacional)
-- 3) registrar consumo no financial_ledger (append-only)
-- 4) bloquear DML direto da role client em public.validations

-- ============================================================================
-- 0) Saneamento de historico duplicado para permitir trava UNIQUE
-- ============================================================================
CREATE TEMP TABLE tmp_validation_duplicates ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    v.id AS validation_id,
    v.user_id,
    v.task_id,
    v.plan_purchase_id,
    ROW_NUMBER() OVER (
      PARTITION BY v.user_id, v.task_id
      ORDER BY v.created_at ASC, v.id ASC
    ) AS rn
  FROM public.validations v
  WHERE v.user_id IS NOT NULL
    AND v.task_id IS NOT NULL
)
SELECT
  r.validation_id,
  r.user_id,
  r.plan_purchase_id,
  GREATEST(
    COALESCE(public.get_validation_cost_by_category(nt.content->>'category'), 0.75),
    0.01
  )::NUMERIC(12,2) AS validation_cost
FROM ranked r
LEFT JOIN public.news_tasks nt
  ON nt.id = r.task_id
WHERE r.rn > 1;

DELETE FROM public.validations v
USING tmp_validation_duplicates d
WHERE v.id = d.validation_id;

WITH agg AS (
  SELECT user_id, COUNT(*)::INTEGER AS duplicate_count
  FROM tmp_validation_duplicates
  GROUP BY user_id
)
UPDATE public.profiles p
SET
  reputation_score = GREATEST(COALESCE(p.reputation_score, 0) - (agg.duplicate_count * 10), 0),
  updated_at = NOW()
FROM agg
WHERE p.id = agg.user_id;

WITH agg AS (
  SELECT
    plan_purchase_id,
    COUNT(*)::INTEGER AS duplicate_count,
    COALESCE(SUM(validation_cost), 0)::NUMERIC(12,2) AS duplicate_cost
  FROM tmp_validation_duplicates
  WHERE plan_purchase_id IS NOT NULL
  GROUP BY plan_purchase_id
),
calc AS (
  SELECT
    pp.id,
    GREATEST(COALESCE(pp.used_validations, 0) - agg.duplicate_count, 0) AS new_used_validations,
    CASE
      WHEN pp.validation_credit_remaining IS NULL THEN pp.validation_credit_remaining
      ELSE LEAST(
        COALESCE(pp.validation_credit_total, COALESCE(pp.validation_credit_remaining, 0) + agg.duplicate_cost),
        COALESCE(pp.validation_credit_remaining, 0) + agg.duplicate_cost
      )::NUMERIC(12,2)
    END AS new_remaining_credit,
    public.get_plan_purchase_expires_at(pp.plan_id, pp.started_at) AS expires_at
  FROM public.plan_purchases pp
  JOIN agg
    ON agg.plan_purchase_id = pp.id
)
UPDATE public.plan_purchases pp
SET
  used_validations = calc.new_used_validations,
  validation_credit_remaining = calc.new_remaining_credit,
  status = CASE
    WHEN calc.new_remaining_credit IS NOT NULL
      AND calc.new_remaining_credit > 0.009
      AND calc.expires_at > NOW()
    THEN 'active'
    ELSE pp.status
  END,
  completed_at = CASE
    WHEN calc.new_remaining_credit IS NOT NULL
      AND calc.new_remaining_credit > 0.009
      AND calc.expires_at > NOW()
    THEN NULL
    ELSE pp.completed_at
  END,
  updated_at = NOW()
FROM calc
WHERE pp.id = calc.id;

CREATE UNIQUE INDEX IF NOT EXISTS validations_user_task_unique_idx
  ON public.validations (user_id, task_id)
  WHERE user_id IS NOT NULL
    AND task_id IS NOT NULL;

-- ============================================================================
-- 1) submit_validation reforcado (concorrencia, duplicidade, tarefa aberta)
-- ============================================================================
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
  v_task_closed BOOLEAN;
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
    -- Evita lixo de payload de prova quando o voto eh verdadeiro.
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
      RETURN json_build_object('status', 'error', 'message', 'Para marcar como falso, informe justificativa com pelo menos 10 caracteres');
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

  SELECT
    content->>'category',
    cycle_start_at,
    created_at,
    COALESCE(consensus_reached, FALSE)
  INTO
    v_category,
    v_cycle_start,
    v_task_created,
    v_task_closed
  FROM public.news_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Tarefa não encontrada');
  END IF;

  IF v_task_closed THEN
    RETURN json_build_object('status', 'error', 'message', 'Esta notícia não está mais aberta para validação');
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

  -- Trava transacional por usuario+tarefa: fecha janela de corrida entre check/insert.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT || ':' || p_task_id::TEXT));

  IF EXISTS (
    SELECT 1
    FROM public.validations
    WHERE user_id = v_user_id
      AND task_id = p_task_id
  ) THEN
    RETURN json_build_object('status', 'error', 'message', 'Você já validou esta notícia');
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
      v_plan.id,
      p_verdict,
      v_justification,
      v_proof_link
    )
    RETURNING id INTO v_validation_id;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN json_build_object('status', 'error', 'message', 'Você já validou esta notícia');
  END;

  UPDATE public.profiles
  SET
    reputation_score = COALESCE(reputation_score, 0) + 10,
    updated_at = NOW()
  WHERE id = v_user_id;

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
    'Consumo de saldo por validação',
    'completed',
    v_user_id,
    jsonb_build_object(
      'task_id', p_task_id,
      'plan_purchase_id', v_plan.id,
      'verdict', p_verdict
    )
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;

  RETURN json_build_object(
    'status', 'success',
    'validation_id', v_validation_id,
    'cost', v_cost,
    'used_validations', v_plan.used_validations,
    'max_validations', v_plan.max_validations,
    'remaining_credit', v_plan.validation_credit_remaining
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.validations
  FROM authenticated, anon;
GRANT SELECT ON TABLE public.validations TO authenticated;

