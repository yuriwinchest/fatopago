-- [2026-04-15] Permitir revalidação de notícias entre pacotes diferentes.
--
-- Problema: um usuário que comprou um pacote de 180, validou tudo e comprou
-- um novo pacote de 180 ficava sem notícias suficientes para validar quando
-- o pool aberto tinha menos de 180 itens novos. A regra anterior (bloquear
-- por ciclo semanal) impedia que ele revalidasse, no novo pacote, notícias
-- que ele já tinha validado no pacote anterior dentro do mesmo ciclo.
--
-- Regra nova:
--   1) Dentro do MESMO plan_purchase, continua proibido validar a mesma
--      notícia duas vezes (UNIQUE DB + check no RPC).
--   2) Em plan_purchases DIFERENTES, o usuário pode validar novamente a
--      mesma notícia (desde que ela ainda esteja aberta: consensus_status =
--      'open' AND consensus_reached = FALSE).
--   3) Para validações sem plan_purchase (somente crédito compensatório),
--      mantém-se o bloqueio por ciclo (fallback conservador).
--
-- Consequências:
--   - Financeiro: cada validação consome 1 slot do pacote ativo; revalidar
--     em um novo pacote consome o slot do novo pacote, não do antigo.
--   - Consenso: a função weighted_consensus continua operando sobre
--     validations agregadas; revalidações do mesmo usuário no mesmo task
--     em pacotes diferentes NÃO devem ser contadas em dobro para consenso.
--     Isso é garantido ajustando a view/funcao de consenso para DISTINCT
--     por (task_id, user_id) — ver bloco ao final.

-- 1) UNIQUE DB por (user_id, task_id, plan_purchase_id):
--    Protege contra dupla-submissão concorrente dentro do mesmo pacote.
--    Propositalmente parcial (WHERE plan_purchase_id IS NOT NULL) para
--    não afetar validações puramente compensatórias (plan_purchase_id NULL).

DROP INDEX IF EXISTS public.validations_user_task_plan_unique_idx;
CREATE UNIQUE INDEX validations_user_task_plan_unique_idx
  ON public.validations (user_id, task_id, plan_purchase_id)
  WHERE user_id IS NOT NULL
    AND task_id IS NOT NULL
    AND plan_purchase_id IS NOT NULL;

-- 2) Índice auxiliar para lookup do hub por pacote ativo.
CREATE INDEX IF NOT EXISTS validations_user_plan_task_lookup_idx
  ON public.validations (user_id, plan_purchase_id, task_id)
  WHERE user_id IS NOT NULL
    AND plan_purchase_id IS NOT NULL;

-- 3.0) Remove overload obsoleta de 4 parâmetros (de 20260402164500) que
--      ficou pendurada após a adição do p_proof_image_url em 20260409103000.
--      PostgREST poderia rotear chamadas de 4 params para ela e burlar a
--      nova regra de duplicidade por pacote.
DROP FUNCTION IF EXISTS public.submit_validation(uuid, boolean, text, text);

-- 3) Reescrita do RPC submit_validation:
--    - Plan lookup ACONTECE ANTES da checagem de duplicidade (precisa do id).
--    - Dup check passa a ser por plan_purchase_id (ou por ciclo se sem plano).
--    - Advisory lock inclui plan_id para evitar lock contention desnecessário
--      entre pacotes distintos.

