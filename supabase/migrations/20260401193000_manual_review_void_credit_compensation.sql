ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS compensatory_credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_compensatory_credit_balance_nonnegative_chk'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_compensatory_credit_balance_nonnegative_chk
      CHECK (compensatory_credit_balance >= 0);
  END IF;
END $$;

ALTER TABLE public.news_tasks
  ADD COLUMN IF NOT EXISTS manual_resolution_kind TEXT,
  ADD COLUMN IF NOT EXISTS manual_resolution_compensated_user_count INTEGER,
  ADD COLUMN IF NOT EXISTS manual_resolution_compensated_credit NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS manual_resolution_skipped_vote_count INTEGER;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_tasks_consensus_status_chk'
      AND conrelid = 'public.news_tasks'::regclass
  ) THEN
    ALTER TABLE public.news_tasks
      DROP CONSTRAINT news_tasks_consensus_status_chk;
  END IF;

  ALTER TABLE public.news_tasks
    ADD CONSTRAINT news_tasks_consensus_status_chk
    CHECK (
      consensus_status IN (
        'open',
        'settled',
        'manual_review',
        'voided'
      )
    );
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'news_tasks_manual_resolution_kind_chk'
      AND conrelid = 'public.news_tasks'::regclass
  ) THEN
    ALTER TABLE public.news_tasks
      DROP CONSTRAINT news_tasks_manual_resolution_kind_chk;
  END IF;

  ALTER TABLE public.news_tasks
    ADD CONSTRAINT news_tasks_manual_resolution_kind_chk
    CHECK (
      manual_resolution_kind IS NULL
      OR manual_resolution_kind IN (
        'forced_verdict',
        'void_compensation'
      )
    );
END $$;

ALTER TABLE public.news_task_manual_review_votes
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS proof_link TEXT;

UPDATE public.news_task_manual_review_votes s
SET
  justification = v.justification,
  proof_link = v.proof_link
FROM public.validations v
WHERE v.id = s.validation_id
  AND (
    s.justification IS DISTINCT FROM v.justification
    OR s.proof_link IS DISTINCT FROM v.proof_link
  );

DROP FUNCTION IF EXISTS public.admin_get_news_task_manual_review_votes(UUID);

