CREATE TABLE IF NOT EXISTS public.cycle_winner_followups (
  cycle_number INTEGER PRIMARY KEY,
  cycle_start_at TIMESTAMPTZ NOT NULL,
  cycle_end_at TIMESTAMPTZ NOT NULL,
  winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contacted BOOLEAN NOT NULL DEFAULT FALSE,
  prize_paid BOOLEAN NOT NULL DEFAULT FALSE,
  image_received BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.cycle_winner_followups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_cycle_winner_followup_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cycle_winner_followups_touch_updated_at ON public.cycle_winner_followups;
CREATE TRIGGER cycle_winner_followups_touch_updated_at
BEFORE UPDATE ON public.cycle_winner_followups
FOR EACH ROW
EXECUTE FUNCTION public.touch_cycle_winner_followup_updated_at();

CREATE OR REPLACE FUNCTION public.admin_update_cycle_winner_followup(
  p_cycle_number INTEGER,
  p_cycle_start_at TIMESTAMPTZ,
  p_cycle_end_at TIMESTAMPTZ,
  p_winner_user_id UUID DEFAULT NULL,
  p_contacted BOOLEAN DEFAULT FALSE,
  p_prize_paid BOOLEAN DEFAULT FALSE,
  p_image_received BOOLEAN DEFAULT FALSE,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.cycle_winner_followups
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.cycle_winner_followups;
BEGIN
  PERFORM public.assert_fatopago_admin();

  IF COALESCE(p_cycle_number, 0) <= 0 THEN
    RAISE EXCEPTION 'Ciclo inválido';
  END IF;

  INSERT INTO public.cycle_winner_followups (
    cycle_number,
    cycle_start_at,
    cycle_end_at,
    winner_user_id,
    contacted,
    prize_paid,
    image_received,
    notes,
    updated_by
  ) VALUES (
    p_cycle_number,
    COALESCE(p_cycle_start_at, NOW()),
    COALESCE(p_cycle_end_at, NOW()),
    p_winner_user_id,
    COALESCE(p_contacted, FALSE),
    COALESCE(p_prize_paid, FALSE),
    COALESCE(p_image_received, FALSE),
    NULLIF(TRIM(COALESCE(p_notes, '')), ''),
    auth.uid()
  )
  ON CONFLICT (cycle_number) DO UPDATE
  SET
    cycle_start_at = EXCLUDED.cycle_start_at,
    cycle_end_at = EXCLUDED.cycle_end_at,
    winner_user_id = EXCLUDED.winner_user_id,
    contacted = EXCLUDED.contacted,
    prize_paid = EXCLUDED.prize_paid,
    image_received = EXCLUDED.image_received,
    notes = EXCLUDED.notes,
    updated_by = auth.uid(),
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_cycle_winner_followup(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_cycle_winner_followup(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, UUID, BOOLEAN, BOOLEAN, BOOLEAN, TEXT) TO authenticated;

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
    SELECT generate_series(0, GREATEST(COALESCE(p_limit, 12), 1) - 1) AS cycle_offset
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
    c.cycle_offset,
    c.cycle_number,
    c.cycle_start_at,
    c.cycle_end_at,
    c.is_active,
    r.id AS winner_user_id,
    COALESCE(p.name, r.name, 'Sem vencedor') AS winner_name,
    COALESCE(p.lastname, r.lastname, '') AS winner_lastname,
    p.email AS winner_email,
    p.phone AS winner_phone,
    COALESCE(p.city, r.city, '') AS winner_city,
    COALESCE(p.state, r.state, '') AS winner_state,
    COALESCE(r.validations_count, 0)::BIGINT AS validations_count,
    r.last_validation_at,
    COALESCE(f.contacted, FALSE) AS contacted,
    COALESCE(f.prize_paid, FALSE) AS prize_paid,
    COALESCE(f.image_received, FALSE) AS image_received,
    f.notes,
    f.updated_at AS followup_updated_at
  FROM cycles c
  LEFT JOIN LATERAL (
    SELECT rank_row.*
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
