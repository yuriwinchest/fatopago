-- Hard fix for admin_list_cycle_winners type mismatch
-- Ensuring every column in RETURN QUERY matches RETURNS TABLE exactly with explicit casts.

DROP FUNCTION IF EXISTS public.admin_list_cycle_winners(INTEGER);

CREATE OR REPLACE FUNCTION public.admin_list_cycle_winners(
  p_limit INTEGER DEFAULT 12
)
RETURNS TABLE (
  cycle_offset INTEGER,
  cycle_number INTEGER,
  cycle_start_at TIMESTAMPTZ,
  cycle_end_at TIMESTAMPTZ,
  is_active BOOLEAN,
  winner_user_id UUID,
  winner_name TEXT,
  winner_lastname TEXT,
  winner_email TEXT,
  winner_phone TEXT,
  winner_city TEXT,
  winner_state TEXT,
  validations_count BIGINT,
  last_validation_at TIMESTAMPTZ,
  contacted BOOLEAN,
  prize_paid BOOLEAN,
  image_received BOOLEAN,
  notes TEXT,
  followup_updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_fatopago_admin();

  RETURN QUERY
  WITH offsets AS (
    -- Force INTEGER type for cycle_offset
    SELECT s.i::INTEGER AS cycle_offset
    FROM generate_series(0, GREATEST(COALESCE(p_limit, 12), 1) - 1) AS s(i)
  ),
  cycles AS (
    SELECT
      o.cycle_offset,
      meta.cycle_number,
      meta.cycle_start_at,
      meta.cycle_end_at,
      meta.is_active
    FROM offsets o
    CROSS JOIN LATERAL public.get_validation_cycle_meta(o.cycle_offset) AS meta
    WHERE meta.cycle_start_at IS NOT NULL
  )
  SELECT
    c.cycle_offset::INTEGER,
    c.cycle_number::INTEGER,
    c.cycle_start_at::TIMESTAMPTZ,
    c.cycle_end_at::TIMESTAMPTZ,
    c.is_active::BOOLEAN,
    r.id::UUID AS winner_user_id,
    COALESCE(p.name, r.name, 'Sem vencedor')::TEXT AS winner_name,
    COALESCE(p.lastname, r.lastname, '')::TEXT AS winner_lastname,
    p.email::TEXT AS winner_email,
    p.phone::TEXT AS winner_phone,
    COALESCE(p.city, r.city, '')::TEXT AS winner_city,
    COALESCE(p.state, r.state, '')::TEXT AS winner_state,
    COALESCE(r.validations_count, 0)::BIGINT AS validations_count,
    r.last_validation_at::TIMESTAMPTZ,
    COALESCE(f.contacted, FALSE)::BOOLEAN AS contacted,
    COALESCE(f.prize_paid, FALSE)::BOOLEAN AS prize_paid,
    COALESCE(f.image_received, FALSE)::BOOLEAN AS image_received,
    f.notes::TEXT,
    f.updated_at::TIMESTAMPTZ AS followup_updated_at
  FROM cycles c
  LEFT JOIN LATERAL (
    -- Explicit column selection from ranking RPC to avoid variations in rank_row.*
    SELECT 
      rank_row.id,
      rank_row.name,
      rank_row.lastname,
      rank_row.city,
      rank_row.state,
      rank_row.validations_count,
      rank_row.last_validation_at
    FROM public.get_live_validation_ranking(NULL, NULL, 1, c.cycle_offset) AS rank_row
    ORDER BY rank_row.validations_count DESC, rank_row.last_validation_at ASC NULLS LAST
    LIMIT 1
  ) AS r ON TRUE
  LEFT JOIN public.profiles p
    ON p.id = r.id
  LEFT JOIN public.cycle_winner_followups f
    ON f.cycle_number = c.cycle_number
  ORDER BY c.cycle_start_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_cycle_winners(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_cycle_winners(INTEGER) TO authenticated;