CREATE OR REPLACE FUNCTION public.capture_news_task_manual_review_snapshot(
  p_task_id UUID,
  p_min_reputation NUMERIC DEFAULT 20
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task_id UUID := p_task_id;
  v_min_reputation NUMERIC(12,2) := GREATEST(COALESCE(p_min_reputation, 20), 0);
  v_inserted_count INTEGER := 0;
BEGIN
  IF v_task_id IS NULL THEN
    RAISE EXCEPTION 'task_id invalido para snapshot de revisao manual';
  END IF;

  INSERT INTO public.news_task_manual_review_votes (
    task_id,
    validation_id,
    user_id,
    plan_purchase_id,
    verdict,
    validation_cost,
    reputation_score_snapshot,
    eligible_for_consensus,
    validation_created_at,
    captured_at,
    justification,
    proof_link
  )
  SELECT
    v.task_id,
    v.id,
    v.user_id,
    v.plan_purchase_id,
    v.verdict,
    COALESCE(fl.amount, 0)::NUMERIC(12,2),
    COALESCE(p.reputation_score, 0)::NUMERIC(12,2),
    (COALESCE(p.reputation_score, 0) >= v_min_reputation),
    v.created_at,
    NOW(),
    v.justification,
    v.proof_link
  FROM public.validations v
  LEFT JOIN public.profiles p
    ON p.id = v.user_id
  LEFT JOIN public.financial_ledger fl
    ON fl.source_table = 'validations'
   AND fl.source_id = v.id::TEXT
   AND fl.entry_type = 'debit'
  WHERE v.task_id = v_task_id
  ON CONFLICT (task_id, validation_id) DO UPDATE
  SET
    justification = EXCLUDED.justification,
    proof_link = EXCLUDED.proof_link;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_news_task_manual_review_snapshot(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_news_task_manual_review_snapshot(UUID, NUMERIC) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_get_news_task_manual_review_votes(
  p_task_id UUID
)
RETURNS TABLE (
  validation_id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  plan_purchase_id UUID,
  verdict BOOLEAN,
  validation_cost NUMERIC,
  reputation_score_snapshot NUMERIC,
  eligible_for_consensus BOOLEAN,
  validation_created_at TIMESTAMPTZ,
  justification TEXT,
  proof_link TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_fatopago_admin();

  IF p_task_id IS NULL THEN
    RAISE EXCEPTION 'task_id invalido para consulta de revisao manual.';
  END IF;

  RETURN QUERY
  SELECT
    s.validation_id,
    s.user_id,
    TRIM(CONCAT(COALESCE(p.name, ''), ' ', COALESCE(p.lastname, ''))) AS user_name,
    p.email AS user_email,
    s.plan_purchase_id,
    s.verdict,
    s.validation_cost,
    s.reputation_score_snapshot,
    s.eligible_for_consensus,
    s.validation_created_at,
    s.justification,
    s.proof_link
  FROM public.news_task_manual_review_votes s
  LEFT JOIN public.profiles p
    ON p.id = s.user_id
  WHERE s.task_id = p_task_id
  ORDER BY s.validation_created_at ASC, s.validation_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_news_task_manual_review_votes(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_news_task_manual_review_votes(UUID) TO authenticated;

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
    RETURN json_build_object('status', 'error', 'message', 'Usuario nao autenticado');
  END IF;

  IF p_task_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Tarefa invalida');
  END IF;

  IF p_verdict IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Veredito invalido');
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
      RETURN json_build_object('status', 'error', 'message', 'Justificativa invalida');
    END IF;
  END IF;

  IF p_verdict = FALSE THEN
    IF v_justification IS NULL OR length(v_justification) < 10 THEN
      RETURN json_build_object('status', 'error', 'message', 'Para marcar como falso, informe justificativa com pelo menos 10 caracteres');
    END IF;
  END IF;

  IF v_proof_link IS NOT NULL THEN
    IF length(v_proof_link) > 1000 OR v_proof_link !~* '^https?://' THEN
      RETURN json_build_object('status', 'error', 'message', 'Link de prova invalido');
    END IF;

    IF v_proof_link ~ '[[:space:]]' THEN
      RETURN json_build_object('status', 'error', 'message', 'Link de prova invalido');
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
    RETURN json_build_object('status', 'error', 'message', 'Tarefa nao encontrada');
  END IF;

  IF v_task_closed OR COALESCE(v_task_status, 'open') <> 'open' THEN
    RETURN json_build_object('status', 'error', 'message', 'Esta noticia nao esta mais aberta para validacao');
  END IF;

  IF v_cycle_start IS NULL THEN
    v_cycle_start := v_task_created;
  END IF;

  v_cycle_end := v_cycle_start + INTERVAL '6 days 23 hours';
  IF NOW() >= v_cycle_end THEN
    RETURN json_build_object('status', 'error', 'message', 'Este ciclo semanal ja foi encerrado');
  END IF;

  v_cost := GREATEST(COALESCE(public.get_validation_cost_by_category(v_category), 0.75), 0.01);

  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT || ':' || p_task_id::TEXT));

  IF EXISTS (
    SELECT 1
    FROM public.validations
    WHERE user_id = v_user_id
      AND task_id = p_task_id
  ) THEN
    RETURN json_build_object('status', 'error', 'message', 'Voce ja validou esta noticia');
  END IF;

  SELECT
    u.email,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), 'Usuario'),
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
    COALESCE(v_user_name, 'Usuario'),
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
        RETURN json_build_object('status', 'error', 'message', 'Credito compensatorio insuficiente e nenhum plano ativo encontrado');
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

      RETURN json_build_object('status', 'error', 'message', 'Seu saldo expirou. Compre um novo plano para continuar.');
    END IF;

    IF COALESCE(v_plan.validation_credit_remaining, 0) <= 0.009 THEN
      UPDATE public.plan_purchases
      SET
        status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
      WHERE id = v_plan.id;

      RETURN json_build_object('status', 'error', 'message', 'Voce nao tem saldo para validar. Escolha um novo plano para continuar.');
    END IF;

    IF COALESCE(v_plan.validation_credit_remaining, 0) < v_plan_debit THEN
      UPDATE public.plan_purchases
      SET
        status = 'completed',
        completed_at = COALESCE(completed_at, NOW()),
        updated_at = NOW()
      WHERE id = v_plan.id;

      RETURN json_build_object('status', 'error', 'message', 'Saldo insuficiente para esta noticia. Compre um novo plano para continuar.');
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
      RETURN json_build_object('status', 'error', 'message', 'Voce ja validou esta noticia');
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
    'Consumo de saldo por validacao',
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

