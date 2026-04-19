CREATE OR REPLACE FUNCTION public.is_collaborator_user(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_user_id
      AND raw_user_meta_data->>'is_collaborator' = 'true'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_collaborator_user(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_news_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin_user(auth.uid()) OR public.is_collaborator_user(auth.uid())) THEN
    RAISE EXCEPTION 'Acesso negado: apenas admin ou colaborador de notcias pode executar esta ao.';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.assert_news_admin() TO authenticated;

-- UPDATE ALL NEWS FUNCTIONS TO USE assert_news_admin()

CREATE OR REPLACE FUNCTION public.admin_list_news_by_cycle(
  p_cycle_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  cycle_number INTEGER,
  cycle_start_at TIMESTAMPTZ,
  admin_priority INTEGER,
  title TEXT,
  description TEXT,
  full_text TEXT,
  category TEXT,
  source TEXT,
  image_url TEXT,
  link TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_news_admin();

  RETURN QUERY
  WITH cycle AS (
    SELECT *
    FROM public.get_weekly_cycle_window(now(), p_cycle_offset)
  )
  SELECT
    nt.id,
    nt.created_at,
    nt.cycle_number,
    nt.cycle_start_at,
    nt.admin_priority,
    nt.content->>'title' AS title,
    nt.content->>'description' AS description,
    nt.content->>'full_text' AS full_text,
    nt.content->>'category' AS category,
    nt.content->>'source' AS source,
    nt.content->>'image_url' AS image_url,
    nt.content->>'link' AS link
  FROM public.news_tasks nt
  CROSS JOIN cycle c
  WHERE nt.is_admin_post = TRUE
    AND nt.cycle_start_at = c.cycle_start_at
  ORDER BY nt.admin_priority ASC NULLS LAST, nt.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_list_news_by_cycle(INTEGER) TO authenticated;

-- CREATE NEWS TASK
CREATE OR REPLACE FUNCTION public.admin_create_news_task(
  p_title TEXT,
  p_description TEXT,
  p_full_text TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'Admin FatoPago',
  p_category TEXT DEFAULT 'Brasil',
  p_link TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_priority INTEGER DEFAULT 1
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_description TEXT;
  v_full_text TEXT;
  v_source TEXT;
  v_category TEXT;
  v_link TEXT;
  v_image_url TEXT;
  v_priority INTEGER;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_number INTEGER;
  v_id UUID;
BEGIN
  PERFORM public.assert_news_admin();

  v_title := LEFT(TRIM(COALESCE(p_title, '')), 220);
  v_description := TRIM(COALESCE(p_description, ''));
  v_full_text := TRIM(COALESCE(NULLIF(p_full_text, ''), v_description));
  v_source := LEFT(TRIM(COALESCE(NULLIF(p_source, ''), 'Admin FatoPago')), 90);
  v_category := LEFT(TRIM(COALESCE(NULLIF(p_category, ''), 'Brasil')), 60);
  v_link := NULLIF(TRIM(COALESCE(p_link, '')), '');
  v_image_url := NULLIF(TRIM(COALESCE(p_image_url, '')), '');
  v_priority := LEAST(GREATEST(COALESCE(p_priority, 1), 1), 20);

  IF LENGTH(v_title) < 6 THEN
    RAISE EXCEPTION 'Ttulo invlido (mnimo 6 caracteres).';
  END IF;

  IF LENGTH(v_description) < 20 THEN
    RAISE EXCEPTION 'Texto invlido (mnimo 20 caracteres).';
  END IF;

  SELECT nt.cycle_start_at, nt.cycle_number
    INTO v_cycle_start, v_cycle_number
  FROM public.news_tasks nt
  WHERE nt.cycle_start_at IS NOT NULL
    AND nt.cycle_start_at <= NOW()
  ORDER BY nt.cycle_start_at DESC, nt.created_at DESC
  LIMIT 1;

  IF v_cycle_start IS NULL THEN
    SELECT nt.cycle_start_at, nt.cycle_number
      INTO v_cycle_start, v_cycle_number
    FROM public.news_tasks nt
    WHERE nt.cycle_start_at IS NOT NULL
    ORDER BY nt.cycle_start_at DESC, nt.created_at DESC
    LIMIT 1;
  END IF;

  IF v_cycle_start IS NULL THEN
    v_cycle_start := date_trunc('day', NOW());
    v_cycle_number := 1;
  END IF;

  INSERT INTO public.news_tasks (
    content,
    cycle_start_at,
    cycle_number,
    is_admin_post,
    admin_priority,
    admin_created_by
  )
  VALUES (
    jsonb_build_object(
      'title', v_title,
      'description', v_description,
      'full_text', v_full_text,
      'source', v_source,
      'category', v_category,
      'difficulty', 'medium',
      'image_url', v_image_url,
      'link', v_link,
      'reward', 0
    ),
    v_cycle_start,
    COALESCE(v_cycle_number, 1),
    TRUE,
    v_priority,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_create_news_task(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

-- UPDATE NEWS TASK
CREATE OR REPLACE FUNCTION public.admin_update_news_task(
  p_task_id UUID,
  p_title TEXT,
  p_description TEXT,
  p_full_text TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'Admin FatoPago',
  p_category TEXT DEFAULT 'Brasil',
  p_link TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_priority INTEGER DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_description TEXT;
  v_full_text TEXT;
  v_source TEXT;
  v_category TEXT;
  v_link TEXT;
  v_image_url TEXT;
  v_priority INTEGER;
BEGIN
  PERFORM public.assert_news_admin();

  v_title := LEFT(TRIM(COALESCE(p_title, '')), 220);
  v_description := TRIM(COALESCE(p_description, ''));
  v_full_text := TRIM(COALESCE(NULLIF(p_full_text, ''), v_description));
  v_source := LEFT(TRIM(COALESCE(NULLIF(p_source, ''), 'Admin FatoPago')), 90);
  v_category := LEFT(TRIM(COALESCE(NULLIF(p_category, ''), 'Brasil')), 60);
  v_link := NULLIF(TRIM(COALESCE(p_link, '')), '');
  v_image_url := NULLIF(TRIM(COALESCE(p_image_url, '')), '');
  v_priority := LEAST(GREATEST(COALESCE(p_priority, 1), 1), 20);

  UPDATE public.news_tasks
  SET
    admin_priority = v_priority,
    content = jsonb_build_object(
      'title', v_title,
      'description', v_description,
      'full_text', v_full_text,
      'source', v_source,
      'category', v_category,
      'difficulty', 'medium',
      'image_url', v_image_url,
      'link', v_link,
      'reward', 0
    )
  WHERE id = p_task_id
    AND is_admin_post = TRUE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_news_task(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

-- DELETE NEWS TASK
CREATE OR REPLACE FUNCTION public.admin_delete_news_task(
  p_task_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_news_admin();

  -- Try hard delete first (works if no validations reference it)
  BEGIN
    DELETE FROM public.news_tasks
    WHERE id = p_task_id AND is_admin_post = TRUE;
    RETURN;
  EXCEPTION WHEN foreign_key_violation THEN
    -- Fallback: soft-delete by hiding from admin view
    UPDATE public.news_tasks
    SET is_admin_post = FALSE
    WHERE id = p_task_id AND is_admin_post = TRUE;
  END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_news_task(UUID) TO authenticated;

-- RESTORE NEWS TASK
CREATE OR REPLACE FUNCTION public.admin_restore_news_task(
  p_task_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_news_admin();

  -- This varies but if there was soft delete, we restore. Since we just run DELETE above,
  -- this might fail if strictly deleted. Kept for compatibility.
  -- We just set is_admin_post = TRUE just in case.
  UPDATE public.news_tasks SET is_admin_post = TRUE WHERE id = p_task_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_restore_news_task(UUID) TO authenticated;
