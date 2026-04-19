-- Role-based admin authorization hardening.
-- Replaces direct admin-email checks with DB-backed admin role checks.

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_unique_idx
  ON public.admin_users (LOWER(email));

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_users_select_own ON public.admin_users;
CREATE POLICY admin_users_select_own
ON public.admin_users
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_admin_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_users_touch_updated_at ON public.admin_users;
CREATE TRIGGER admin_users_touch_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.touch_admin_users_updated_at();

CREATE OR REPLACE FUNCTION public.is_admin_user(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = p_user_id
      AND au.role = 'admin'
      AND au.is_active = TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user(UUID) TO authenticated, service_role;

INSERT INTO public.admin_users (user_id, email, role, is_active)
SELECT
  u.id,
  LOWER(COALESCE(u.email, '')),
  'admin',
  TRUE
FROM auth.users u
WHERE LOWER(COALESCE(u.email, '')) = 'fatopago@gmail.com'
ON CONFLICT (user_id) DO UPDATE
SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  is_active = TRUE,
  updated_at = NOW();

CREATE OR REPLACE FUNCTION public.assert_fatopago_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas admin pode executar esta ação.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_fatopago_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_fatopago_admin() TO authenticated;

-- Profiles admin access
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- Financial policies
DROP POLICY IF EXISTS "Admin Select Transactions" ON public.transactions;
CREATE POLICY "Admin Select Transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin Select Commissions" ON public.commissions;
CREATE POLICY "Admin Select Commissions"
ON public.commissions
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin Select Referrals" ON public.referrals;
CREATE POLICY "Admin Select Referrals"
ON public.referrals
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin Select Pix Payments" ON public.pix_payments;
CREATE POLICY "Admin Select Pix Payments"
ON public.pix_payments
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin Select Plan Purchases" ON public.plan_purchases;
CREATE POLICY "Admin Select Plan Purchases"
ON public.plan_purchases
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- Site media settings admin write policies
DROP POLICY IF EXISTS "Admin can insert site media settings" ON public.site_media_settings;
CREATE POLICY "Admin can insert site media settings"
ON public.site_media_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin can update site media settings" ON public.site_media_settings;
CREATE POLICY "Admin can update site media settings"
ON public.site_media_settings
FOR UPDATE
TO authenticated
USING (public.is_admin_user(auth.uid()))
WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admin can delete site media settings" ON public.site_media_settings;
CREATE POLICY "Admin can delete site media settings"
ON public.site_media_settings
FOR DELETE
TO authenticated
USING (public.is_admin_user(auth.uid()));

-- Storage policies: promo videos
DROP POLICY IF EXISTS "Admin can upload promo videos" ON storage.objects;
CREATE POLICY "Admin can upload promo videos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'promo-videos'
  AND public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS "Admin can update promo videos" ON storage.objects;
CREATE POLICY "Admin can update promo videos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'promo-videos'
  AND public.is_admin_user(auth.uid())
)
WITH CHECK (
  bucket_id = 'promo-videos'
  AND public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS "Admin can delete promo videos" ON storage.objects;
CREATE POLICY "Admin can delete promo videos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'promo-videos'
  AND public.is_admin_user(auth.uid())
);

-- Storage policies: news images
DROP POLICY IF EXISTS "Admin can upload news images" ON storage.objects;
CREATE POLICY "Admin can upload news images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'news-images'
  AND public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS "Admin can update news images" ON storage.objects;
CREATE POLICY "Admin can update news images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'news-images'
  AND public.is_admin_user(auth.uid())
)
WITH CHECK (
  bucket_id = 'news-images'
  AND public.is_admin_user(auth.uid())
);

