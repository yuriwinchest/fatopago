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
    FROM public.sellers s
    WHERE s.email = v_email
  ) THEN
    RAISE EXCEPTION 'Já existe um vendedor cadastrado com este e-mail.';
  END IF;

  IF v_cpf IS NOT NULL AND EXISTS (
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
