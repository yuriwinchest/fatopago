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

  IF v_cpf IS NULL THEN
    RAISE EXCEPTION 'CPF do vendedor é obrigatório.';
  END IF;

  IF length(v_cpf) <> 11 OR NOT public.is_valid_brazilian_cpf(v_cpf) THEN
    RAISE EXCEPTION 'CPF do vendedor inválido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sellers s
    WHERE s.email = v_email
  ) THEN
    RAISE EXCEPTION 'Já existe um vendedor cadastrado com este e-mail.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sellers s
    WHERE NULLIF(regexp_replace(COALESCE(s.cpf, ''), '\D', '', 'g'), '') = v_cpf
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

CREATE OR REPLACE FUNCTION public.seller_get_my_report()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_auth_user_id UUID;
  v_seller_id UUID;
  v_result JSONB;
BEGIN
  v_email := LOWER(COALESCE(auth.jwt()->>'email', ''));
  v_auth_user_id := auth.uid();

  IF v_email = '' AND v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT id
  INTO v_seller_id
  FROM public.sellers
  WHERE is_active = TRUE
    AND (
      auth_user_id = v_auth_user_id
      OR (auth_user_id IS NULL AND email = v_email)
    )
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

CREATE OR REPLACE FUNCTION public.seller_update_my_cpf(
  p_cpf TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_auth_user_id UUID;
  v_seller_id UUID;
  v_cpf TEXT;
BEGIN
  v_email := LOWER(COALESCE(auth.jwt()->>'email', ''));
  v_auth_user_id := auth.uid();
  v_cpf := NULLIF(regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g'), '');

  IF v_email = '' AND v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF v_cpf IS NULL THEN
    RAISE EXCEPTION 'CPF é obrigatório.';
  END IF;

  IF length(v_cpf) <> 11 OR NOT public.is_valid_brazilian_cpf(v_cpf) THEN
    RAISE EXCEPTION 'CPF inválido.';
  END IF;

  SELECT s.id
  INTO v_seller_id
  FROM public.sellers s
  WHERE s.is_active = TRUE
    AND (
      s.auth_user_id = v_auth_user_id
      OR (s.auth_user_id IS NULL AND s.email = v_email)
    )
  LIMIT 1;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Vendedor não encontrado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sellers s
    WHERE s.id <> v_seller_id
      AND NULLIF(regexp_replace(COALESCE(s.cpf, ''), '\D', '', 'g'), '') = v_cpf
  ) THEN
    RAISE EXCEPTION 'Já existe um vendedor cadastrado com este CPF.';
  END IF;

  UPDATE public.sellers
  SET
    cpf = v_cpf,
    updated_at = NOW()
  WHERE id = v_seller_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'seller_id', v_seller_id,
    'cpf', v_cpf
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seller_update_my_cpf(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_update_my_cpf(TEXT) TO authenticated;
