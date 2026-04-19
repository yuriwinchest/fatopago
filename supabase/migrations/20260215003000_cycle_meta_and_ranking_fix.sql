-- Fix live ranking cycle selection to ignore future cycles.
-- When the worker pre-creates news_tasks for the next cycle (cycle_start_at in the future),
-- the "current" ranking (p_cycle_offset=0) could show empty while the "previous" (offset=1)
-- shows the active cycle. We constrain cycles to cycle_start_at <= now().
--
-- Also adds a public RPC to fetch cycle metadata so the Landing Page can show
-- exactly which cycle (number + window) a ranking refers to, even when there are
-- zero validations.

DROP FUNCTION IF EXISTS public.get_live_validation_ranking(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_validation_cycle_meta(INTEGER);

CREATE OR REPLACE FUNCTION public.get_validation_cycle_meta(
  p_cycle_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  cycle_start_at TIMESTAMPTZ,
  cycle_end_at TIMESTAMPTZ,
  cycle_number INTEGER,
  is_active BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cycles AS (
    SELECT
      nt.cycle_start_at,
      MAX(nt.cycle_number)::INT AS cycle_number
    FROM public.news_tasks nt
    WHERE nt.cycle_start_at IS NOT NULL
      AND nt.cycle_start_at <= now()
    GROUP BY nt.cycle_start_at
  ),
  cycle AS (
    SELECT
      c.cycle_start_at,
      c.cycle_number
    FROM cycles c
    ORDER BY c.cycle_start_at DESC
    OFFSET GREATEST(p_cycle_offset, 0)
    LIMIT 1
  )
  SELECT
    cycle.cycle_start_at,
    cycle.cycle_start_at + INTERVAL '24 hours' AS cycle_end_at,
    cycle.cycle_number,
    (now() >= cycle.cycle_start_at AND now() < cycle.cycle_start_at + INTERVAL '24 hours') AS is_active
  FROM cycle;
$$;

REVOKE ALL ON FUNCTION public.get_validation_cycle_meta(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_validation_cycle_meta(INTEGER) TO anon, authenticated;

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
  last_validation_at TIMESTAMPTZ
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
    a.last_validation_at
  FROM agg a
  JOIN public.profiles p ON p.id = a.user_id
  WHERE (p_state IS NULL OR btrim(p_state) = '' OR upper(COALESCE(p.state, '')) LIKE '%' || upper(btrim(p_state)) || '%')
    AND (p_city IS NULL OR btrim(p_city) = '' OR lower(COALESCE(p.city, '')) LIKE '%' || lower(btrim(p_city)) || '%')
  ORDER BY a.validations_count DESC, a.last_validation_at DESC, p.id
  LIMIT LEAST(GREATEST(p_limit, 0), 500);
$$;

REVOKE ALL ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;

