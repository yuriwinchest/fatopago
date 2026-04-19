ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.sellers s
SET auth_user_id = u.id
FROM auth.users u
WHERE s.auth_user_id IS NULL
  AND LOWER(COALESCE(u.email, '')) = LOWER(COALESCE(s.email, ''));

CREATE UNIQUE INDEX IF NOT EXISTS sellers_auth_user_id_uniq
  ON public.sellers (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_my_seller_profile()
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
  v_email TEXT;
  v_auth_user_id UUID;
BEGIN
  v_email := LOWER(COALESCE(auth.jwt()->>'email', ''));
  v_auth_user_id := auth.uid();

  IF v_email = '' AND v_auth_user_id IS NULL THEN
    RETURN;
  END IF;

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
  WHERE (
      s.auth_user_id = v_auth_user_id
      OR (s.auth_user_id IS NULL AND s.email = v_email)
    )
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_seller_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_seller_profile() TO authenticated;

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
      s.notes,
      s.seller_code,
      s.is_active,
      s.created_at,
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

REVOKE ALL ON FUNCTION public.seller_get_my_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_get_my_report() TO authenticated;
