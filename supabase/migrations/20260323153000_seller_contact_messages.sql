CREATE TABLE IF NOT EXISTS public.seller_contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_lastname TEXT,
  user_email TEXT NOT NULL,
  user_phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS seller_contact_messages_seller_idx
  ON public.seller_contact_messages (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS seller_contact_messages_user_idx
  ON public.seller_contact_messages (user_id, created_at DESC);

ALTER TABLE public.seller_contact_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.list_active_sellers_for_contact()
RETURNS TABLE (
  id UUID,
  name TEXT,
  seller_code TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.seller_code
  FROM public.sellers s
  WHERE s.is_active = TRUE
  ORDER BY s.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_active_sellers_for_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_active_sellers_for_contact() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_seller_contact_message(
  p_seller_id UUID,
  p_message TEXT
)
RETURNS TABLE (
  id UUID,
  seller_id UUID,
  seller_name TEXT,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  user_phone TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_message TEXT;
  v_seller RECORD;
  v_user_name TEXT;
  v_user_lastname TEXT;
  v_user_email TEXT;
  v_user_phone TEXT;
  v_inserted public.seller_contact_messages%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  v_message := LEFT(TRIM(COALESCE(p_message, '')), 1200);
  IF LENGTH(v_message) < 8 THEN
    RAISE EXCEPTION 'Mensagem muito curta.';
  END IF;

  SELECT
    s.id,
    s.name,
    s.phone,
    s.seller_code
  INTO v_seller
  FROM public.sellers s
  WHERE s.id = p_seller_id
    AND s.is_active = TRUE
  LIMIT 1;

  IF v_seller.id IS NULL THEN
    RAISE EXCEPTION 'Vendedor não encontrado.';
  END IF;

  SELECT
    COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''), 'Usuário'),
    COALESCE(NULLIF(TRIM(p.lastname), ''), NULLIF(TRIM(u.raw_user_meta_data->>'lastname'), ''), ''),
    LOWER(COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(u.email), ''), '')),
    NULLIF(
      REGEXP_REPLACE(
        COALESCE(NULLIF(TRIM(p.phone), ''), NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''), ''),
        '\D',
        '',
        'g'
      ),
      ''
    )
  INTO
    v_user_name,
    v_user_lastname,
    v_user_email,
    v_user_phone
  FROM auth.users u
  LEFT JOIN public.profiles p
    ON p.id = u.id
  WHERE u.id = v_user_id
  LIMIT 1;

  IF COALESCE(v_user_email, '') = '' THEN
    RAISE EXCEPTION 'Não foi possível identificar o e-mail do usuário.';
  END IF;

  INSERT INTO public.seller_contact_messages (
    seller_id,
    user_id,
    user_name,
    user_lastname,
    user_email,
    user_phone,
    message
  )
  VALUES (
    v_seller.id,
    v_user_id,
    v_user_name,
    NULLIF(v_user_lastname, ''),
    v_user_email,
    v_user_phone,
    v_message
  )
  RETURNING * INTO v_inserted;

  RETURN QUERY
  SELECT
    v_inserted.id,
    v_inserted.seller_id,
    v_seller.name,
    v_inserted.user_id,
    v_inserted.user_name,
    v_inserted.user_email,
    v_inserted.user_phone,
    v_inserted.message,
    v_inserted.status,
    v_inserted.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_seller_contact_message(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_seller_contact_message(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_seller_contact_messages(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  seller_id UUID,
  seller_name TEXT,
  seller_code TEXT,
  seller_phone TEXT,
  user_id UUID,
  user_name TEXT,
  user_lastname TEXT,
  user_email TEXT,
  user_phone TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
BEGIN
  PERFORM public.assert_fatopago_admin();

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  RETURN QUERY
  SELECT
    m.id,
    m.seller_id,
    s.name AS seller_name,
    s.seller_code,
    s.phone AS seller_phone,
    m.user_id,
    m.user_name,
    m.user_lastname,
    m.user_email,
    m.user_phone,
    m.message,
    m.status,
    m.created_at
  FROM public.seller_contact_messages m
  JOIN public.sellers s
    ON s.id = m.seller_id
  ORDER BY
    CASE m.status
      WHEN 'new' THEN 0
      WHEN 'contacted' THEN 1
      ELSE 2
    END,
    m.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_seller_contact_messages(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_seller_contact_messages(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.seller_list_my_contact_messages(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  seller_id UUID,
  seller_name TEXT,
  seller_code TEXT,
  seller_phone TEXT,
  user_id UUID,
  user_name TEXT,
  user_lastname TEXT,
  user_email TEXT,
  user_phone TEXT,
  message TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_email TEXT;
  v_auth_user_id UUID;
  v_seller_id UUID;
BEGIN
  v_auth_user_id := auth.uid();
  v_email := LOWER(COALESCE(auth.jwt()->>'email', ''));

  IF v_auth_user_id IS NULL AND v_email = '' THEN
    RAISE EXCEPTION 'Não autenticado.';
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

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  RETURN QUERY
  SELECT
    m.id,
    m.seller_id,
    s.name AS seller_name,
    s.seller_code,
    s.phone AS seller_phone,
    m.user_id,
    m.user_name,
    m.user_lastname,
    m.user_email,
    m.user_phone,
    m.message,
    m.status,
    m.created_at
  FROM public.seller_contact_messages m
  JOIN public.sellers s
    ON s.id = m.seller_id
  WHERE m.seller_id = v_seller_id
  ORDER BY
    CASE m.status
      WHEN 'new' THEN 0
      WHEN 'contacted' THEN 1
      ELSE 2
    END,
    m.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_list_my_contact_messages(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_list_my_contact_messages(INTEGER) TO authenticated;
