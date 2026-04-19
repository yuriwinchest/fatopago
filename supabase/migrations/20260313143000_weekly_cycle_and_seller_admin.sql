CREATE OR REPLACE FUNCTION public.assert_fatopago_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'email', '') <> 'fatopago@gmail.com' THEN
    RAISE EXCEPTION 'Acesso negado: apenas admin pode executar esta ação.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_fatopago_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_fatopago_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_plan_purchase_amount(
  p_plan_id TEXT,
  p_validation_credit_total NUMERIC DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    p_validation_credit_total,
    CASE
      WHEN p_plan_id = 'starter' THEN 6::NUMERIC
      WHEN p_plan_id = 'pro' THEN 10::NUMERIC
      WHEN p_plan_id = 'expert' THEN 20::NUMERIC
      ELSE 0::NUMERIC
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_cycle_window(
  p_reference TIMESTAMPTZ DEFAULT now(),
  p_cycle_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  cycle_start_at TIMESTAMPTZ,
  cycle_end_at TIMESTAMPTZ,
  next_cycle_start_at TIMESTAMPTZ,
  cycle_number INTEGER,
  is_active BOOLEAN,
  is_break BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH constants AS (
    SELECT
      TIMESTAMPTZ '2026-03-08 15:00:00+00' AS anchor_at,
      COALESCE(p_reference, now()) AS ref_at,
      GREATEST(COALESCE(p_cycle_offset, 0), 0) AS cycle_offset
  ),
  active_cycle AS (
    SELECT
      anchor_at,
      ref_at,
      cycle_offset,
      CASE
        WHEN ref_at < anchor_at THEN 0
        ELSE FLOOR(EXTRACT(EPOCH FROM (ref_at - anchor_at)) / 604800)::INT
      END AS active_cycle_index
    FROM constants
  ),
  selected_cycle AS (
    SELECT
      anchor_at,
      ref_at,
      (active_cycle_index - cycle_offset) AS resolved_cycle_index
    FROM active_cycle
  )
  SELECT
    anchor_at + (resolved_cycle_index * INTERVAL '7 days') AS cycle_start_at,
    anchor_at + (resolved_cycle_index * INTERVAL '7 days') + INTERVAL '6 days 23 hours' AS cycle_end_at,
    anchor_at + ((resolved_cycle_index + 1) * INTERVAL '7 days') AS next_cycle_start_at,
    resolved_cycle_index + 1 AS cycle_number,
    ref_at >= anchor_at + (resolved_cycle_index * INTERVAL '7 days')
      AND ref_at < anchor_at + (resolved_cycle_index * INTERVAL '7 days') + INTERVAL '6 days 23 hours' AS is_active,
    ref_at >= anchor_at + (resolved_cycle_index * INTERVAL '7 days') + INTERVAL '6 days 23 hours'
      AND ref_at < anchor_at + ((resolved_cycle_index + 1) * INTERVAL '7 days') AS is_break
  FROM selected_cycle
  WHERE resolved_cycle_index >= 0;
$$;

REVOKE ALL ON FUNCTION public.get_weekly_cycle_window(TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_cycle_window(TIMESTAMPTZ, INTEGER) TO anon, authenticated;

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
  SELECT
    cycle_window.cycle_start_at,
    cycle_window.cycle_end_at,
    cycle_window.cycle_number,
    cycle_window.is_active
  FROM public.get_weekly_cycle_window(now(), p_cycle_offset) AS cycle_window;
$$;

REVOKE ALL ON FUNCTION public.get_validation_cycle_meta(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_validation_cycle_meta(INTEGER) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_live_validation_ranking(TEXT, TEXT, INTEGER);
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
  ORDER BY a.validations_count DESC, a.last_validation_at DESC, p.id
  LIMIT LEAST(GREATEST(p_limit, 0), 500);
$$;

REVOKE ALL ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_validation_ranking(TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;

UPDATE public.news_tasks AS nt
SET
  cycle_start_at = cycle_data.cycle_start_at,
  cycle_number = cycle_data.cycle_number
FROM (
  SELECT
    nt_inner.id,
    cycle_window.cycle_start_at,
    cycle_window.cycle_number
  FROM public.news_tasks AS nt_inner
  CROSS JOIN LATERAL public.get_weekly_cycle_window(nt_inner.created_at, 0) AS cycle_window
  WHERE nt_inner.created_at IS NOT NULL
) AS cycle_data
WHERE nt.id = cycle_data.id
  AND (
    nt.cycle_start_at IS DISTINCT FROM cycle_data.cycle_start_at
    OR nt.cycle_number IS DISTINCT FROM cycle_data.cycle_number
  );

CREATE OR REPLACE FUNCTION public.submit_validation(
  p_task_id UUID,
  p_verdict BOOLEAN,
  p_justification TEXT DEFAULT NULL,
  p_proof_link TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_plan RECORD;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
  v_task_created TIMESTAMPTZ;
  v_category TEXT;
  v_cost NUMERIC(12,2);
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_lastname TEXT;
  v_user_city TEXT;
  v_user_state TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  SELECT
    u.email,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), 'Usuário'),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'lastname'), ''), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'city'), ''), ''),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'state'), ''), '')
  INTO
    v_user_email,
    v_user_name,
    v_user_lastname,
    v_user_city,
    v_user_state
  FROM auth.users u
  WHERE u.id = v_user_id;

  INSERT INTO public.profiles (
    id,
    name,
    lastname,
    city,
    state,
    reputation_score,
    current_balance,
    is_active,
    created_at,
    updated_at,
    email,
    plan_status
  )
  VALUES (
    v_user_id,
    COALESCE(v_user_name, 'Usuário'),
    COALESCE(v_user_lastname, ''),
    COALESCE(v_user_city, ''),
    COALESCE(v_user_state, ''),
    0,
    0,
    TRUE,
    NOW(),
    NOW(),
    v_user_email,
    'none'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT content->>'category', cycle_start_at, created_at
  INTO v_category, v_cycle_start, v_task_created
  FROM public.news_tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Tarefa não encontrada');
  END IF;

  IF v_cycle_start IS NULL THEN
    v_cycle_start := v_task_created;
  END IF;

  v_cycle_end := v_cycle_start + INTERVAL '6 days 23 hours';
  IF NOW() >= v_cycle_end THEN
    RETURN json_build_object('status', 'error', 'message', 'Este ciclo semanal já foi encerrado');
  END IF;

  v_cost := GREATEST(COALESCE(public.get_validation_cost_by_category(v_category), 0.75), 0.01);

  UPDATE public.plan_purchases
  SET
    used_validations = used_validations + 1,
    validation_credit_remaining = GREATEST(COALESCE(validation_credit_remaining, 0) - v_cost, 0),
    last_validation_at = NOW(),
    updated_at = NOW(),
    status = CASE WHEN used_validations + 1 >= max_validations THEN 'completed' ELSE 'active' END,
    completed_at = CASE WHEN used_validations + 1 >= max_validations THEN NOW() ELSE NULL END
  WHERE user_id = v_user_id
    AND status = 'active'
    AND used_validations < max_validations
  RETURNING * INTO v_plan;

  IF NOT FOUND THEN
    SELECT *
    INTO v_plan
    FROM public.plan_purchases
    WHERE user_id = v_user_id
      AND status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN json_build_object('status', 'error', 'message', 'Nenhum plano ativo encontrado');
    END IF;

    UPDATE public.plan_purchases
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
    WHERE id = v_plan.id
      AND used_validations >= max_validations;

    RETURN json_build_object('status', 'error', 'message', 'Limite de validações do plano atingido');
  END IF;

  INSERT INTO public.validations (
    task_id,
    user_id,
    plan_purchase_id,
    verdict,
    justification,
    proof_link
  ) VALUES (
    p_task_id,
    v_user_id,
    v_plan.id,
    p_verdict,
    p_justification,
    p_proof_link
  );

  UPDATE public.profiles
  SET
    reputation_score = COALESCE(reputation_score, 0) + 10,
    updated_at = NOW()
  WHERE id = v_user_id;

  RETURN json_build_object(
    'status', 'success',
    'cost', v_cost,
    'used_validations', v_plan.used_validations,
    'max_validations', v_plan.max_validations,
    'remaining_credit', v_plan.validation_credit_remaining
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_validation(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

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
SET search_path = public
AS $$
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
  PERFORM public.assert_fatopago_admin();

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

  SELECT cycle_start_at, cycle_number
  INTO v_cycle_start, v_cycle_number
  FROM public.get_weekly_cycle_window(now(), 0);

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
$$;

REVOKE ALL ON FUNCTION public.admin_create_news_task(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_news_task(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;

CREATE TABLE IF NOT EXISTS public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  notes TEXT,
  seller_code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.seller_referrals (
  id BIGSERIAL PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  affiliate_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referred_user_id)
);

CREATE INDEX IF NOT EXISTS seller_referrals_seller_idx
  ON public.seller_referrals (seller_id, created_at DESC);

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_referrals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_seller_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sellers_touch_updated_at ON public.sellers;
CREATE TRIGGER sellers_touch_updated_at
BEFORE UPDATE ON public.sellers
FOR EACH ROW
EXECUTE FUNCTION public.touch_seller_updated_at();

CREATE OR REPLACE FUNCTION public.process_referral_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_referrer_id UUID;
  found_seller_id UUID;
BEGIN
  IF NEW.affiliate_code IS NOT NULL AND NEW.affiliate_code <> '' THEN
    SELECT id
    INTO found_referrer_id
    FROM public.profiles
    WHERE referral_code = NEW.affiliate_code
    LIMIT 1;

    IF found_referrer_id IS NOT NULL AND found_referrer_id <> NEW.id THEN
      INSERT INTO public.referrals (referrer_id, referred_id)
      VALUES (found_referrer_id, NEW.id)
      ON CONFLICT (referred_id) DO NOTHING;
    ELSE
      SELECT id
      INTO found_seller_id
      FROM public.sellers
      WHERE seller_code = NEW.affiliate_code
        AND is_active = TRUE
      LIMIT 1;

      IF found_seller_id IS NOT NULL THEN
        INSERT INTO public.seller_referrals (seller_id, referred_user_id, affiliate_code)
        VALUES (found_seller_id, NEW.id, NEW.affiliate_code)
        ON CONFLICT (referred_user_id) DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_seller(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  seller_code TEXT,
  affiliate_link TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_email TEXT;
  v_phone TEXT;
  v_notes TEXT;
  v_seller_code TEXT;
  v_id UUID;
BEGIN
  PERFORM public.assert_fatopago_admin();

  v_name := LEFT(TRIM(COALESCE(p_name, '')), 120);
  v_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_phone := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  v_notes := NULLIF(TRIM(COALESCE(p_notes, '')), '');

  IF LENGTH(v_name) < 3 THEN
    RAISE EXCEPTION 'Nome do vendedor inválido.';
  END IF;

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'E-mail do vendedor inválido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sellers
    WHERE email = v_email
  ) THEN
    RAISE EXCEPTION 'Já existe um vendedor cadastrado com este e-mail.';
  END IF;

  LOOP
    v_seller_code := 'VND' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.sellers
      WHERE seller_code = v_seller_code
    );
  END LOOP;

  INSERT INTO public.sellers (
    name,
    email,
    phone,
    notes,
    seller_code,
    created_by
  )
  VALUES (
    v_name,
    v_email,
    v_phone,
    v_notes,
    v_seller_code,
    auth.uid()
  )
  RETURNING sellers.id INTO v_id;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.email,
    s.phone,
    s.seller_code,
    'https://fatopago.com/convite/' || s.seller_code AS affiliate_link,
    s.is_active,
    s.created_at
  FROM public.sellers s
  WHERE s.id = v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_seller(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_seller(TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_sellers()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  seller_code TEXT,
  affiliate_link TEXT,
  is_active BOOLEAN,
  signup_count INTEGER,
  paid_customers INTEGER,
  total_revenue NUMERIC,
  today_revenue NUMERIC,
  week_revenue NUMERIC,
  month_revenue NUMERIC,
  created_at TIMESTAMPTZ,
  last_signup_at TIMESTAMPTZ,
  last_sale_at TIMESTAMPTZ
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
    FROM public.get_weekly_cycle_window(now(), 0)
  ),
  boundaries AS (
    SELECT
      (date_trunc('day', timezone('America/Sao_Paulo', now())) AT TIME ZONE 'America/Sao_Paulo') AS today_start_at,
      (date_trunc('month', timezone('America/Sao_Paulo', now())) AT TIME ZONE 'America/Sao_Paulo') AS month_start_at
  ),
  signup_summary AS (
    SELECT
      sr.seller_id,
      COUNT(*)::INT AS signup_count,
      MAX(sr.created_at) AS last_signup_at
    FROM public.seller_referrals sr
    GROUP BY sr.seller_id
  ),
  sales_base AS (
    SELECT
      sr.seller_id,
      pp.id AS plan_purchase_id,
      pp.user_id,
      pp.plan_id,
      public.resolve_plan_purchase_amount(pp.plan_id, pp.validation_credit_total) AS amount,
      pp.created_at,
      pp.status
    FROM public.seller_referrals sr
    JOIN public.plan_purchases pp
      ON pp.user_id = sr.referred_user_id
    WHERE COALESCE(pp.status, '') <> 'cancelled'
  ),
  sales_summary AS (
    SELECT
      sb.seller_id,
      COUNT(*)::INT AS sales_count,
      COUNT(DISTINCT sb.user_id)::INT AS paid_customers,
      COALESCE(SUM(sb.amount), 0)::NUMERIC AS total_revenue,
      COALESCE(SUM(CASE WHEN sb.created_at >= b.today_start_at THEN sb.amount ELSE 0 END), 0)::NUMERIC AS today_revenue,
      COALESCE(SUM(CASE WHEN sb.created_at >= c.cycle_start_at AND sb.created_at < c.next_cycle_start_at THEN sb.amount ELSE 0 END), 0)::NUMERIC AS week_revenue,
      COALESCE(SUM(CASE WHEN sb.created_at >= b.month_start_at THEN sb.amount ELSE 0 END), 0)::NUMERIC AS month_revenue,
      MAX(sb.created_at) AS last_sale_at
    FROM sales_base sb
    CROSS JOIN cycle c
    CROSS JOIN boundaries b
    GROUP BY sb.seller_id
  )
  SELECT
    s.id,
    s.name,
    s.email,
    s.phone,
    s.seller_code,
    'https://fatopago.com/convite/' || s.seller_code AS affiliate_link,
    s.is_active,
    COALESCE(ss.signup_count, 0) AS signup_count,
    COALESCE(sa.paid_customers, 0) AS paid_customers,
    COALESCE(sa.total_revenue, 0) AS total_revenue,
    COALESCE(sa.today_revenue, 0) AS today_revenue,
    COALESCE(sa.week_revenue, 0) AS week_revenue,
    COALESCE(sa.month_revenue, 0) AS month_revenue,
    s.created_at,
    ss.last_signup_at,
    sa.last_sale_at
  FROM public.sellers s
  LEFT JOIN signup_summary ss
    ON ss.seller_id = s.id
  LEFT JOIN sales_summary sa
    ON sa.seller_id = s.id
  ORDER BY s.is_active DESC, COALESCE(sa.week_revenue, 0) DESC, COALESCE(sa.total_revenue, 0) DESC, s.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_sellers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_sellers() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_seller_report(
  p_seller_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.assert_fatopago_admin();

  WITH seller_row AS (
    SELECT
      s.id,
      s.name,
      s.email,
      s.phone,
      s.notes,
      s.seller_code,
      s.is_active,
      s.created_at,
      'https://fatopago.com/convite/' || s.seller_code AS affiliate_link
    FROM public.sellers s
    WHERE s.id = p_seller_id
  ),
  referred_users AS (
    SELECT
      sr.id,
      sr.created_at,
      sr.affiliate_code,
      sr.referred_user_id,
      p.name,
      p.lastname,
      p.email,
      p.city,
      p.state
    FROM public.seller_referrals sr
    LEFT JOIN public.profiles p
      ON p.id = sr.referred_user_id
    WHERE sr.seller_id = p_seller_id
    ORDER BY sr.created_at DESC
  ),
  sales AS (
    SELECT
      pp.id,
      pp.user_id,
      COALESCE(p.name, 'Usuário') AS referred_name,
      COALESCE(p.lastname, '') AS referred_lastname,
      p.email AS referred_email,
      pp.plan_id,
      public.resolve_plan_purchase_amount(pp.plan_id, pp.validation_credit_total) AS amount,
      pp.status,
      pp.created_at
    FROM public.seller_referrals sr
    JOIN public.plan_purchases pp
      ON pp.user_id = sr.referred_user_id
    LEFT JOIN public.profiles p
      ON p.id = pp.user_id
    WHERE sr.seller_id = p_seller_id
      AND COALESCE(pp.status, '') <> 'cancelled'
    ORDER BY pp.created_at DESC
  )
  SELECT jsonb_build_object(
    'seller', COALESCE((SELECT to_jsonb(seller_row) FROM seller_row), '{}'::JSONB),
    'referred_users', COALESCE((SELECT jsonb_agg(to_jsonb(referred_users)) FROM referred_users), '[]'::JSONB),
    'sales', COALESCE((SELECT jsonb_agg(to_jsonb(sales)) FROM sales), '[]'::JSONB)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_seller_report(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_seller_report(UUID) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.admin_restore_news_task(
  p_source_task_id UUID,
  p_priority INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_content JSONB;
  v_source_priority INTEGER;
  v_cycle_start TIMESTAMPTZ;
  v_cycle_number INTEGER;
  v_priority INTEGER;
  v_existing_id UUID;
  v_new_id UUID;
BEGIN
  PERFORM public.assert_fatopago_admin();

  SELECT
    nt.content,
    nt.admin_priority
  INTO
    v_source_content,
    v_source_priority
  FROM public.news_tasks nt
  WHERE nt.id = p_source_task_id
    AND nt.is_admin_post = TRUE;

  IF v_source_content IS NULL THEN
    RAISE EXCEPTION 'Notícia manual não encontrada para reaproveitamento.';
  END IF;

  SELECT cycle_start_at, cycle_number
  INTO v_cycle_start, v_cycle_number
  FROM public.get_weekly_cycle_window(now(), 0);

  SELECT nt.id
  INTO v_existing_id
  FROM public.news_tasks nt
  WHERE nt.is_admin_post = TRUE
    AND nt.cycle_start_at = v_cycle_start
    AND COALESCE(nt.content->>'title', '') = COALESCE(v_source_content->>'title', '')
    AND COALESCE(nt.content->>'link', '') = COALESCE(v_source_content->>'link', '')
  ORDER BY nt.created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;

  v_priority := LEAST(GREATEST(COALESCE(p_priority, v_source_priority, 1), 1), 20);

  INSERT INTO public.news_tasks (
    content,
    cycle_start_at,
    cycle_number,
    is_admin_post,
    admin_priority,
    admin_created_by
  )
  VALUES (
    jsonb_set(v_source_content, '{reward}', '0'::JSONB, TRUE),
    v_cycle_start,
    v_cycle_number,
    TRUE,
    v_priority,
    auth.uid()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_restore_news_task(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_restore_news_task(UUID, INTEGER) TO authenticated;
