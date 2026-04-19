DROP FUNCTION IF EXISTS public.admin_list_news_by_cycle(INTEGER);

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
  PERFORM public.assert_fatopago_admin();

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

REVOKE ALL ON FUNCTION public.admin_list_news_by_cycle(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_news_by_cycle(INTEGER) TO authenticated;
