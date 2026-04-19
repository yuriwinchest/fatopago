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
  v_seller_email TEXT;
  v_phone TEXT;
  v_notes TEXT;
  v_seller_code TEXT;
  v_id UUID;
BEGIN
  PERFORM public.assert_fatopago_admin();

  v_name := LEFT(TRIM(COALESCE(p_name, '')), 120);
  v_seller_email := LOWER(TRIM(COALESCE(p_email, '')));
  v_phone := NULLIF(TRIM(COALESCE(p_phone, '')), '');
  v_notes := NULLIF(TRIM(COALESCE(p_notes, '')), '');

  IF LENGTH(v_name) < 3 THEN
    RAISE EXCEPTION 'Nome do vendedor inválido.';
  END IF;

  IF v_seller_email = '' OR position('@' IN v_seller_email) = 0 THEN
    RAISE EXCEPTION 'E-mail do vendedor inválido.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sellers s
    WHERE s.email = v_seller_email
  ) THEN
    RAISE EXCEPTION 'Já existe um vendedor cadastrado com este e-mail.';
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
    notes,
    seller_code,
    created_by
  )
  VALUES (
    v_name,
    v_seller_email,
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
