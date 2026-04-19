-- Harden news task settlement:
-- 1) Atomic consensus + payout with row lock
-- 2) Idempotent ledger credits per (task,user)
-- 3) Integer-cents split to avoid fractional drift
-- 4) Task metadata to prevent re-open / aid audit

ALTER TABLE public.news_tasks
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_total_votes INTEGER,
  ADD COLUMN IF NOT EXISTS settlement_true_votes INTEGER,
  ADD COLUMN IF NOT EXISTS settlement_false_votes INTEGER,
  ADD COLUMN IF NOT EXISTS settlement_winner_count INTEGER,
  ADD COLUMN IF NOT EXISTS settlement_reward_cents INTEGER,
  ADD COLUMN IF NOT EXISTS settlement_distributed_cents INTEGER;

CREATE OR REPLACE FUNCTION public.settle_news_task(
  p_task_id UUID,
  p_min_votes INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task RECORD;
  v_min_votes INTEGER := GREATEST(COALESCE(p_min_votes, 3), 1);
  v_total_votes INTEGER := 0;
  v_true_votes INTEGER := 0;
  v_false_votes INTEGER := 0;
  v_correct_verdict BOOLEAN;
  v_reward_raw TEXT;
  v_reward_numeric NUMERIC(18,6) := 0;
  v_reward_cents INTEGER := 0;
  v_winner_count INTEGER := 0;
  v_base_cents INTEGER := 0;
  v_remainder_cents INTEGER := 0;
  v_inserted_entries INTEGER := 0;
  v_distributed_cents INTEGER := 0;
BEGIN
  IF p_task_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'task_id inválido');
  END IF;

  SELECT
    nt.id,
    nt.content,
    nt.consensus_reached,
    nt.correct_verdict,
    nt.settled_at,
    nt.settlement_distributed_cents
  INTO v_task
  FROM public.news_tasks nt
  WHERE nt.id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Tarefa não encontrada');
  END IF;

  IF COALESCE(v_task.consensus_reached, FALSE) THEN
    RETURN jsonb_build_object(
      'status', 'already_settled',
      'task_id', p_task_id,
      'correct_verdict', v_task.correct_verdict,
      'distributed_cents', COALESCE(v_task.settlement_distributed_cents, 0),
      'settled_at', v_task.settled_at
    );
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE v.verdict IS TRUE)::INTEGER,
    COUNT(*) FILTER (WHERE v.verdict IS FALSE)::INTEGER
  INTO
    v_total_votes,
    v_true_votes,
    v_false_votes
  FROM public.validations v
  WHERE v.task_id = p_task_id;

  IF v_total_votes < v_min_votes THEN
    RETURN jsonb_build_object(
      'status', 'pending_min_votes',
      'task_id', p_task_id,
      'total_votes', v_total_votes,
      'required_votes', v_min_votes
    );
  END IF;

  IF v_true_votes = v_false_votes THEN
    RETURN jsonb_build_object(
      'status', 'tie',
      'task_id', p_task_id,
      'true_votes', v_true_votes,
      'false_votes', v_false_votes
    );
  END IF;

  v_correct_verdict := (v_true_votes > v_false_votes);
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
  WHERE v.task_id = p_task_id
    AND v.user_id IS NOT NULL
    AND v.verdict = v_correct_verdict;

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
        'Crédito por consenso da notícia',
        'completed',
        auth.uid(),
        jsonb_build_object(
          'task_id', p_task_id,
          'consensus_verdict', v_correct_verdict,
          'true_votes', v_true_votes,
          'false_votes', v_false_votes
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

  UPDATE public.news_tasks
  SET
    consensus_reached = TRUE,
    correct_verdict = v_correct_verdict,
    settled_at = NOW(),
    settlement_total_votes = v_total_votes,
    settlement_true_votes = v_true_votes,
    settlement_false_votes = v_false_votes,
    settlement_winner_count = v_winner_count,
    settlement_reward_cents = v_reward_cents,
    settlement_distributed_cents = v_distributed_cents
  WHERE id = p_task_id;

  RETURN jsonb_build_object(
    'status', 'settled',
    'task_id', p_task_id,
    'correct_verdict', v_correct_verdict,
    'total_votes', v_total_votes,
    'winner_count', v_winner_count,
    'reward_cents', v_reward_cents,
    'distributed_cents', v_distributed_cents,
    'ledger_entries', v_inserted_entries
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.settle_open_news_tasks(
  p_limit INTEGER DEFAULT 50,
  p_min_votes INTEGER DEFAULT 3
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
    ORDER BY nt.created_at ASC
    LIMIT v_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    v_result := public.settle_news_task(v_task_id, p_min_votes);
    task_id := v_task_id;
    status := COALESCE(v_result->>'status', 'error');
    message := COALESCE(v_result->>'message', '');
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_news_task(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.settle_open_news_tasks(INTEGER, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.settle_news_task(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_open_news_tasks(INTEGER, INTEGER) TO service_role;