DROP POLICY IF EXISTS "Admin can delete news images" ON storage.objects;
CREATE POLICY "Admin can delete news images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'news-images'
  AND public.is_admin_user(auth.uid())
);

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

  SELECT nt.cycle_start_at, nt.cycle_number
    INTO v_cycle_start, v_cycle_number
  FROM public.news_tasks nt
  WHERE nt.cycle_start_at IS NOT NULL
    AND nt.cycle_start_at <= NOW()
  ORDER BY nt.cycle_start_at DESC, nt.created_at DESC
  LIMIT 1;

  IF v_cycle_start IS NULL THEN
    SELECT nt.cycle_start_at, nt.cycle_number
      INTO v_cycle_start, v_cycle_number
    FROM public.news_tasks nt
    WHERE nt.cycle_start_at IS NOT NULL
    ORDER BY nt.cycle_start_at DESC, nt.created_at DESC
    LIMIT 1;
  END IF;

  IF v_cycle_start IS NULL THEN
    v_cycle_start := date_trunc('day', NOW());
    v_cycle_number := 1;
  END IF;

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

CREATE OR REPLACE FUNCTION public.seller_enable_campaign_for_contact_message(
  p_message_id UUID
)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  seller_code TEXT,
  user_id UUID,
  access_source TEXT,
  campaign_enabled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_actor_seller_id UUID;
  v_message RECORD;
  v_existing_referral RECORD;
  v_enabled_at TIMESTAMPTZ;
BEGIN
  v_is_admin := public.is_admin_user(auth.uid());
  v_actor_seller_id := public.get_authenticated_seller_id();

  SELECT
    m.id,
    m.seller_id,
    s.name AS seller_name,
    s.seller_code,
    m.user_id
  INTO v_message
  FROM public.seller_contact_messages m
  JOIN public.sellers s
    ON s.id = m.seller_id
  WHERE m.id = p_message_id
  LIMIT 1;

  IF v_message.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação comercial não encontrada.';
  END IF;

  IF NOT v_is_admin AND v_actor_seller_id IS DISTINCT FROM v_message.seller_id THEN
    RAISE EXCEPTION 'Acesso negado para habilitar este usuário.';
  END IF;

  SELECT
    sr.id,
    sr.seller_id,
    sr.source,
    sr.campaign_enabled_at
  INTO v_existing_referral
  FROM public.seller_referrals sr
  WHERE sr.referred_user_id = v_message.user_id
  LIMIT 1;

  IF v_existing_referral.id IS NULL THEN
    INSERT INTO public.seller_referrals (
      seller_id,
      referred_user_id,
      affiliate_code,
      source,
      campaign_enabled_at,
      campaign_enabled_by,
      updated_at
    )
    VALUES (
      v_message.seller_id,
      v_message.user_id,
      v_message.seller_code,
      'manual',
      NOW(),
      auth.uid(),
      NOW()
    )
    RETURNING public.seller_referrals.campaign_enabled_at INTO v_enabled_at;
  ELSIF v_existing_referral.seller_id = v_message.seller_id THEN
    UPDATE public.seller_referrals
    SET
      campaign_enabled_at = COALESCE(public.seller_referrals.campaign_enabled_at, NOW()),
      updated_at = NOW()
    WHERE id = v_existing_referral.id
    RETURNING public.seller_referrals.campaign_enabled_at INTO v_enabled_at;
  ELSE
    RAISE EXCEPTION 'Este usuário já está vinculado a outro vendedor e não pode ser habilitado por aqui.';
  END IF;

  UPDATE public.seller_contact_messages
  SET
    status = 'enabled',
    resolved_at = COALESCE(resolved_at, NOW()),
    updated_at = NOW()
  WHERE public.seller_contact_messages.seller_id = v_message.seller_id
    AND public.seller_contact_messages.user_id = v_message.user_id
    AND public.seller_contact_messages.status IN ('new', 'contacted');

  RETURN QUERY
  SELECT
    v_message.seller_id,
    v_message.seller_name,
    v_message.seller_code,
    v_message.user_id,
    COALESCE(v_existing_referral.source, 'manual'),
    COALESCE(v_enabled_at, NOW());
END;
$$;
