ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE public.sellers
ADD COLUMN IF NOT EXISTS cpf TEXT;

UPDATE public.sellers
SET cpf = NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '')
WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sellers_cpf_unique_digits_idx
ON public.sellers ((NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '')))
WHERE NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '') IS NOT NULL;

DROP FUNCTION IF EXISTS public.admin_create_seller(TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_create_seller(
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_cpf TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  seller_code TEXT,
  affiliate_link TEXT,
  is_active BOOLEAN,
  avatar_url TEXT,
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
  v_avatar_url TEXT;
  v_cpf TEXT;
  v_seller_code TEXT;
  v_id UUID;
BEGIN
  PERFORM public.assert_fatopago_admin();

  v_name := LEFT(TRIM(COALESCE(p_name, '')), 120);
  v_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_phone := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  v_notes := NULLIF(TRIM(COALESCE(p_notes, '')), '');
  v_avatar_url := NULLIF(TRIM(COALESCE(p_avatar_url, '')), '');
  v_cpf := NULLIF(regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g'), '');

  IF LENGTH(v_name) < 3 THEN
    RAISE EXCEPTION 'Nome do vendedor inválido.';
  END IF;

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'E-mail do vendedor inválido.';
  END IF;

  IF v_cpf IS NOT NULL AND length(v_cpf) <> 11 THEN
    RAISE EXCEPTION 'CPF do vendedor inválido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sellers
    WHERE email = v_email
  ) THEN
    RAISE EXCEPTION 'Já existe um vendedor cadastrado com este e-mail.';
  END IF;

  IF v_cpf IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.sellers
    WHERE NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '') = v_cpf
  ) THEN
    RAISE EXCEPTION 'Já existe um vendedor cadastrado com este CPF.';
  END IF;

  LOOP
    v_seller_code := 'VND' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.sellers s
      WHERE s.seller_code = v_seller_code
    );
  END LOOP;

  INSERT INTO public.sellers (
    name,
    email,
    phone,
    cpf,
    notes,
    seller_code,
    avatar_url,
    created_by
  )
  VALUES (
    v_name,
    v_email,
    v_phone,
    v_cpf,
    v_notes,
    v_seller_code,
    v_avatar_url,
    auth.uid()
  )
  RETURNING sellers.id INTO v_id;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.email,
    s.phone,
    s.cpf,
    s.seller_code,
    'https://fatopago.com/convite/' || s.seller_code AS affiliate_link,
    s.is_active,
    s.avatar_url,
    s.created_at
  FROM public.sellers s
  WHERE s.id = v_id;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_sellers();

CREATE OR REPLACE FUNCTION public.admin_list_sellers()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  seller_code TEXT,
  affiliate_link TEXT,
  is_active BOOLEAN,
  avatar_url TEXT,
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
    s.cpf,
    s.seller_code,
    'https://fatopago.com/convite/' || s.seller_code AS affiliate_link,
    s.is_active,
    s.avatar_url,
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
      s.cpf,
      s.notes,
      s.seller_code,
      s.is_active,
      s.avatar_url,
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
      p.state,
      p.avatar_url
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
      p.avatar_url AS referred_avatar_url,
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

DROP FUNCTION IF EXISTS public.get_my_seller_profile();

CREATE OR REPLACE FUNCTION public.get_my_seller_profile()
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  cpf TEXT,
  seller_code TEXT,
  affiliate_link TEXT,
  is_active BOOLEAN,
  avatar_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := LOWER(COALESCE(auth.jwt()->>'email', ''));

  IF v_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.email,
    s.phone,
    s.cpf,
    s.seller_code,
    'https://fatopago.com/convite/' || s.seller_code AS affiliate_link,
    s.is_active,
    s.avatar_url,
    s.created_at
  FROM public.sellers s
  WHERE s.email = v_email
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.seller_get_my_report()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_seller_id UUID;
  v_result JSONB;
BEGIN
  v_email := LOWER(COALESCE(auth.jwt()->>'email', ''));

  IF v_email = '' THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT id
  INTO v_seller_id
  FROM public.sellers
  WHERE email = v_email
    AND is_active = TRUE
  LIMIT 1;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Vendedor não encontrado.';
  END IF;

  WITH seller_row AS (
    SELECT
      s.id,
      s.name,
      s.email,
      s.phone,
      s.cpf,
      s.notes,
      s.seller_code,
      s.is_active,
      s.created_at,
      s.avatar_url,
      'https://fatopago.com/convite/' || s.seller_code AS affiliate_link
    FROM public.sellers s
    WHERE s.id = v_seller_id
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
    WHERE sr.seller_id = v_seller_id
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
    WHERE sr.seller_id = v_seller_id
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
