-- Fix regression: a migração 20260409103000 removeu o guard de profile que
-- auto-inseria a linha em public.profiles a partir de auth.users antes de
-- gravar a validação. Isso reintroduziu o erro histórico
-- "validations_user_id_fkey ... is not present in table profiles", que no front
-- é exibido como "Seu cadastro está sendo sincronizado. Tente novamente...".
--
-- Esta migration restaura o guard dentro de submit_validation, mantendo toda
-- a lógica adicionada em 20260409103000 (proof_image_url, evidence required,
-- consensus/cycle checks, etc).

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

  -- Profile guard: garante que existe uma linha em public.profiles para o
  -- usuário autenticado antes de qualquer insert em validations (que possui
  -- FK validations_user_id_fkey -> profiles.id). Sem este guard, usuários
  -- cujo upsert client-side falhou no registro ficam travados com o erro
  -- "Seu cadastro está sendo sincronizado".
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
  RETURNING id INTO v_validation_id;

  UPDATE public.profiles
  SET compensatory_credit_balance = v_comp_balance - v_comp_used
  WHERE id = v_user_id;

  IF v_plan.id IS NOT NULL THEN
    UPDATE public.plan_purchases
    SET
      used_validations = used_validations + 1,
      validation_credit_remaining = validation_credit_remaining - v_plan_debit,
      status = CASE
        WHEN (validation_credit_remaining - v_plan_debit) <= 0.009 THEN 'completed'
        ELSE 'active'
      END
    WHERE id = v_plan.id;
  END IF;

  RETURN json_build_object('status', 'success', 'validation_id', v_validation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT, TEXT) TO authenticated;

-- Backfill defensivo: qualquer usuário auth sem profile ganha uma linha mínima.
-- Mantém compatibilidade com perfis existentes (ON CONFLICT DO NOTHING).
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
SELECT
  u.id,
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), 'Usuário'),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'lastname'), ''), ''),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'city'), ''), ''),
  COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'state'), ''), ''),
  0,
  0,
  0,
  TRUE,
  COALESCE(u.created_at, NOW()),
  NOW(),
  u.email,
  NULLIF(REGEXP_REPLACE(COALESCE(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), ''),
  'none'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
