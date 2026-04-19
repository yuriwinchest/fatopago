CREATE TABLE IF NOT EXISTS public.security_rate_limits (
  id BIGSERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject, action, window_start)
);

CREATE INDEX IF NOT EXISTS security_rate_limits_updated_at_idx
  ON public.security_rate_limits (updated_at DESC);

ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.security_rate_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.security_rate_limits FROM anon;
REVOKE ALL ON TABLE public.security_rate_limits FROM authenticated;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_subject TEXT,
  p_action TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INTEGER,
  window_started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject TEXT;
  v_action TEXT;
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  v_subject := LEFT(TRIM(COALESCE(p_subject, '')), 120);
  v_action := LEFT(TRIM(COALESCE(p_action, '')), 80);

  IF v_subject = '' OR v_action = '' THEN
    RETURN QUERY SELECT FALSE, 0, NOW();
    RETURN;
  END IF;

  IF COALESCE(p_limit, 0) <= 0 OR COALESCE(p_window_seconds, 0) <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, NOW();
    RETURN;
  END IF;

  v_window_start := TO_TIMESTAMP(FLOOR(EXTRACT(EPOCH FROM NOW()) / p_window_seconds) * p_window_seconds);

  INSERT INTO public.security_rate_limits (
    subject,
    action,
    window_start,
    hit_count,
    created_at,
    updated_at
  ) VALUES (
    v_subject,
    v_action,
    v_window_start,
    1,
    NOW(),
    NOW()
  )
  ON CONFLICT (subject, action, window_start)
  DO UPDATE
    SET hit_count = public.security_rate_limits.hit_count + 1,
        updated_at = NOW()
  RETURNING hit_count INTO v_count;

  RETURN QUERY SELECT (v_count <= p_limit), v_count, v_window_start;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
