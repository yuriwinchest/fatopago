-- Persistencia imutavel de contagem de validacoes por ciclo.
-- Objetivos:
-- 1) impedir que limpeza/recriacao de news_tasks reduza o historico do ranking
-- 2) manter a contagem do ciclo independente da tabela public.validations
-- 3) backfill defensivo usando validacoes existentes + diferenca segura por plan_purchases

CREATE TABLE IF NOT EXISTS public.user_validation_cycle_stats (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle_start_at TIMESTAMPTZ NOT NULL,
  cycle_end_at TIMESTAMPTZ NOT NULL,
  validations_count INTEGER NOT NULL DEFAULT 0 CHECK (validations_count >= 0),
  last_validation_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, cycle_start_at)
);

CREATE INDEX IF NOT EXISTS user_validation_cycle_stats_cycle_rank_idx
  ON public.user_validation_cycle_stats (cycle_start_at, validations_count DESC, last_validation_at DESC, user_id);

CREATE OR REPLACE FUNCTION public.touch_user_validation_cycle_stats_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_validation_cycle_stats_touch_updated_at ON public.user_validation_cycle_stats;
CREATE TRIGGER user_validation_cycle_stats_touch_updated_at
BEFORE UPDATE ON public.user_validation_cycle_stats
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_validation_cycle_stats_updated_at();

-- Backfill base: todas as linhas ainda existentes em public.validations.
WITH validation_rollup AS (
  SELECT
    v.user_id,
    c.cycle_start_at,
    c.cycle_end_at,
    COUNT(*)::INTEGER AS validations_count,
    MAX(v.created_at) AS last_validation_at
  FROM public.validations v
  CROSS JOIN LATERAL public.get_weekly_cycle_window(v.created_at, 0) c
  WHERE v.user_id IS NOT NULL
  GROUP BY
    v.user_id,
    c.cycle_start_at,
    c.cycle_end_at
)
INSERT INTO public.user_validation_cycle_stats (
  user_id,
  cycle_start_at,
  cycle_end_at,
  validations_count,
  last_validation_at
)
SELECT
  vr.user_id,
  vr.cycle_start_at,
  vr.cycle_end_at,
  vr.validations_count,
  vr.last_validation_at
FROM validation_rollup vr
ON CONFLICT (user_id, cycle_start_at) DO UPDATE
SET
  cycle_end_at = EXCLUDED.cycle_end_at,
  validations_count = GREATEST(public.user_validation_cycle_stats.validations_count, EXCLUDED.validations_count),
  last_validation_at = GREATEST(
    COALESCE(public.user_validation_cycle_stats.last_validation_at, EXCLUDED.last_validation_at),
    COALESCE(EXCLUDED.last_validation_at, public.user_validation_cycle_stats.last_validation_at)
  ),
  updated_at = NOW();

-- Backfill complementar:
-- recupera a diferenca entre used_validations e as linhas ainda existentes por plan_purchase.
-- Para evitar distribuicao incorreta entre ciclos, so aplica quando o inicio do plano e
-- o ultimo ponto de atividade conhecido resolvem para o mesmo ciclo semanal.
WITH validation_rows_by_plan AS (
  SELECT
    v.plan_purchase_id,
    COUNT(*)::INTEGER AS persisted_validations
  FROM public.validations v
  WHERE v.plan_purchase_id IS NOT NULL
  GROUP BY v.plan_purchase_id
),
plan_gaps AS (
  SELECT
    pp.id AS plan_purchase_id,
    pp.user_id,
    GREATEST(COALESCE(pp.used_validations, 0) - COALESCE(vrbp.persisted_validations, 0), 0)::INTEGER AS missing_validations,
    pp.started_at,
    COALESCE(pp.last_validation_at, pp.completed_at, pp.started_at) AS activity_at
  FROM public.plan_purchases pp
  LEFT JOIN validation_rows_by_plan vrbp
    ON vrbp.plan_purchase_id = pp.id
  WHERE pp.user_id IS NOT NULL
    AND GREATEST(COALESCE(pp.used_validations, 0) - COALESCE(vrbp.persisted_validations, 0), 0) > 0
    AND (
      COALESCE(pp.status, '') = 'completed'
      OR COALESCE(pp.validation_credit_remaining, 0) <= 0.009
    )
),
resolved_plan_gaps AS (
  SELECT
    pg.user_id,
    activity_cycle.cycle_start_at,
    activity_cycle.cycle_end_at,
    pg.missing_validations,
    pg.activity_at
  FROM plan_gaps pg
  CROSS JOIN LATERAL public.get_weekly_cycle_window(pg.started_at, 0) start_cycle
  CROSS JOIN LATERAL public.get_weekly_cycle_window(pg.activity_at, 0) activity_cycle
  WHERE pg.started_at IS NOT NULL
    AND pg.activity_at IS NOT NULL
    AND start_cycle.cycle_start_at = activity_cycle.cycle_start_at
),
plan_gap_rollup AS (
  SELECT
    rpg.user_id,
    rpg.cycle_start_at,
    rpg.cycle_end_at,
    SUM(rpg.missing_validations)::INTEGER AS validations_count,
    MAX(rpg.activity_at) AS last_validation_at
  FROM resolved_plan_gaps rpg
  GROUP BY
    rpg.user_id,
    rpg.cycle_start_at,
    rpg.cycle_end_at
)
INSERT INTO public.user_validation_cycle_stats (
  user_id,
  cycle_start_at,
  cycle_end_at,
  validations_count,
  last_validation_at
)
SELECT
  pgr.user_id,
  pgr.cycle_start_at,
  pgr.cycle_end_at,
  pgr.validations_count,
  pgr.last_validation_at
