-- Fix admin_create_news_task to use get_weekly_cycle_window() for accurate
-- cycle assignment instead of copying cycle_start_at from the latest existing
-- news_task (which could be from a previous cycle).
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
SET search_path TO 'public'
AS $function$
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
    RAISE EXCEPTION 'Título inválido (mínimo 6 caracteres).';
  END IF;

  IF LENGTH(v_description) < 20 THEN
    RAISE EXCEPTION 'Texto inválido (mínimo 20 caracteres).';
  END IF;

  -- Use get_weekly_cycle_window() to determine the CURRENT cycle accurately,
  -- instead of copying from the latest existing news_task.
  SELECT c.cycle_start_at, c.cycle_number
    INTO v_cycle_start, v_cycle_number
  FROM public.get_weekly_cycle_window(NOW(), 0) c;

  -- Fallback (should never happen if get_weekly_cycle_window is working)
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
$function$;
