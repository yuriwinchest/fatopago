-- Endurece o motor de consenso contra ataque Sybil.
-- Princípios:
-- 1) reputação não é premiada na submissão; só após liquidação
-- 2) consenso usa peso reputacional, não contagem bruta
-- 3) contas abaixo do limiar reputacional entram em quarentena de peso (peso zero)
-- 4) payout financeiro só alcança validadores elegíveis (peso reputacional ativo)
-- 5) tarefas sem quórum ponderado suficiente não reabrem automaticamente; vão para revisão manual

ALTER TABLE public.news_tasks
  ADD COLUMN IF NOT EXISTS consensus_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS consensus_closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_eligible_vote_count INTEGER,
  ADD COLUMN IF NOT EXISTS settlement_quarantined_vote_count INTEGER,
  ADD COLUMN IF NOT EXISTS settlement_total_weight NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS settlement_true_weight NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS settlement_false_weight NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS settlement_threshold_ratio NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS settlement_min_reputation NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS settlement_review_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_tasks_consensus_status_chk'
      AND conrelid = 'public.news_tasks'::regclass
  ) THEN
    ALTER TABLE public.news_tasks
      ADD CONSTRAINT news_tasks_consensus_status_chk
      CHECK (
        consensus_status IN (
          'open',
          'settled',
          'manual_review'
        )
      );
  END IF;
END $$;

UPDATE public.news_tasks
SET
  consensus_status = CASE
    WHEN COALESCE(consensus_reached, FALSE) THEN 'settled'
    WHEN COALESCE(consensus_status, '') = '' THEN 'open'
    ELSE consensus_status
  END,
  consensus_closed_at = CASE
    WHEN COALESCE(consensus_reached, FALSE) THEN COALESCE(consensus_closed_at, settled_at)
    ELSE consensus_closed_at
  END
WHERE
  consensus_status IS DISTINCT FROM CASE
    WHEN COALESCE(consensus_reached, FALSE) THEN 'settled'
    WHEN COALESCE(consensus_status, '') = '' THEN 'open'
    ELSE consensus_status
  END
  OR (
    COALESCE(consensus_reached, FALSE)
    AND consensus_closed_at IS DISTINCT FROM COALESCE(consensus_closed_at, settled_at)
  );

CREATE INDEX IF NOT EXISTS news_tasks_open_consensus_idx
  ON public.news_tasks (consensus_status, cycle_start_at, created_at)
  WHERE consensus_status = 'open';

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