FROM plan_gap_rollup pgr
ON CONFLICT (user_id, cycle_start_at) DO UPDATE
SET
  cycle_end_at = EXCLUDED.cycle_end_at,
  validations_count = public.user_validation_cycle_stats.validations_count + EXCLUDED.validations_count,
  last_validation_at = GREATEST(
    COALESCE(public.user_validation_cycle_stats.last_validation_at, EXCLUDED.last_validation_at),
    COALESCE(EXCLUDED.last_validation_at, public.user_validation_cycle_stats.last_validation_at)
  ),
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.get_live_validation_ranking(
  p_state TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_cycle_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  lastname TEXT,
  city TEXT,
  state TEXT,
  current_balance NUMERIC,
  reputation_score NUMERIC,
  validations_count INTEGER,
  last_validation_at TIMESTAMPTZ,
  avatar_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cycle AS (
    SELECT *
    FROM public.get_weekly_cycle_window(now(), p_cycle_offset)
  )
  SELECT
    p.id,
    p.name,
    p.lastname,
    p.city,
    p.state,
    p.current_balance,
    p.reputation_score,
    s.validations_count,
    s.last_validation_at,
    p.avatar_url
  FROM public.user_validation_cycle_stats s
  CROSS JOIN cycle c
  JOIN public.profiles p
    ON p.id = s.user_id
  WHERE s.cycle_start_at = c.cycle_start_at
    AND (p_state IS NULL OR btrim(p_state) = '' OR upper(COALESCE(p.state, '')) LIKE '%' || upper(btrim(p_state)) || '%')
    AND (p_city IS NULL OR btrim(p_city) = '' OR lower(COALESCE(p.city, '')) LIKE '%' || lower(btrim(p_city)) || '%')
  ORDER BY s.validations_count DESC, s.last_validation_at DESC, p.id
  LIMIT LEAST(GREATEST(p_limit, 0), 500);
$$;

REVOKE ALL ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;

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
  v_validation_created_at TIMESTAMPTZ;
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
    COALESCE(v_user_name, 'Usuário'),
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
    phone = COALESCE(public.profiles.phone, EXCLUDED.phone),
    updated_at = NOW();

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

  SELECT *
  INTO v_plan
  FROM public.plan_purchases
  WHERE user_id = v_user_id
    AND status = 'active'
  ORDER BY started_at DESC
  LIMIT 1
  FOR UPDATE;

  SELECT c.cycle_start_at
  INTO v_current_cycle_start
  FROM public.get_weekly_cycle_window(NOW(), 0) c;

  IF EXISTS (
    SELECT 1
    FROM public.validations
    WHERE user_id = v_user_id
      AND task_id = p_task_id
      AND created_at >= v_current_cycle_start
  ) THEN
    RETURN json_build_object('status', 'error', 'message', 'Você já validou esta notícia neste ciclo');
  END IF;

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
  RETURNING id, created_at INTO v_validation_id, v_validation_created_at;

  INSERT INTO public.user_validation_cycle_stats (
    user_id,
    cycle_start_at,
    cycle_end_at,
    validations_count,
    last_validation_at
  )
  SELECT
    v_user_id,
    c.cycle_start_at,
    c.cycle_end_at,
    1,
    v_validation_created_at
  FROM public.get_weekly_cycle_window(v_validation_created_at, 0) c
  ON CONFLICT (user_id, cycle_start_at) DO UPDATE
  SET
    cycle_end_at = EXCLUDED.cycle_end_at,
    validations_count = public.user_validation_cycle_stats.validations_count + 1,
    last_validation_at = GREATEST(
      COALESCE(public.user_validation_cycle_stats.last_validation_at, EXCLUDED.last_validation_at),
      COALESCE(EXCLUDED.last_validation_at, public.user_validation_cycle_stats.last_validation_at)
    ),
    updated_at = NOW();

  UPDATE public.profiles
  SET compensatory_credit_balance = v_comp_balance - v_comp_used
  WHERE id = v_user_id;

  IF v_plan.id IS NOT NULL THEN
    UPDATE public.plan_purchases
    SET
      used_validations = used_validations + 1,
      validation_credit_remaining = validation_credit_remaining - v_plan_debit,
      last_validation_at = v_validation_created_at,
      updated_at = NOW(),
      status = CASE
        WHEN (validation_credit_remaining - v_plan_debit) <= 0.009 THEN 'completed'
        ELSE 'active'
      END,
      completed_at = CASE
        WHEN (validation_credit_remaining - v_plan_debit) <= 0.009 THEN COALESCE(completed_at, v_validation_created_at)
        ELSE NULL
      END
    WHERE id = v_plan.id;
  END IF;

  RETURN json_build_object('status', 'success', 'validation_id', v_validation_id);
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
BEGIN
  RETURN public.submit_validation(
    p_task_id,
    p_verdict,
    p_justification,
    p_proof_link,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;
