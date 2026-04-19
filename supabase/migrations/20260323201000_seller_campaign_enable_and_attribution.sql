ALTER TABLE public.seller_referrals
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS campaign_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campaign_enabled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.seller_referrals
SET
  source = COALESCE(NULLIF(TRIM(source), ''), 'link'),
  campaign_enabled_at = COALESCE(campaign_enabled_at, created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

INSERT INTO public.seller_referrals (
  seller_id,
  referred_user_id,
  affiliate_code,
  source,
  created_at,
  campaign_enabled_at,
  updated_at
)
SELECT
  s.id,
  p.id,
  s.seller_code,
  'link',
  COALESCE(p.created_at, NOW()),
  COALESCE(p.created_at, NOW()),
  NOW()
FROM public.profiles p
JOIN public.sellers s
  ON s.seller_code = NULLIF(TRIM(COALESCE(p.affiliate_code, '')), '')
 AND s.is_active = TRUE
LEFT JOIN public.seller_referrals sr
  ON sr.referred_user_id = p.id
WHERE sr.referred_user_id IS NULL;

ALTER TABLE public.seller_referrals
  DROP CONSTRAINT IF EXISTS seller_referrals_source_check;

ALTER TABLE public.seller_referrals
  ALTER COLUMN source SET DEFAULT 'link',
  ALTER COLUMN source SET NOT NULL,
  ALTER COLUMN campaign_enabled_at SET DEFAULT NOW(),
  ALTER COLUMN campaign_enabled_at SET NOT NULL;

ALTER TABLE public.seller_referrals
  ADD CONSTRAINT seller_referrals_source_check
  CHECK (source IN ('link', 'manual'));

CREATE INDEX IF NOT EXISTS seller_referrals_enabled_idx
  ON public.seller_referrals (seller_id, campaign_enabled_at DESC);

ALTER TABLE public.seller_contact_messages
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

ALTER TABLE public.seller_contact_messages
  DROP CONSTRAINT IF EXISTS seller_contact_messages_status_check;

ALTER TABLE public.seller_contact_messages
  ADD CONSTRAINT seller_contact_messages_status_check
  CHECK (status IN ('new', 'contacted', 'enabled', 'closed'));

CREATE INDEX IF NOT EXISTS seller_contact_messages_status_idx
  ON public.seller_contact_messages (seller_id, status, created_at DESC);

ALTER TABLE public.pix_payments
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_referral_id BIGINT REFERENCES public.seller_referrals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_source TEXT;

ALTER TABLE public.pix_payments
  DROP CONSTRAINT IF EXISTS pix_payments_seller_source_check;

ALTER TABLE public.pix_payments
  ADD CONSTRAINT pix_payments_seller_source_check
  CHECK (
    seller_source IS NULL
    OR seller_source IN ('link', 'manual')
  );

CREATE INDEX IF NOT EXISTS pix_payments_seller_idx
  ON public.pix_payments (seller_id, created_at DESC);

ALTER TABLE public.plan_purchases
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_referral_id BIGINT REFERENCES public.seller_referrals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seller_source TEXT;

ALTER TABLE public.plan_purchases
  DROP CONSTRAINT IF EXISTS plan_purchases_seller_source_check;

ALTER TABLE public.plan_purchases
  ADD CONSTRAINT plan_purchases_seller_source_check
  CHECK (
    seller_source IS NULL
    OR seller_source IN ('link', 'manual')
  );

CREATE INDEX IF NOT EXISTS plan_purchases_seller_idx
  ON public.plan_purchases (seller_id, created_at DESC);

UPDATE public.pix_payments px
SET
  seller_id = sr.seller_id,
  seller_referral_id = sr.id,
  seller_source = sr.source
FROM public.seller_referrals sr
WHERE px.user_id = sr.referred_user_id
  AND px.seller_id IS NULL
  AND px.plan_id IN (
    'starter_weekly',
    'pro_weekly',
    'expert_weekly',
    'starter_monthly',
    'pro_monthly',
    'expert_monthly'
  )
  AND px.created_at >= sr.campaign_enabled_at;

UPDATE public.plan_purchases pp
SET
  seller_id = sr.seller_id,
  seller_referral_id = sr.id,
  seller_source = sr.source
FROM public.seller_referrals sr
WHERE pp.user_id = sr.referred_user_id
  AND pp.seller_id IS NULL
  AND pp.plan_id IN (
    'starter_weekly',
    'pro_weekly',
    'expert_weekly',
    'starter_monthly',
    'pro_monthly',
    'expert_monthly'
  )
  AND pp.created_at >= sr.campaign_enabled_at;

CREATE OR REPLACE FUNCTION public.is_campaign_attributed_plan_id(p_plan_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_plan_id, '') IN (
    'starter_weekly',
    'pro_weekly',
    'expert_weekly',
    'starter_monthly',
    'pro_monthly',
    'expert_monthly'
  );
$$;

REVOKE ALL ON FUNCTION public.is_campaign_attributed_plan_id(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_campaign_attributed_plan_id(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_authenticated_seller_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_auth_user_id UUID;
  v_seller_id UUID;
BEGIN
  v_email := LOWER(COALESCE(auth.jwt()->>'email', ''));
  v_auth_user_id := auth.uid();

  IF v_email = '' AND v_auth_user_id IS NULL THEN
    RETURN NULL;
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

  RETURN v_seller_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_authenticated_seller_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_authenticated_seller_id() TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_user_seller_campaign_access(
  p_user_id UUID
)
RETURNS TABLE (
  seller_id UUID,
  seller_name TEXT,
  seller_code TEXT,
  seller_referral_id BIGINT,
  source TEXT,
  campaign_enabled_at TIMESTAMPTZ,
  affiliate_link TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name,
    s.seller_code,
    sr.id AS seller_referral_id,
    sr.source,
    sr.campaign_enabled_at,
    'https://fatopago.com/convite/' || s.seller_code AS affiliate_link
  FROM public.seller_referrals sr
  JOIN public.sellers s
    ON s.id = sr.seller_id
   AND s.is_active = TRUE
  WHERE sr.referred_user_id = p_user_id
  ORDER BY sr.campaign_enabled_at DESC, sr.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_user_seller_campaign_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_user_seller_campaign_access(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_seller_campaign_access()
RETURNS TABLE (
  has_access BOOLEAN,
  seller_id UUID,
  seller_name TEXT,
  seller_code TEXT,
  seller_referral_id BIGINT,
  source TEXT,
  campaign_enabled_at TIMESTAMPTZ,
  affiliate_link TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY
    SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::BIGINT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  WITH access_row AS (
    SELECT *
    FROM public.resolve_user_seller_campaign_access(v_user_id)
  )
  SELECT
    TRUE,
    access_row.seller_id,
    access_row.seller_name,
    access_row.seller_code,
    access_row.seller_referral_id,
    access_row.source,
    access_row.campaign_enabled_at,
    access_row.affiliate_link
  FROM access_row
  UNION ALL
  SELECT
    FALSE,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::BIGINT,
    NULL::TEXT,
    NULL::TIMESTAMPTZ,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.resolve_user_seller_campaign_access(v_user_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_seller_campaign_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_seller_campaign_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.user_has_active_seller_link()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.resolve_user_seller_campaign_access(auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_active_seller_link() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_active_seller_link() TO authenticated;

CREATE OR REPLACE FUNCTION public.process_referral_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_referrer_id UUID;
  found_seller RECORD;
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
      SELECT
        s.id,
        s.seller_code
      INTO found_seller
      FROM public.sellers s
      WHERE s.seller_code = NEW.affiliate_code
        AND s.is_active = TRUE
      LIMIT 1;

      IF found_seller.id IS NOT NULL THEN
        INSERT INTO public.seller_referrals (
          seller_id,
          referred_user_id,
          affiliate_code,
          source,
          campaign_enabled_at,
          updated_at
        )
        VALUES (
          found_seller.id,
          NEW.id,
          found_seller.seller_code,
          'link',
          NOW(),
          NOW()
        )
        ON CONFLICT (referred_user_id) DO UPDATE
        SET
          affiliate_code = EXCLUDED.affiliate_code,
          source = CASE
            WHEN public.seller_referrals.seller_id = EXCLUDED.seller_id THEN 'link'
            ELSE public.seller_referrals.source
          END,
          campaign_enabled_at = CASE
            WHEN public.seller_referrals.seller_id = EXCLUDED.seller_id THEN LEAST(public.seller_referrals.campaign_enabled_at, EXCLUDED.campaign_enabled_at)
            ELSE public.seller_referrals.campaign_enabled_at
          END,
          updated_at = NOW()
        WHERE public.seller_referrals.seller_id = EXCLUDED.seller_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.create_seller_contact_message(UUID, TEXT);

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
  created_at TIMESTAMPTZ,
  campaign_access_status TEXT,
  campaign_enabled_at TIMESTAMPTZ,
  campaign_source TEXT,
  campaign_seller_id UUID,
  campaign_seller_name TEXT,
  can_enable_campaign BOOLEAN
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
  v_existing_link RECORD;
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

  SELECT
    sr.seller_id,
    sr.source,
    sr.campaign_enabled_at,
    linked_seller.name AS seller_name
  INTO v_existing_link
  FROM public.seller_referrals sr
  JOIN public.sellers linked_seller
    ON linked_seller.id = sr.seller_id
  WHERE sr.referred_user_id = v_user_id
  LIMIT 1;

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
    v_inserted.created_at,
    CASE
      WHEN v_existing_link.seller_id IS NULL THEN 'pending_enable'
      WHEN v_existing_link.seller_id = v_seller.id THEN 'enabled_for_this_seller'
      ELSE 'enabled_for_other_seller'
    END AS campaign_access_status,
    v_existing_link.campaign_enabled_at,
    v_existing_link.source,
    v_existing_link.seller_id,
    v_existing_link.seller_name,
    (v_existing_link.seller_id IS NULL) AS can_enable_campaign;
END;
$$;

REVOKE ALL ON FUNCTION public.create_seller_contact_message(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_seller_contact_message(UUID, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_list_seller_contact_messages(INTEGER);

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
  created_at TIMESTAMPTZ,
  campaign_access_status TEXT,
  campaign_enabled_at TIMESTAMPTZ,
  campaign_source TEXT,
  campaign_seller_id UUID,
  campaign_seller_name TEXT,
  can_enable_campaign BOOLEAN
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
    m.created_at,
    CASE
      WHEN sr.seller_id IS NULL THEN 'pending_enable'
      WHEN sr.seller_id = m.seller_id THEN 'enabled_for_this_seller'
      ELSE 'enabled_for_other_seller'
    END AS campaign_access_status,
    sr.campaign_enabled_at,
    sr.source,
    sr.seller_id AS campaign_seller_id,
    linked_seller.name AS campaign_seller_name,
    (sr.seller_id IS NULL) AS can_enable_campaign
  FROM public.seller_contact_messages m
  JOIN public.sellers s
    ON s.id = m.seller_id
  LEFT JOIN public.seller_referrals sr
    ON sr.referred_user_id = m.user_id
  LEFT JOIN public.sellers linked_seller
    ON linked_seller.id = sr.seller_id
  ORDER BY
    CASE
      WHEN sr.seller_id IS NULL THEN 0
      WHEN sr.seller_id = m.seller_id THEN 1
      ELSE 2
    END,
    CASE m.status
      WHEN 'new' THEN 0
      WHEN 'contacted' THEN 1
      WHEN 'enabled' THEN 2
      ELSE 3
    END,
    m.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_seller_contact_messages(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_seller_contact_messages(INTEGER) TO authenticated;

DROP FUNCTION IF EXISTS public.seller_list_my_contact_messages(INTEGER);

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
  created_at TIMESTAMPTZ,
  campaign_access_status TEXT,
  campaign_enabled_at TIMESTAMPTZ,
  campaign_source TEXT,
  campaign_seller_id UUID,
  campaign_seller_name TEXT,
  can_enable_campaign BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER;
  v_seller_id UUID;
BEGIN
  v_seller_id := public.get_authenticated_seller_id();

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
    m.created_at,
    CASE
      WHEN sr.seller_id IS NULL THEN 'pending_enable'
      WHEN sr.seller_id = m.seller_id THEN 'enabled_for_this_seller'
      ELSE 'enabled_for_other_seller'
    END AS campaign_access_status,
    sr.campaign_enabled_at,
    sr.source,
    sr.seller_id AS campaign_seller_id,
    linked_seller.name AS campaign_seller_name,
    (sr.seller_id IS NULL) AS can_enable_campaign
  FROM public.seller_contact_messages m
  JOIN public.sellers s
    ON s.id = m.seller_id
  LEFT JOIN public.seller_referrals sr
    ON sr.referred_user_id = m.user_id
  LEFT JOIN public.sellers linked_seller
    ON linked_seller.id = sr.seller_id
  WHERE m.seller_id = v_seller_id
  ORDER BY
    CASE
      WHEN sr.seller_id IS NULL THEN 0
      WHEN sr.seller_id = m.seller_id THEN 1
      ELSE 2
    END,
    CASE m.status
      WHEN 'new' THEN 0
      WHEN 'contacted' THEN 1
      WHEN 'enabled' THEN 2
      ELSE 3
    END,
    m.created_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_list_my_contact_messages(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_list_my_contact_messages(INTEGER) TO authenticated;

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
  v_is_admin := LOWER(COALESCE(auth.jwt()->>'email', '')) = 'fatopago@gmail.com';
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
    RETURNING campaign_enabled_at INTO v_enabled_at;
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
  WHERE seller_id = v_message.seller_id
    AND user_id = v_message.user_id
    AND status IN ('new', 'contacted');

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

REVOKE ALL ON FUNCTION public.seller_enable_campaign_for_contact_message(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_enable_campaign_for_contact_message(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.build_seller_campaign_report(
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
  WITH current_cycle AS (
    SELECT cycle_number
    FROM public.get_weekly_cycle_window(now(), 0)
  ),
  seller_row AS (
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
      sr.id::TEXT AS id,
      sr.created_at,
      sr.affiliate_code,
      sr.referred_user_id,
      COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(lm.user_name), ''), 'Usuário') AS name,
      COALESCE(NULLIF(TRIM(p.lastname), ''), NULLIF(TRIM(lm.user_lastname), ''), '') AS lastname,
      COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(lm.user_email), '')) AS email,
      COALESCE(NULLIF(TRIM(p.phone), ''), NULLIF(TRIM(lm.user_phone), '')) AS phone,
      p.city,
      p.state,
      sr.source,
      sr.campaign_enabled_at
    FROM public.seller_referrals sr
    LEFT JOIN public.profiles p
      ON p.id = sr.referred_user_id
    LEFT JOIN LATERAL (
      SELECT
        m.user_name,
        m.user_lastname,
        m.user_email,
        m.user_phone
      FROM public.seller_contact_messages m
      WHERE m.seller_id = sr.seller_id
        AND m.user_id = sr.referred_user_id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) lm ON TRUE
    WHERE sr.seller_id = p_seller_id
  ),
  purchase_base AS (
    SELECT
      pp.id,
      pp.user_id,
      pp.plan_id,
      public.resolve_plan_purchase_amount(pp.plan_id, pp.validation_credit_total) AS amount,
      pp.status,
      pp.created_at,
      cw.cycle_number
    FROM public.plan_purchases pp
    LEFT JOIN LATERAL public.get_weekly_cycle_window(pp.created_at, 0) cw
      ON TRUE
    WHERE pp.seller_id = p_seller_id
      AND public.is_campaign_attributed_plan_id(pp.plan_id)
      AND COALESCE(pp.status, '') <> 'cancelled'
  ),
  latest_messages AS (
    SELECT DISTINCT ON (m.user_id)
      m.user_id,
      m.message,
      m.created_at,
      m.user_name,
      m.user_lastname,
      m.user_email,
      m.user_phone
    FROM public.seller_contact_messages m
    WHERE m.seller_id = p_seller_id
    ORDER BY m.user_id, m.created_at DESC
  ),
  message_stats AS (
    SELECT
      m.user_id,
      COUNT(*)::INT AS contact_requests_count,
      MAX(m.created_at) AS last_contact_request_at
    FROM public.seller_contact_messages m
    WHERE m.seller_id = p_seller_id
    GROUP BY m.user_id
  ),
  sales AS (
    SELECT
      pb.id::TEXT AS id,
      pb.user_id,
      COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(lm.user_name), ''), 'Usuário') AS referred_name,
      COALESCE(NULLIF(TRIM(p.lastname), ''), NULLIF(TRIM(lm.user_lastname), ''), '') AS referred_lastname,
      COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(lm.user_email), '')) AS referred_email,
      pb.plan_id,
      pb.amount,
      pb.status,
      pb.created_at
    FROM purchase_base pb
    LEFT JOIN public.profiles p
      ON p.id = pb.user_id
    LEFT JOIN latest_messages lm
      ON lm.user_id = pb.user_id
    ORDER BY pb.created_at DESC
  ),
  purchase_stats AS (
    SELECT
      pb.user_id,
      COUNT(*)::INT AS total_campaign_sales,
      COALESCE(SUM(pb.amount), 0)::NUMERIC AS total_campaign_revenue,
      MIN(pb.created_at) AS first_campaign_purchase_at,
      MAX(pb.created_at) AS last_campaign_purchase_at,
      MAX(pb.cycle_number) AS last_campaign_purchase_cycle_number
    FROM purchase_base pb
    GROUP BY pb.user_id
  ),
  latest_purchase AS (
    SELECT DISTINCT ON (pb.user_id)
      pb.user_id,
      pb.plan_id AS last_campaign_plan_id,
      pb.created_at AS last_campaign_purchase_at
    FROM purchase_base pb
    ORDER BY pb.user_id, pb.created_at DESC
  ),
  campaign_customers AS (
    SELECT
      sr.referred_user_id AS user_id,
      COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(lm.user_name), ''), 'Usuário') AS name,
      COALESCE(NULLIF(TRIM(p.lastname), ''), NULLIF(TRIM(lm.user_lastname), ''), '') AS lastname,
      COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(lm.user_email), '')) AS email,
      COALESCE(NULLIF(TRIM(p.phone), ''), NULLIF(TRIM(lm.user_phone), '')) AS phone,
      p.city,
      p.state,
      sr.source,
      sr.created_at AS linked_at,
      sr.campaign_enabled_at,
      COALESCE(ms.contact_requests_count, 0) AS contact_requests_count,
      ms.last_contact_request_at,
      lm.message AS latest_contact_message,
      COALESCE(ps.total_campaign_sales, 0) AS total_campaign_sales,
      COALESCE(ps.total_campaign_revenue, 0) AS total_campaign_revenue,
      ps.first_campaign_purchase_at,
      ps.last_campaign_purchase_at,
      lp.last_campaign_plan_id,
      CASE
        WHEN ps.last_campaign_purchase_cycle_number IS NULL THEN NULL
        ELSE GREATEST((SELECT cycle_number FROM current_cycle) - ps.last_campaign_purchase_cycle_number, 0)
      END AS cycles_without_campaign_purchase,
      CASE
        WHEN ps.last_campaign_purchase_cycle_number IS NULL THEN FALSE
        ELSE ((SELECT cycle_number FROM current_cycle) - ps.last_campaign_purchase_cycle_number) >= 2
      END AS needs_reactivation
    FROM public.seller_referrals sr
    LEFT JOIN public.profiles p
      ON p.id = sr.referred_user_id
    LEFT JOIN latest_messages lm
      ON lm.user_id = sr.referred_user_id
    LEFT JOIN message_stats ms
      ON ms.user_id = sr.referred_user_id
    LEFT JOIN purchase_stats ps
      ON ps.user_id = sr.referred_user_id
    LEFT JOIN latest_purchase lp
      ON lp.user_id = sr.referred_user_id
    WHERE sr.seller_id = p_seller_id
    ORDER BY
      COALESCE(ps.last_campaign_purchase_at, sr.created_at) DESC,
      sr.created_at DESC
  )
  SELECT jsonb_build_object(
    'seller', COALESCE((SELECT to_jsonb(seller_row) FROM seller_row), '{}'::JSONB),
    'referred_users', COALESCE((SELECT jsonb_agg(to_jsonb(referred_users) ORDER BY referred_users.created_at DESC) FROM referred_users), '[]'::JSONB),
    'sales', COALESCE((SELECT jsonb_agg(to_jsonb(sales) ORDER BY sales.created_at DESC) FROM sales), '[]'::JSONB),
    'campaign_customers', COALESCE((SELECT jsonb_agg(to_jsonb(campaign_customers) ORDER BY campaign_customers.linked_at DESC) FROM campaign_customers), '[]'::JSONB)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.build_seller_campaign_report(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_seller_campaign_report(UUID) TO authenticated;

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
      pp.seller_id,
      pp.user_id,
      public.resolve_plan_purchase_amount(pp.plan_id, pp.validation_credit_total) AS amount,
      pp.created_at
    FROM public.plan_purchases pp
    WHERE pp.seller_id IS NOT NULL
      AND public.is_campaign_attributed_plan_id(pp.plan_id)
      AND COALESCE(pp.status, '') <> 'cancelled'
  ),
  sales_summary AS (
    SELECT
      sb.seller_id,
      COUNT(DISTINCT sb.user_id)::INT AS paid_customers,
      COALESCE(SUM(sb.amount), 0)::NUMERIC AS total_revenue,
      COALESCE(SUM(sb.amount) FILTER (WHERE sb.created_at >= b.today_start_at), 0)::NUMERIC AS today_revenue,
      COALESCE(SUM(sb.amount) FILTER (WHERE sb.created_at >= c.cycle_start_at), 0)::NUMERIC AS week_revenue,
      COALESCE(SUM(sb.amount) FILTER (WHERE sb.created_at >= b.month_start_at), 0)::NUMERIC AS month_revenue,
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
BEGIN
  PERFORM public.assert_fatopago_admin();
  RETURN public.build_seller_campaign_report(p_seller_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_seller_report(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_seller_report(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.seller_get_my_report()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id UUID;
BEGIN
  v_seller_id := public.get_authenticated_seller_id();

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Vendedor não encontrado.';
  END IF;

  RETURN public.build_seller_campaign_report(v_seller_id);
END;
$$;

REVOKE ALL ON FUNCTION public.seller_get_my_report() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seller_get_my_report() TO authenticated;
