-- Fix ranking to use correctly the weekly cycle window AND the tie-breaker
-- This restores the 168-hour window from the weekly cycle update and maintains the new tie-breaker rule.

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
  ),
  agg AS (
    SELECT
      v.user_id,
      COUNT(*)::INT AS validations_count,
      MAX(v.created_at) AS last_validation_at
    FROM public.validations v
    CROSS JOIN cycle c
    WHERE v.created_at >= c.cycle_start_at
      AND v.created_at < c.cycle_end_at
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
    a.last_validation_at,
    p.avatar_url
  FROM agg a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE (p_state IS NULL OR btrim(p_state) = '' OR upper(COALESCE(p.state, '')) LIKE '%' || upper(btrim(p_state)) || '%')
    AND (p_city IS NULL OR btrim(p_city) = '' OR lower(COALESCE(p.city, '')) LIKE '%' || lower(btrim(p_city)) || '%')
  -- NEW TIE-BREAKER RULE: Last user to validate wins (favored for effort/activity)
  ORDER BY a.validations_count DESC, a.last_validation_at DESC, p.id
  LIMIT LEAST(GREATEST(p_limit, 0), 500);
$$;

REVOKE ALL ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