CREATE OR REPLACE FUNCTION public.submit_validation(
  p_task_id UUID,
  p_verdict BOOLEAN,
  p_justification TEXT DEFAULT NULL,
  p_proof_link TEXT DEFAULT NULL,
  p_proof_image_url TEXT DEFAULT NULL
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
  v_task_closed BOOLEAN;
  v_task_status TEXT;
  v_is_admin_post BOOLEAN;
  v_category TEXT;
  v_cost NUMERIC(12,2);
  v_comp_balance NUMERIC(12,2) := 0;
  v_comp_used NUMERIC(12,2) := 0;
  v_plan_debit NUMERIC(12,2) := 0;
  v_validation_id UUID;
  v_current_cycle_start TIMESTAMPTZ;
  v_justification TEXT := NULLIF(btrim(COALESCE(p_justification, '')), '');
  v_proof_link TEXT := NULLIF(btrim(COALESCE(p_proof_link, '')), '');
  v_proof_image_url TEXT := NULLIF(btrim(COALESCE(p_proof_image_url, '')), '');
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_lastname TEXT;
  v_user_city TEXT;
  v_user_state TEXT;
  v_user_phone TEXT;
  v_duplicate_exists BOOLEAN := FALSE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Não autenticado');
  END IF;

  IF p_verdict IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Veredito inválido');
  END IF;

  IF p_verdict IS FALSE THEN
    IF v_justification IS NULL OR length(v_justification) < 10 THEN
      RETURN json_build_object('status', 'error', 'message', 'Para validar como falsa, informe uma justificativa com pelo menos 10 caracteres');
    END IF;

    IF v_proof_link IS NULL THEN
      RETURN json_build_object('status', 'error', 'message', 'Para validar como falsa, informe o link da fonte ou da prova');
    END IF;

    IF v_proof_image_url IS NULL THEN
      RETURN json_build_object('status', 'error', 'message', 'Para validar como falsa, anexe a foto da evidência');
    END IF;
  ELSE
    v_justification := NULL;
    v_proof_link := NULL;
    v_proof_image_url := NULL;
  END IF;

  IF v_proof_link IS NOT NULL THEN
    IF length(v_proof_link) > 1000 OR v_proof_link !~* '^https?://' THEN
      RETURN json_build_object('status', 'error', 'message', 'Informe um link de prova válido com http:// ou https://');
    END IF;

    IF v_proof_link ~ '[[:space:]]' THEN
      RETURN json_build_object('status', 'error', 'message', 'O link de prova não pode conter espaços');
    END IF;
  END IF;

  IF v_proof_image_url IS NOT NULL THEN
    IF length(v_proof_image_url) > 1000 OR v_proof_image_url !~* '^https?://' THEN
      RETURN json_build_object('status', 'error', 'message', 'A URL da foto da evidência é inválida');
    END IF;

    IF v_proof_image_url ~ '[[:space:]]' THEN
      RETURN json_build_object('status', 'error', 'message', 'A URL da foto da evidência não pode conter espaços');
    END IF;
  END IF;

  -- Profile guard (mantido da migration 20260409220000).
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
    id, name, lastname, city, state,
    reputation_score, current_balance, compensatory_credit_balance,
    is_active, created_at, updated_at, email, phone, plan_status
  )
  VALUES (
    v_user_id,
    COALESCE(v_user_name, 'Usuário'),
    COALESCE(v_user_lastname, ''),
    COALESCE(v_user_city, ''),
    COALESCE(v_user_state, ''),
    0, 0, 0,
    TRUE, NOW(), NOW(),
    v_user_email, v_user_phone, 'none'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    updated_at = NOW();

  -- Carrega a notícia com lock (confirma status atual).
  SELECT
    content->>'category',
    COALESCE(consensus_reached, FALSE),
    COALESCE(consensus_status, 'open'),
    COALESCE(is_admin_post, FALSE)
  INTO
    v_category,
    v_task_closed,
    v_task_status,
    v_is_admin_post
  FROM public.news_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Tarefa não encontrada');
  END IF;

  IF NOT v_is_admin_post AND (v_task_closed OR v_task_status <> 'open') THEN
    RETURN json_build_object('status', 'error', 'message', 'Esta notícia não está mais aberta');
  END IF;

  -- Plano ativo (SE existir). Necessário ANTES da dup-check para saber
  -- qual pacote está sendo consumido.
  SELECT *
  INTO v_plan
  FROM public.plan_purchases
  WHERE user_id = v_user_id
    AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  -- Advisory lock pelo triplo (user, task, plan) — evita que duas chamadas
  -- paralelas do MESMO pacote dupliquem a inserção. Ciclos diferentes ou
  -- pacotes diferentes não travam entre si.
  PERFORM pg_advisory_xact_lock(
    hashtext(
      v_user_id::TEXT || ':' ||
      p_task_id::TEXT || ':' ||
      COALESCE(v_plan.id::TEXT, 'no-plan')
    )
  );

  -- Checagem de duplicidade:
  --  - COM plano: por plan_purchase_id (permite revalidar em novo pacote).
  --  - SEM plano (só compensatório): por ciclo semanal atual (comportamento
  --    anterior, conservador).
  IF v_plan.id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.validations
      WHERE user_id = v_user_id
        AND task_id = p_task_id
        AND plan_purchase_id = v_plan.id
    ) INTO v_duplicate_exists;

    IF v_duplicate_exists THEN
      RETURN json_build_object('status', 'error', 'message', 'Você já validou esta notícia neste pacote');
    END IF;
  ELSE
    SELECT c.cycle_start_at
    INTO v_current_cycle_start
    FROM public.get_weekly_cycle_window(NOW(), 0) c;

    SELECT EXISTS (
      SELECT 1
      FROM public.validations
      WHERE user_id = v_user_id
        AND task_id = p_task_id
        AND plan_purchase_id IS NULL
        AND created_at >= v_current_cycle_start
    ) INTO v_duplicate_exists;

    IF v_duplicate_exists THEN
      RETURN json_build_object('status', 'error', 'message', 'Você já validou esta notícia neste ciclo');
    END IF;
  END IF;

  -- Carrega profile sob lock para ajustar crédito compensatório.
  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  v_cost := GREATEST(COALESCE(public.get_validation_cost_by_category(v_category), 1.00), 0.01);
  v_comp_balance := GREATEST(COALESCE(v_profile.compensatory_credit_balance, 0), 0);
  v_comp_used := LEAST(v_comp_balance, v_cost);
  v_plan_debit := GREATEST(v_cost - v_comp_used, 0);

  IF v_plan_debit > 0 AND (v_plan.id IS NULL OR v_plan.validation_credit_remaining < v_plan_debit) THEN
    RETURN json_build_object('status', 'error', 'message', 'Crédito insuficiente');
  END IF;

  INSERT INTO public.validations (
    task_id,
    user_id,
    plan_purchase_id,
    verdict,
    justification,
    proof_link,
    proof_image_url
  )
  VALUES (
    p_task_id,
    v_user_id,
    v_plan.id,
    p_verdict,
    v_justification,
    v_proof_link,
    v_proof_image_url
  )
  RETURNING id INTO v_validation_id;

  UPDATE public.profiles
  SET compensatory_credit_balance = v_comp_balance - v_comp_used
  WHERE id = v_user_id;

  IF v_plan.id IS NOT NULL THEN
    UPDATE public.plan_purchases
    SET
      used_validations = used_validations + 1,
      validation_credit_remaining = validation_credit_remaining - v_plan_debit,
      last_validation_at = NOW(),
      updated_at = NOW(),
      status = CASE
        WHEN (validation_credit_remaining - v_plan_debit) <= 0.009 THEN 'completed'
        ELSE 'active'
      END,
      completed_at = CASE
        WHEN (validation_credit_remaining - v_plan_debit) <= 0.009 THEN NOW()
        ELSE completed_at
      END
    WHERE id = v_plan.id;
  END IF;

  RETURN json_build_object('status', 'success', 'validation_id', v_validation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

-- 4) RPC auxiliar para o hub front-end descobrir o plan_purchase ativo
--    sem vazar o select completo da tabela via PostgREST/RLS.
CREATE OR REPLACE FUNCTION public.get_active_plan_purchase_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_plan_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id
  INTO v_plan_id
  FROM public.plan_purchases
  WHERE user_id = v_user_id
    AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1;

  RETURN v_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_plan_purchase_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_plan_purchase_id() TO authenticated;

