ALTER TABLE public.news_tasks
ADD COLUMN IF NOT EXISTS manual_resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manual_resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS manual_resolution_note TEXT;

CREATE TABLE IF NOT EXISTS public.news_task_manual_review_votes (
  task_id UUID NOT NULL REFERENCES public.news_tasks(id) ON DELETE CASCADE,
  validation_id UUID NOT NULL REFERENCES public.validations(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_purchase_id UUID NULL REFERENCES public.plan_purchases(id) ON DELETE SET NULL,
  verdict BOOLEAN NOT NULL,
  validation_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  reputation_score_snapshot NUMERIC(12,2) NOT NULL DEFAULT 0,
  eligible_for_consensus BOOLEAN NOT NULL DEFAULT FALSE,
  validation_created_at TIMESTAMPTZ NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, validation_id)
);

CREATE INDEX IF NOT EXISTS idx_news_task_manual_review_votes_task
  ON public.news_task_manual_review_votes (task_id, eligible_for_consensus, verdict, validation_created_at);

ALTER TABLE public.news_task_manual_review_votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.news_task_manual_review_votes FROM PUBLIC;
REVOKE ALL ON TABLE public.news_task_manual_review_votes FROM anon;
REVOKE ALL ON TABLE public.news_task_manual_review_votes FROM authenticated;