CREATE OR REPLACE FUNCTION public.settle_news_task(
  p_task_id UUID,
  p_min_votes INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_min_votes INTEGER := GREATEST(COALESCE(p_min_votes, 5), 1);
  v_min_eligible_votes INTEGER := 3;
  v_min_reputation NUMERIC(12,2) := 20;
  v_required_ratio NUMERIC(6,4) := 0.70;
  v_total_votes INTEGER := 0;
  v_true_votes INTEGER := 0;
  v_false_votes INTEGER := 0;
  v_eligible_vote_count INTEGER := 0;
  v_quarantined_vote_count INTEGER := 0;
  v_true_weight NUMERIC(18,2) := 0;
  v_false_weight NUMERIC(18,2) := 0;
  v_total_weight NUMERIC(18,2) := 0;
  v_winning_ratio NUMERIC(8,6) := 0;
  v_correct_verdict BOOLEAN;
  v_reward_raw TEXT;
  v_reward_numeric NUMERIC(18,6) := 0;
  v_reward_cents INTEGER := 0;
  v_winner_count INTEGER := 0;
  v_base_cents INTEGER := 0;
  v_remainder_cents INTEGER := 0;
  v_inserted_entries INTEGER := 0;
  v_distributed_cents INTEGER := 0;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
BEGIN
  IF p_task_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'task_id inválido');
  END IF;

  SELECT
    nt.id,
    nt.content,
    nt.consensus_reached,
    nt.consensus_status,
    nt.correct_verdict,
    nt.settled_at,
    nt.settlement_distributed_cents,
    nt.cycle_start_at,
    nt.created_at
  INTO v_task
  FROM public.news_tasks nt
  WHERE nt.id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Tarefa não encontrada');
  END IF;

  IF COALESCE(v_task.consensus_reached, FALSE) OR COALESCE(v_task.consensus_status, 'open') = 'settled' THEN
    RETURN jsonb_build_object(
      'status', 'already_settled',
      'task_id', p_task_id,
      'correct_verdict', v_task.correct_verdict,
      'distributed_cents', COALESCE(v_task.settlement_distributed_cents, 0),
      'settled_at', v_task.settled_at
    );
  END IF;

  IF COALESCE(v_task.consensus_status, 'open') <> 'open' THEN
    RETURN jsonb_build_object(
      'status', 'already_closed',
      'task_id', p_task_id,
      'consensus_status', v_task.consensus_status
    );
  END IF;

  v_cycle_start := COALESCE(v_task.cycle_start_at, v_task.created_at);
  v_cycle_end := v_cycle_start + INTERVAL '6 days 23 hours';

  IF NOW() < v_cycle_end THEN
    RETURN jsonb_build_object(
      'status', 'pending_window',
      'task_id', p_task_id,
      'cycle_end_at', v_cycle_end
    );
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE v.verdict IS TRUE)::INTEGER,
    COUNT(*) FILTER (WHERE v.verdict IS FALSE)::INTEGER,
    COUNT(*) FILTER (WHERE COALESCE(p.reputation_score, 0) >= v_min_reputation)::INTEGER,
    COUNT(*) FILTER (WHERE COALESCE(p.reputation_score, 0) < v_min_reputation)::INTEGER,
    COALESCE(SUM(
      CASE
        WHEN v.verdict IS TRUE AND COALESCE(p.reputation_score, 0) >= v_min_reputation
          THEN COALESCE(p.reputation_score, 0)
        ELSE 0
      END
    ), 0)::NUMERIC(18,2),
    COALESCE(SUM(
      CASE
        WHEN v.verdict IS FALSE AND COALESCE(p.reputation_score, 0) >= v_min_reputation
          THEN COALESCE(p.reputation_score, 0)
        ELSE 0
      END
    ), 0)::NUMERIC(18,2),
    COALESCE(SUM(
      CASE
        WHEN COALESCE(p.reputation_score, 0) >= v_min_reputation
          THEN COALESCE(p.reputation_score, 0)
        ELSE 0
      END
    ), 0)::NUMERIC(18,2)
  INTO
    v_total_votes,
    v_true_votes,
    v_false_votes,
    v_eligible_vote_count,
    v_quarantined_vote_count,
    v_true_weight,
    v_false_weight,
    v_total_weight
  FROM public.validations v
  LEFT JOIN public.profiles p
    ON p.id = v.user_id
  WHERE v.task_id = p_task_id;

  IF v_total_votes < v_min_votes THEN
    UPDATE public.news_tasks
    SET
      consensus_status = 'manual_review',
      consensus_closed_at = NOW(),
      settlement_total_votes = v_total_votes,
      settlement_true_votes = v_true_votes,
      settlement_false_votes = v_false_votes,
      settlement_eligible_vote_count = v_eligible_vote_count,
      settlement_quarantined_vote_count = v_quarantined_vote_count,
      settlement_total_weight = v_total_weight,
      settlement_true_weight = v_true_weight,
      settlement_false_weight = v_false_weight,
      settlement_threshold_ratio = v_required_ratio,
      settlement_min_reputation = v_min_reputation,
      settlement_review_reason = 'pending_min_votes'
    WHERE id = p_task_id;

    RETURN jsonb_build_object(
      'status', 'manual_review',
      'task_id', p_task_id,
      'reason', 'pending_min_votes',
      'total_votes', v_total_votes,
      'required_votes', v_min_votes
    );
  END IF;

  IF v_eligible_vote_count < v_min_eligible_votes OR v_total_weight <= 0 THEN
    UPDATE public.news_tasks
    SET
      consensus_status = 'manual_review',
      consensus_closed_at = NOW(),
      settlement_total_votes = v_total_votes,
      settlement_true_votes = v_true_votes,
      settlement_false_votes = v_false_votes,
      settlement_eligible_vote_count = v_eligible_vote_count,
      settlement_quarantined_vote_count = v_quarantined_vote_count,
      settlement_total_weight = v_total_weight,
      settlement_true_weight = v_true_weight,
      settlement_false_weight = v_false_weight,
      settlement_threshold_ratio = v_required_ratio,
      settlement_min_reputation = v_min_reputation,
      settlement_review_reason = 'insufficient_weight_quorum'
    WHERE id = p_task_id;

    RETURN jsonb_build_object(
      'status', 'manual_review',
      'task_id', p_task_id,
      'reason', 'insufficient_weight_quorum',
      'eligible_votes', v_eligible_vote_count,
      'required_eligible_votes', v_min_eligible_votes,
      'total_weight', v_total_weight
    );
  END IF;

  IF v_true_weight = v_false_weight THEN
    UPDATE public.news_tasks
    SET
      consensus_status = 'manual_review',
      consensus_closed_at = NOW(),
      settlement_total_votes = v_total_votes,
      settlement_true_votes = v_true_votes,
      settlement_false_votes = v_false_votes,
      settlement_eligible_vote_count = v_eligible_vote_count,
      settlement_quarantined_vote_count = v_quarantined_vote_count,
      settlement_total_weight = v_total_weight,
      settlement_true_weight = v_true_weight,
      settlement_false_weight = v_false_weight,
      settlement_threshold_ratio = v_required_ratio,
      settlement_min_reputation = v_min_reputation,
      settlement_review_reason = 'weighted_tie'
    WHERE id = p_task_id;

    RETURN jsonb_build_object(
      'status', 'manual_review',
      'task_id', p_task_id,
      'reason', 'weighted_tie',
      'true_weight', v_true_weight,
      'false_weight', v_false_weight
    );
  END IF;

  v_winning_ratio := GREATEST(v_true_weight, v_false_weight) / NULLIF(v_total_weight, 0);

  IF v_winning_ratio < v_required_ratio THEN
    UPDATE public.news_tasks
    SET
      consensus_status = 'manual_review',
      consensus_closed_at = NOW(),
      settlement_total_votes = v_total_votes,
      settlement_true_votes = v_true_votes,
      settlement_false_votes = v_false_votes,
      settlement_eligible_vote_count = v_eligible_vote_count,
      settlement_quarantined_vote_count = v_quarantined_vote_count,
      settlement_total_weight = v_total_weight,
      settlement_true_weight = v_true_weight,
      settlement_false_weight = v_false_weight,
      settlement_threshold_ratio = v_required_ratio,
      settlement_min_reputation = v_min_reputation,
      settlement_review_reason = 'weighted_threshold_not_met'
    WHERE id = p_task_id;

    RETURN jsonb_build_object(
      'status', 'manual_review',
      'task_id', p_task_id,
      'reason', 'weighted_threshold_not_met',
      'winning_ratio', v_winning_ratio,
      'required_ratio', v_required_ratio
    );
  END IF;

  v_correct_verdict := (v_true_weight > v_false_weight);
  v_reward_raw := NULLIF(btrim(COALESCE(v_task.content->>'reward', '')), '');

  IF v_reward_raw IS NOT NULL AND v_reward_raw ~ '^-?\d+(\.\d+)?$' THEN
    v_reward_numeric := v_reward_raw::NUMERIC(18,6);
  END IF;

  IF v_reward_numeric < 0 THEN
    v_reward_numeric := 0;
  END IF;

  v_reward_cents := ROUND(v_reward_numeric * 100)::INTEGER;

  CREATE TEMP TABLE tmp_task_settlement_winners ON COMMIT DROP AS
  SELECT
    v.user_id,
    ROW_NUMBER() OVER (ORDER BY v.created_at ASC, v.id ASC) AS rn
  FROM public.validations v
  JOIN public.profiles p
    ON p.id = v.user_id
  WHERE v.task_id = p_task_id
    AND v.user_id IS NOT NULL
    AND v.verdict = v_correct_verdict
    AND COALESCE(p.reputation_score, 0) >= v_min_reputation;

  SELECT COUNT(*)::INTEGER
  INTO v_winner_count
  FROM tmp_task_settlement_winners;

  IF v_winner_count > 0 AND v_reward_cents > 0 THEN
    v_base_cents := FLOOR(v_reward_cents::NUMERIC / v_winner_count)::INTEGER;
    v_remainder_cents := v_reward_cents - (v_base_cents * v_winner_count);

    WITH payouts AS (
      SELECT
        w.user_id,
        (v_base_cents + CASE WHEN w.rn <= v_remainder_cents THEN 1 ELSE 0 END)::INTEGER AS payout_cents
      FROM tmp_task_settlement_winners w
    ),
    ledger_rows AS (
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
      SELECT
        p.user_id,
        'credit',
        (p.payout_cents::NUMERIC / 100.0)::NUMERIC(12,2),
        'task_settlement_credit',
        p_task_id::TEXT || ':' || p.user_id::TEXT,
        'Crédito por consenso ponderado da notícia',
        'completed',
        auth.uid(),
        jsonb_build_object(
          'task_id', p_task_id,
          'consensus_verdict', v_correct_verdict,
          'true_weight', v_true_weight,
          'false_weight', v_false_weight,
          'threshold_ratio', v_required_ratio,
          'min_reputation', v_min_reputation
        )
      FROM payouts p
      WHERE p.payout_cents > 0
      ON CONFLICT (source_table, source_id) DO NOTHING
      RETURNING user_id, amount
    ),
    user_credits AS (
      SELECT
        lr.user_id,
        SUM(lr.amount)::NUMERIC(12,2) AS amount
      FROM ledger_rows lr
      GROUP BY lr.user_id
    )
    UPDATE public.profiles pr
    SET
      current_balance = COALESCE(pr.current_balance, 0) + uc.amount,
      updated_at = NOW()
    FROM user_credits uc
    WHERE pr.id = uc.user_id;

    SELECT
      COALESCE(COUNT(*), 0)::INTEGER,
      COALESCE(SUM((fl.amount * 100)::INTEGER), 0)::INTEGER
    INTO
      v_inserted_entries,
      v_distributed_cents
    FROM public.financial_ledger fl
    WHERE fl.source_table = 'task_settlement_credit'
      AND fl.source_id LIKE (p_task_id::TEXT || ':%');
  END IF;

  UPDATE public.profiles pr
  SET
    reputation_score = CASE
      WHEN v.verdict = v_correct_verdict THEN COALESCE(pr.reputation_score, 0) + 10
      ELSE GREATEST(COALESCE(pr.reputation_score, 0) - 30, 0)
    END,
    updated_at = NOW()
  FROM public.validations v
  WHERE v.task_id = p_task_id
    AND v.user_id = pr.id;

  UPDATE public.news_tasks
  SET
    consensus_reached = TRUE,
    consensus_status = 'settled',
    correct_verdict = v_correct_verdict,
    settled_at = NOW(),
    consensus_closed_at = NOW(),
    settlement_total_votes = v_total_votes,
    settlement_true_votes = v_true_votes,
    settlement_false_votes = v_false_votes,
    settlement_eligible_vote_count = v_eligible_vote_count,
    settlement_quarantined_vote_count = v_quarantined_vote_count,
    settlement_total_weight = v_total_weight,
    settlement_true_weight = v_true_weight,
    settlement_false_weight = v_false_weight,
    settlement_winner_count = v_winner_count,
    settlement_reward_cents = v_reward_cents,
    settlement_distributed_cents = v_distributed_cents,
    settlement_threshold_ratio = v_required_ratio,
    settlement_min_reputation = v_min_reputation,
    settlement_review_reason = NULL
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'status', 'settled',
    'task_id', p_task_id,
    'correct_verdict', v_correct_verdict,
    'total_votes', v_total_votes,
    'eligible_votes', v_eligible_vote_count,
    'quarantined_votes', v_quarantined_vote_count,
    'true_weight', v_true_weight,
    'false_weight', v_false_weight,
    'winner_count', v_winner_count,
    'reward_cents', v_reward_cents,
    'distributed_cents', v_distributed_cents,
    'ledger_entries', v_inserted_entries
  );
END;
$$;

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

REVOKE ALL ON FUNCTION public.settle_news_task(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_open_news_tasks(INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.settle_news_task(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_open_news_tasks(INTEGER, INTEGER) TO service_role;
