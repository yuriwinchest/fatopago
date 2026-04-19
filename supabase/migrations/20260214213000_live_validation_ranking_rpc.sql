-- Public RPC: live ranking for current validation cycle (Landing Page).
-- Exposes only public profile fields + aggregated validation count.

-- Helpful indexes for aggregation (safe if they already exist).
CREATE INDEX IF NOT EXISTS validations_user_created_at_idx
  ON public.validations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS validations_created_at_idx
  ON public.validations (created_at DESC);

CREATE OR REPLACE FUNCTION public.get_live_validation_ranking(
  p_state TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
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
  last_validation_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cycle AS (
    SELECT MAX(COALESCE(cycle_start_at, created_at)) AS start_at
    FROM public.news_tasks
  ),
  agg AS (
    SELECT
      v.user_id,
      COUNT(*)::INT AS validations_count,
      MAX(v.created_at) AS last_validation_at
    FROM public.validations v
    CROSS JOIN cycle c
    WHERE c.start_at IS NOT NULL
      AND v.created_at >= c.start_at
    GROUP BY v.user_id
  )
  SELECT
    p.id,
    p.name,
    p.lastname,
    p.city,
    p.state,
    p.current_balance,
    p.reputation_score,
    a.validations_count,
    a.last_validation_at
  FROM agg a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE (p_state IS NULL OR btrim(p_state) = '' OR upper(COALESCE(p.state, '')) LIKE '%' || upper(btrim(p_state)) || '%')
    AND (p_city IS NULL OR btrim(p_city) = '' OR lower(COALESCE(p.city, '')) LIKE '%' || lower(btrim(p_city)) || '%')
  ORDER BY a.validations_count DESC, a.last_validation_at DESC, p.id
  LIMIT LEAST(GREATEST(p_limit, 0), 500);
$$;

REVOKE ALL ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER) TO anon, authenticated;

