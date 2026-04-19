ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'validation-proofs',
  'validation-proofs',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Validation proof images are publicly readable'
  ) THEN
    CREATE POLICY "Validation proof images are publicly readable"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'validation-proofs');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload own validation proofs'
  ) THEN
    CREATE POLICY "Users can upload own validation proofs"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'validation-proofs'
      AND (storage.foldername(name))[1] = (auth.uid())::text
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update own validation proofs'
  ) THEN
    CREATE POLICY "Users can update own validation proofs"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'validation-proofs'
      AND (storage.foldername(name))[1] = (auth.uid())::text
    )
    WITH CHECK (
      bucket_id = 'validation-proofs'
      AND (storage.foldername(name))[1] = (auth.uid())::text
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete own validation proofs'
  ) THEN
    CREATE POLICY "Users can delete own validation proofs"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'validation-proofs'
      AND (storage.foldername(name))[1] = (auth.uid())::text
    );
  END IF;
END $$;

ALTER TABLE public.news_task_manual_review_votes
  ADD COLUMN IF NOT EXISTS proof_image_url TEXT;

UPDATE public.news_task_manual_review_votes s
SET
  justification = v.justification,
  proof_link = v.proof_link,
  proof_image_url = v.proof_image_url
FROM public.validations v
WHERE v.id = s.validation_id
  AND (
    s.justification IS DISTINCT FROM v.justification
    OR s.proof_link IS DISTINCT FROM v.proof_link
    OR s.proof_image_url IS DISTINCT FROM v.proof_image_url
  );

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
    proof_link,
    proof_image_url
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
    v.proof_link,
    v.proof_image_url
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
    proof_link = EXCLUDED.proof_link,
    proof_image_url = EXCLUDED.proof_image_url;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_news_task_manual_review_snapshot(UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.capture_news_task_manual_review_snapshot(UUID, NUMERIC) TO service_role;

DROP FUNCTION IF EXISTS public.admin_get_news_task_manual_review_votes(UUID);

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
  proof_link TEXT,
  proof_image_url TEXT
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
    s.proof_link,
    s.proof_image_url
  FROM public.news_task_manual_review_votes s
  LEFT JOIN public.profiles p
    ON p.id = s.user_id
  WHERE s.task_id = p_task_id
  ORDER BY s.validation_created_at ASC, s.validation_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_news_task_manual_review_votes(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_news_task_manual_review_votes(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.get_public_fake_news(INTEGER);

CREATE OR REPLACE FUNCTION public.get_public_fake_news(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  task_id UUID,
  verdict BOOLEAN,
  justification TEXT,
  proof_link TEXT,
  proof_image_url TEXT,
  created_at TIMESTAMPTZ,
  news_id UUID,
  news_title TEXT,
  news_description TEXT,
  news_category TEXT,
  news_source TEXT,
  news_image_url TEXT,
  user_name TEXT,
  user_lastname TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.task_id,
    v.verdict,
    v.justification,
    v.proof_link,
    v.proof_image_url,
    v.created_at,
    nt.id AS news_id,
    nt.content->>'title' AS news_title,
    nt.content->>'description' AS news_description,
    nt.content->>'category' AS news_category,
    nt.content->>'source' AS news_source,
    nt.content->>'image_url' AS news_image_url,
    p.name AS user_name,
    p.lastname AS user_lastname
  FROM public.validations v
  INNER JOIN public.news_tasks nt
    ON nt.id = v.task_id
  LEFT JOIN public.profiles p
    ON p.id = v.user_id
  WHERE v.verdict IS FALSE
  ORDER BY v.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_fake_news(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_fake_news(INTEGER) TO authenticated;

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