DROP POLICY IF EXISTS news_task_manual_review_votes_admin_select ON public.news_task_manual_review_votes;
CREATE POLICY news_task_manual_review_votes_admin_select
ON public.news_task_manual_review_votes
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

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
    RAISE EXCEPTION 'task_id inválido para snapshot de revisão manual';
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
    captured_at
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
    NOW()
  FROM public.validations v
  LEFT JOIN public.profiles p
    ON p.id = v.user_id
  LEFT JOIN public.financial_ledger fl
    ON fl.source_table = 'validations'
   AND fl.source_id = v.id::TEXT
   AND fl.entry_type = 'debit'
  WHERE v.task_id = v_task_id
  ON CONFLICT (task_id, validation_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_news_task_manual_review_snapshot(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_news_task_manual_review_snapshot(UUID, NUMERIC) TO service_role;

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
    PERFORM public.capture_news_task_manual_review_snapshot(p_task_id, v_min_reputation);

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
    PERFORM public.capture_news_task_manual_review_snapshot(p_task_id, v_min_reputation);

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
    PERFORM public.capture_news_task_manual_review_snapshot(p_task_id, v_min_reputation);

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
    PERFORM public.capture_news_task_manual_review_snapshot(p_task_id, v_min_reputation);

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

CREATE OR REPLACE FUNCTION public.admin_list_news_tasks_manual_review(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  cycle_start_at TIMESTAMPTZ,
  cycle_number INTEGER,
  title TEXT,
  category TEXT,
  source TEXT,
  reward_cents INTEGER,
  settlement_total_votes INTEGER,
  settlement_true_votes INTEGER,
  settlement_false_votes INTEGER,
  settlement_eligible_vote_count INTEGER,
  settlement_quarantined_vote_count INTEGER,
  settlement_true_weight NUMERIC,
  settlement_false_weight NUMERIC,
  settlement_total_weight NUMERIC,
  settlement_threshold_ratio NUMERIC,
  settlement_min_reputation NUMERIC,
  settlement_review_reason TEXT,
  consensus_closed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  PERFORM public.assert_fatopago_admin();

  RETURN QUERY
  SELECT
    nt.id,
    nt.created_at,
    nt.cycle_start_at,
    nt.cycle_number,
    nt.content->>'title' AS title,
    nt.content->>'category' AS category,
    nt.content->>'source' AS source,
    COALESCE(
      nt.settlement_reward_cents,
      CASE
        WHEN NULLIF(BTRIM(COALESCE(nt.content->>'reward', '')), '') ~ '^-?\d+(\.\d+)?$'
          THEN ROUND(GREATEST((nt.content->>'reward')::NUMERIC, 0) * 100)::INTEGER
        ELSE 0
      END,
      0
    ) AS reward_cents,
    nt.settlement_total_votes,
    nt.settlement_true_votes,
    nt.settlement_false_votes,
    nt.settlement_eligible_vote_count,
    nt.settlement_quarantined_vote_count,
    nt.settlement_true_weight,
    nt.settlement_false_weight,
    nt.settlement_total_weight,
    nt.settlement_threshold_ratio,
    nt.settlement_min_reputation,
    nt.settlement_review_reason,
    nt.consensus_closed_at
  FROM public.news_tasks nt
  WHERE COALESCE(nt.consensus_status, 'open') = 'manual_review'
    AND COALESCE(nt.consensus_reached, FALSE) = FALSE
  ORDER BY nt.consensus_closed_at DESC NULLS LAST, nt.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_news_tasks_manual_review(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_news_tasks_manual_review(INTEGER) TO authenticated;

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
  validation_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_fatopago_admin();

  IF p_task_id IS NULL THEN
    RAISE EXCEPTION 'task_id inválido para consulta de revisão manual.';
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
    s.validation_created_at
  FROM public.news_task_manual_review_votes s
  LEFT JOIN public.profiles p
    ON p.id = s.user_id
  WHERE s.task_id = p_task_id
  ORDER BY s.validation_created_at ASC, s.validation_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_news_task_manual_review_votes(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_news_task_manual_review_votes(UUID) TO authenticated;

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
    RAISE EXCEPTION 'task_id inválido para liquidação manual';
  END IF;

  SELECT *
  INTO v_task
  FROM public.news_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarefa não encontrada para liquidação manual.';
  END IF;

  IF COALESCE(v_task.consensus_reached, FALSE) OR COALESCE(v_task.consensus_status, 'open') = 'settled' THEN
    RETURN jsonb_build_object(
      'status', 'already_settled',
      'task_id', p_task_id,
      'correct_verdict', v_task.correct_verdict,
      'settled_at', v_task.settled_at
    );
  END IF;

  IF COALESCE(v_task.consensus_status, 'open') <> 'manual_review' THEN
    RAISE EXCEPTION 'A tarefa não está em revisão manual.';
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
        'Crédito por liquidação manual da notícia',
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

CREATE OR REPLACE FUNCTION public.run_open_news_task_settlement_job(
  p_limit INTEGER DEFAULT 50,
  p_min_votes INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_min_votes INTEGER := GREATEST(COALESCE(p_min_votes, 5), 1);
  v_processed INTEGER := 0;
  v_settled INTEGER := 0;
  v_manual_review INTEGER := 0;
  v_pending INTEGER := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.settle_open_news_tasks(v_limit, v_min_votes)
  LOOP
    v_processed := v_processed + 1;

    IF v_row.status = 'settled' THEN
      v_settled := v_settled + 1;
    ELSIF v_row.status = 'manual_review' THEN
      v_manual_review := v_manual_review + 1;
    ELSE
      v_pending := v_pending + 1;
    END IF;
  END LOOP;

  IF v_manual_review > 0 THEN
    INSERT INTO public.security_alerts (
      event_key,
      source,
      category,
      severity,
      title,
      message,
      metadata,
      occurrence_count,
      first_seen_at,
      last_seen_at,
      acknowledged_at,
      acknowledged_by,
      resolved_at,
      created_at,
      updated_at
    )
    VALUES (
      'news_task:settlement_manual_review',
      'news_task_settlement_job',
      'consensus',
      'high',
      'Tarefas de notícia exigem revisão manual',
      'O job de liquidação encontrou tarefas sem consenso robusto e as enviou para revisão administrativa.',
      jsonb_build_object(
        'processed', v_processed,
        'settled', v_settled,
        'manual_review', v_manual_review,
        'pending', v_pending
      ),
      1,
      NOW(),
      NOW(),
      NULL,
      NULL,
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (event_key) DO UPDATE
    SET
      source = EXCLUDED.source,
      category = EXCLUDED.category,
      severity = EXCLUDED.severity,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      metadata = EXCLUDED.metadata,
      occurrence_count = public.security_alerts.occurrence_count + 1,
      last_seen_at = NOW(),
      acknowledged_at = NULL,
      acknowledged_by = NULL,
      resolved_at = NULL,
      updated_at = NOW();
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'processed', v_processed,
    'settled', v_settled,
    'manual_review', v_manual_review,
    'pending', v_pending
  );
EXCEPTION
  WHEN OTHERS THEN
    INSERT INTO public.security_alerts (
      event_key,
      source,
      category,
      severity,
      title,
      message,
      metadata,
      occurrence_count,
      first_seen_at,
      last_seen_at,
      acknowledged_at,
      acknowledged_by,
      resolved_at,
      created_at,
      updated_at
    )
    VALUES (
      'news_task:settlement_job_failure',
      'news_task_settlement_job',
      'consensus',
      'critical',
      'Falha no job de liquidação de notícias',
      'O job de liquidação automática falhou e requer verificação imediata.',
      jsonb_build_object(
        'sqlstate', SQLSTATE,
        'error', SQLERRM,
        'limit', v_limit,
        'min_votes', v_min_votes
      ),
      1,
      NOW(),
      NOW(),
      NULL,
      NULL,
      NULL,
      NOW(),
      NOW()
    )
    ON CONFLICT (event_key) DO UPDATE
    SET
      source = EXCLUDED.source,
      category = EXCLUDED.category,
      severity = EXCLUDED.severity,
      title = EXCLUDED.title,
      message = EXCLUDED.message,
      metadata = EXCLUDED.metadata,
      occurrence_count = public.security_alerts.occurrence_count + 1,
      last_seen_at = NOW(),
      acknowledged_at = NULL,
      acknowledged_by = NULL,
      resolved_at = NULL,
      updated_at = NOW();

    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Falha no job de liquidação automática. Verifique os alertas administrativos.'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.run_open_news_task_settlement_job(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_open_news_task_settlement_job(INTEGER, INTEGER) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'news-task-settlement-worker'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'news-task-settlement-worker',
    '*/10 * * * *',
    $job$select public.run_open_news_task_settlement_job(50, 5);$job$
  );
END;
$$;
