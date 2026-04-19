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