CREATE OR REPLACE FUNCTION public.admin_force_settle_news_task(
  p_task_id UUID,
  p_correct_verdict BOOLEAN,
  p_resolution_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_reward_raw TEXT;
  v_reward_numeric NUMERIC(18,6) := 0;
  v_reward_cents INTEGER := 0;
  v_winner_count INTEGER := 0;
  v_base_cents INTEGER := 0;
  v_remainder_cents INTEGER := 0;
  v_inserted_entries INTEGER := 0;
  v_distributed_cents INTEGER := 0;
  v_resolution_note TEXT := NULLIF(BTRIM(COALESCE(p_resolution_note, '')), '');
BEGIN
  PERFORM public.assert_fatopago_admin();

  IF p_task_id IS NULL THEN
    RAISE EXCEPTION 'task_id invalido para liquidacao manual';
  END IF;

  SELECT *
  INTO v_task
  FROM public.news_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa nao encontrada para liquidacao manual.';
  END IF;

  IF COALESCE(v_task.consensus_reached, FALSE) OR COALESCE(v_task.consensus_status, 'open') = 'settled' THEN
    RETURN jsonb_build_object(
      'status', 'already_settled',
      'task_id', p_task_id,
      'correct_verdict', v_task.correct_verdict,
      'settled_at', v_task.settled_at
    );
  END IF;

  IF COALESCE(v_task.consensus_status, 'open') = 'voided' THEN
    RETURN jsonb_build_object(
      'status', 'already_voided',
      'task_id', p_task_id,
      'manual_resolved_at', v_task.manual_resolved_at
    );
  END IF;

  IF COALESCE(v_task.consensus_status, 'open') <> 'manual_review' THEN
    RAISE EXCEPTION 'A tarefa nao esta em revisao manual.';
  END IF;

  PERFORM public.capture_news_task_manual_review_snapshot(
    p_task_id,
    COALESCE(v_task.settlement_min_reputation, 20)
  );

  v_reward_raw := NULLIF(BTRIM(COALESCE(v_task.content->>'reward', '')), '');
  IF v_reward_raw IS NOT NULL AND v_reward_raw ~ '^-?\d+(\.\d+)?$' THEN
    v_reward_numeric := v_reward_raw::NUMERIC(18,6);
  END IF;
  IF v_reward_numeric < 0 THEN
    v_reward_numeric := 0;
  END IF;
  v_reward_cents := ROUND(v_reward_numeric * 100)::INTEGER;

  CREATE TEMP TABLE tmp_manual_task_settlement_winners ON COMMIT DROP AS
  SELECT
    s.user_id,
    ROW_NUMBER() OVER (ORDER BY s.validation_created_at ASC, s.validation_id ASC) AS rn
  FROM public.news_task_manual_review_votes s
  WHERE s.task_id = p_task_id
    AND s.user_id IS NOT NULL
    AND s.verdict = p_correct_verdict
    AND s.eligible_for_consensus = TRUE;

  SELECT COUNT(*)::INTEGER
  INTO v_winner_count
  FROM tmp_manual_task_settlement_winners;

  IF v_winner_count > 0 AND v_reward_cents > 0 THEN
    v_base_cents := FLOOR(v_reward_cents::NUMERIC / v_winner_count)::INTEGER;
    v_remainder_cents := v_reward_cents - (v_base_cents * v_winner_count);

    WITH payouts AS (
      SELECT
        w.user_id,
        (v_base_cents + CASE WHEN w.rn <= v_remainder_cents THEN 1 ELSE 0 END)::INTEGER AS payout_cents
      FROM tmp_manual_task_settlement_winners w
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
        'Credito por liquidacao manual da noticia',
        'completed',
        auth.uid(),
        jsonb_build_object(
          'task_id', p_task_id,
          'consensus_verdict', p_correct_verdict,
          'manual_resolution', TRUE,
          'settlement_review_reason', v_task.settlement_review_reason,
          'resolution_note', v_resolution_note
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
      WHEN s.verdict = p_correct_verdict THEN COALESCE(pr.reputation_score, 0) + 10
      ELSE GREATEST(COALESCE(pr.reputation_score, 0) - 30, 0)
    END,
    updated_at = NOW()
  FROM public.news_task_manual_review_votes s
  WHERE s.task_id = p_task_id
    AND s.user_id = pr.id;

  UPDATE public.news_tasks
  SET
    consensus_reached = TRUE,
    consensus_status = 'settled',
    correct_verdict = p_correct_verdict,
    settled_at = NOW(),
    manual_resolved_at = NOW(),
    manual_resolved_by = auth.uid(),
    manual_resolution_note = v_resolution_note,
    manual_resolution_kind = 'forced_verdict',
    manual_resolution_compensated_user_count = 0,
    manual_resolution_compensated_credit = 0,
    manual_resolution_skipped_vote_count = 0,
    settlement_winner_count = v_winner_count,
    settlement_reward_cents = v_reward_cents,
    settlement_distributed_cents = v_distributed_cents
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'status', 'settled',
    'task_id', p_task_id,
    'correct_verdict', p_correct_verdict,
    'winner_count', v_winner_count,
    'reward_cents', v_reward_cents,
    'distributed_cents', v_distributed_cents,
    'ledger_entries', v_inserted_entries,
    'manual_resolution', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_force_settle_news_task(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_settle_news_task(UUID, BOOLEAN, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cancel_news_task(
  p_task_id UUID,
  p_resolution_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_resolution_note TEXT := NULLIF(BTRIM(COALESCE(p_resolution_note, '')), '');
  v_compensated_users INTEGER := 0;
  v_skipped_votes INTEGER := 0;
  v_compensated_credit NUMERIC(12,2) := 0;
  v_ledger_entries INTEGER := 0;
BEGIN
  PERFORM public.assert_fatopago_admin();

  IF p_task_id IS NULL THEN
    RAISE EXCEPTION 'task_id invalido para anulacao manual';
  END IF;

  IF v_resolution_note IS NULL OR length(v_resolution_note) < 20 THEN
    RAISE EXCEPTION 'Informe uma justificativa administrativa com pelo menos 20 caracteres para anular a tarefa';
  END IF;

  SELECT *
  INTO v_task
  FROM public.news_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa nao encontrada para anulacao manual.';
  END IF;

  IF COALESCE(v_task.consensus_reached, FALSE) OR COALESCE(v_task.consensus_status, 'open') = 'settled' THEN
    RAISE EXCEPTION 'A tarefa ja foi liquidada e nao pode ser anulada.';
  END IF;

  IF COALESCE(v_task.consensus_status, 'open') = 'voided' THEN
    RETURN jsonb_build_object(
      'status', 'already_voided',
      'task_id', p_task_id,
      'manual_resolved_at', v_task.manual_resolved_at
    );
  END IF;

  IF COALESCE(v_task.consensus_status, 'open') <> 'manual_review' THEN
    RAISE EXCEPTION 'A tarefa nao esta em revisao manual.';
  END IF;

  PERFORM public.capture_news_task_manual_review_snapshot(
    p_task_id,
    COALESCE(v_task.settlement_min_reputation, 20)
  );

  CREATE TEMP TABLE tmp_manual_review_compensation ON COMMIT DROP AS
  SELECT
    s.task_id,
    s.validation_id,
    s.user_id,
    s.plan_purchase_id,
    GREATEST(COALESCE(s.validation_cost, 0), 0)::NUMERIC(12,2) AS validation_cost,
    s.verdict,
    s.validation_created_at,
    s.justification,
    s.proof_link,
    CASE
      WHEN s.user_id IS NULL THEN 'missing_user'
      WHEN GREATEST(COALESCE(s.validation_cost, 0), 0) <= 0 THEN 'zero_cost'
      ELSE 'compensated'
    END AS compensation_mode
  FROM public.news_task_manual_review_votes s
  WHERE s.task_id = p_task_id;

  WITH per_user AS (
    SELECT
      c.user_id,
      SUM(c.validation_cost)::NUMERIC(12,2) AS compensation_credit
    FROM tmp_manual_review_compensation c
    WHERE c.compensation_mode = 'compensated'
      AND c.user_id IS NOT NULL
    GROUP BY c.user_id
  )
  UPDATE public.profiles p
  SET
    compensatory_credit_balance = COALESCE(p.compensatory_credit_balance, 0) + pu.compensation_credit,
    updated_at = NOW()
  FROM per_user pu
  WHERE p.id = pu.user_id;

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
    c.user_id,
    'adjustment',
    c.validation_cost,
    'task_validation_compensation',
    p_task_id::TEXT || ':' || c.validation_id::TEXT,
    'Credito compensatorio por anulacao administrativa da noticia',
    'completed',
    auth.uid(),
    jsonb_build_object(
      'task_id', p_task_id,
      'validation_id', c.validation_id,
      'plan_purchase_id', c.plan_purchase_id,
      'compensation_type', 'validation_credit',
      'compensation_mode', c.compensation_mode,
      'resolution_note', v_resolution_note,
      'verdict', c.verdict,
      'justification', c.justification,
      'proof_link', c.proof_link
    )
  FROM tmp_manual_review_compensation c
  WHERE c.compensation_mode = 'compensated'
    AND c.user_id IS NOT NULL
    AND c.validation_cost > 0
  ON CONFLICT (source_table, source_id) DO NOTHING;

  SELECT
    COUNT(DISTINCT user_id) FILTER (WHERE compensation_mode = 'compensated' AND user_id IS NOT NULL)::INTEGER,
    COUNT(*) FILTER (WHERE compensation_mode <> 'compensated')::INTEGER,
    COALESCE(SUM(validation_cost) FILTER (WHERE compensation_mode = 'compensated'), 0)::NUMERIC(12,2)
  INTO
    v_compensated_users,
    v_skipped_votes,
    v_compensated_credit
  FROM tmp_manual_review_compensation;

  SELECT COUNT(*)::INTEGER
  INTO v_ledger_entries
  FROM public.financial_ledger fl
  WHERE fl.source_table = 'task_validation_compensation'
    AND fl.source_id LIKE (p_task_id::TEXT || ':%');

  UPDATE public.news_tasks
  SET
    consensus_reached = FALSE,
    consensus_status = 'voided',
    correct_verdict = NULL,
    settled_at = NULL,
    manual_resolved_at = NOW(),
    manual_resolved_by = auth.uid(),
    manual_resolution_note = v_resolution_note,
    manual_resolution_kind = 'void_compensation',
    manual_resolution_compensated_user_count = v_compensated_users,
    manual_resolution_compensated_credit = v_compensated_credit,
    manual_resolution_skipped_vote_count = v_skipped_votes,
    settlement_winner_count = 0,
    settlement_distributed_cents = 0
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'status', 'voided',
    'task_id', p_task_id,
    'compensated_users', v_compensated_users,
    'skipped_votes', v_skipped_votes,
    'compensated_credit', v_compensated_credit,
    'ledger_entries', v_ledger_entries,
    'manual_resolution', TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cancel_news_task(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cancel_news_task(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_void_news_task_manual_review(
  p_task_id UUID,
  p_resolution_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.admin_cancel_news_task(p_task_id, p_resolution_note);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_void_news_task_manual_review(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_void_news_task_manual_review(UUID, TEXT) TO authenticated;
