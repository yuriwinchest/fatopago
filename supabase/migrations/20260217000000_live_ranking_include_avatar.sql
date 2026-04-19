-- Include avatar_url in public live ranking RPC so ranking screens can show real profile photos.

DROP FUNCTION IF EXISTS public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER);

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
  WITH cycles AS (
    SELECT
      nt.cycle_start_at,
      MAX(nt.cycle_number) AS cycle_number
    FROM public.news_tasks nt
    WHERE nt.cycle_start_at IS NOT NULL
      AND nt.cycle_start_at <= now()
    GROUP BY nt.cycle_start_at
  ),
  cycle AS (
    SELECT
      c.cycle_start_at AS start_at,
      c.cycle_number
    FROM cycles c
    ORDER BY c.cycle_start_at DESC
    OFFSET GREATEST(p_cycle_offset, 0)
    LIMIT 1
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
      AND v.created_at < c.start_at + INTERVAL '24 hours'
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
  ORDER BY a.validations_count DESC, a.last_validation_at DESC, p.id
  LIMIT LEAST(GREATEST(p_limit, 0), 500);
$$;

REVOKE ALL ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