-- 5) settle_news_task: blindagem contra Sybil via revalidação
--
-- Ao permitir que um usuário revalide uma notícia em um novo pacote, abrimos
-- a possibilidade de a mesma (user_id, task_id) aparecer MAIS DE UMA VEZ em
-- public.validations. As agregações atuais de `settle_news_task` somariam
-- reputação/peso por linha, contariam winners duas vezes e dariam UPDATE
-- com semântica indefinida no reputation_score. Inaceitável.
--
-- Solução: em todas as agregações de consenso, colapsar para UMA linha por
-- (user_id, task_id) — a PRIMEIRA validação por created_at (a que o usuário
-- registrou antes, no pacote em que se comprometeu originalmente). As
-- revalidações seguintes seguem debitando slot do pacote (ledger) mas não
-- alteram a decisão de consenso, o pagamento do vencedor nem a reputação.
--
-- Essa função é uma REESCRITA integral de settle_news_task (baseada na
-- versão da migration 20260401184500) trocando apenas os 3 blocos que
-- agregam validations — o restante do fluxo fica idêntico.

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

  -- Agregação 1/3: dedupe por user (primeira validação).
  WITH first_validation AS (
    SELECT DISTINCT ON (v.user_id)
      v.user_id,
      v.verdict,
      v.created_at,
      v.id
    FROM public.validations v
    WHERE v.task_id = p_task_id
      AND v.user_id IS NOT NULL
    ORDER BY v.user_id, v.created_at ASC, v.id ASC
  )
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE fv.verdict IS TRUE)::INTEGER,
    COUNT(*) FILTER (WHERE fv.verdict IS FALSE)::INTEGER,
    COUNT(*) FILTER (WHERE COALESCE(p.reputation_score, 0) >= v_min_reputation)::INTEGER,
    COUNT(*) FILTER (WHERE COALESCE(p.reputation_score, 0) < v_min_reputation)::INTEGER,
    COALESCE(SUM(
      CASE
        WHEN fv.verdict IS TRUE AND COALESCE(p.reputation_score, 0) >= v_min_reputation
          THEN COALESCE(p.reputation_score, 0)
        ELSE 0
      END
    ), 0)::NUMERIC(18,2),
    COALESCE(SUM(
      CASE
        WHEN fv.verdict IS FALSE AND COALESCE(p.reputation_score, 0) >= v_min_reputation
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
  FROM first_validation fv
  LEFT JOIN public.profiles p
    ON p.id = fv.user_id;

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

  -- Agregação 2/3: winners dedupe por user (evita pagamento duplicado).
  CREATE TEMP TABLE tmp_task_settlement_winners ON COMMIT DROP AS
  WITH first_validation AS (
    SELECT DISTINCT ON (v.user_id)
      v.user_id,
      v.verdict,
      v.created_at,
      v.id
    FROM public.validations v
    WHERE v.task_id = p_task_id
      AND v.user_id IS NOT NULL
    ORDER BY v.user_id, v.created_at ASC, v.id ASC
  )
  SELECT
    fv.user_id,
    ROW_NUMBER() OVER (ORDER BY fv.created_at ASC, fv.id ASC) AS rn
  FROM first_validation fv
  JOIN public.profiles p
    ON p.id = fv.user_id
  WHERE fv.verdict = v_correct_verdict
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

  -- Agregação 3/3: reputação dedupe por user (evita UPDATE com múltiplas
  -- linhas matching — comportamento indefinido em Postgres).
  WITH first_validation AS (
    SELECT DISTINCT ON (v.user_id)
      v.user_id,
      v.verdict
    FROM public.validations v
    WHERE v.task_id = p_task_id
      AND v.user_id IS NOT NULL
    ORDER BY v.user_id, v.created_at ASC, v.id ASC
  )
  UPDATE public.profiles pr
  SET
    reputation_score = CASE
      WHEN fv.verdict = v_correct_verdict THEN COALESCE(pr.reputation_score, 0) + 10
      ELSE GREATEST(COALESCE(pr.reputation_score, 0) - 30, 0)
    END,
    updated_at = NOW()
  FROM first_validation fv
  WHERE fv.user_id = pr.id;

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

REVOKE ALL ON FUNCTION public.settle_news_task(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_news_task(UUID, INTEGER) TO service_role;
