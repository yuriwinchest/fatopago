-- Performance indexes for news ingestion/read paths.
-- Safe to apply multiple times due IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS idx_news_tasks_created_at_desc
  ON public.news_tasks (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_tasks_source_created_at
  ON public.news_tasks ((content->>'source'), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_tasks_cycle_category_created_at
  ON public.news_tasks (cycle_start_at DESC, ((content->>'category')), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_news_tasks_link
  ON public.news_tasks ((content->>'link'));

CREATE INDEX IF NOT EXISTS idx_news_tasks_content_gin
  ON public.news_tasks
  USING GIN (content jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_validations_task_id
  ON public.validations (task_id);

CREATE OR REPLACE FUNCTION public.prune_old_news_tasks(p_retention_days INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_batch_limit INTEGER := 20000;
  v_deleted INTEGER := 0;
BEGIN
  IF p_retention_days IS NULL OR p_retention_days < 1 THEN
    RETURN 0;
  END IF;

  v_cutoff := now() - make_interval(days => p_retention_days);

  WITH doomed AS (
    SELECT nt.id
    FROM public.news_tasks nt
    WHERE nt.created_at < v_cutoff
    ORDER BY nt.created_at ASC
    LIMIT v_batch_limit
  ),
  deleted_validations AS (
    DELETE FROM public.validations v
    USING doomed d
    WHERE v.task_id = d.id
  ),
  deleted_rows AS (
    DELETE FROM public.news_tasks nt
    USING doomed d
    WHERE nt.id = d.id
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted
  FROM deleted_rows;

  RETURN COALESCE(v_deleted, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.prune_old_news_tasks(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prune_old_news_tasks(INTEGER) TO service_role;
