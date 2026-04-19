-- Corrige a reutilização de e-mail/CPF após encerramento de conta.
-- Estratégia:
-- 1) manter histórico financeiro e UUID do usuário;
-- 2) anonimizar PII de forma idempotente no perfil;
-- 3) sincronizar auth.users + auth.identities para liberar o e-mail original;
-- 4) backfill de contas já encerradas com o fluxo antigo.

CREATE OR REPLACE FUNCTION public.closed_account_email(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN format('deleted+%s@anon.fatopago.local', replace(p_user_id::TEXT, '-', ''));
END;
$$;

REVOKE ALL ON FUNCTION public.closed_account_email(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.closed_account_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.closed_account_email(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.anonymize_profile_account(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_deleted_email TEXT;
  v_was_deleted BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'user_id inválido'
    );
  END IF;

  SELECT
    p.id,
    p.email,
    p.cpf,
    p.is_deleted,
    p.deleted_at
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Perfil não encontrado',
      'user_id', p_user_id
    );
  END IF;

  v_was_deleted := COALESCE(v_profile.is_deleted, FALSE);
  v_deleted_email := public.closed_account_email(p_user_id);

  UPDATE public.profiles
  SET
    name = 'Usuário',
    lastname = 'Removido',
    email = v_deleted_email,
    phone = NULL,
    city = NULL,
    state = NULL,
    cpf = NULL,
    birth_date = NULL,
    avatar_url = NULL,
    affiliate_code = NULL,
    referral_code = NULL,
    referral_active = FALSE,
    plan_status = 'deleted',
    is_deleted = TRUE,
    deleted_at = COALESCE(deleted_at, NOW()),
    anonymized_at = NOW(),
    deletion_reason = LEFT(COALESCE(NULLIF(TRIM(p_reason), ''), 'user_deletion'), 240),
    updated_at = NOW()
  WHERE id = p_user_id;

  DELETE FROM public.seller_contact_messages
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'status', CASE WHEN v_was_deleted THEN 'already_anonymized' ELSE 'anonymized' END,
    'user_id', p_user_id,
    'anonymized_email', v_deleted_email,
    'actor_user_id', p_actor_user_id,
    'deleted_at', COALESCE(v_profile.deleted_at, NOW())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_profile_account(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonymize_profile_account(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_profile_account(UUID, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_closed_auth_record_sql(
  p_user_id UUID,
  p_actor_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_email TEXT;
  v_has_identities BOOLEAN := FALSE;
  v_has_provider_id BOOLEAN := FALSE;
  v_user_rows INTEGER := 0;
  v_identity_rows INTEGER := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'user_id inválido'
    );
  END IF;

  v_deleted_email := public.closed_account_email(p_user_id);

  UPDATE auth.users
  SET
    email = v_deleted_email,
    phone = NULL,
    encrypted_password = NULL,
    banned_until = '2999-12-31 23:59:59+00'::TIMESTAMPTZ,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::JSONB) || jsonb_build_object(
      'account_status', 'closed',
      'closed_at', NOW(),
      'closed_by', COALESCE(p_actor_user_id::TEXT, 'system'),
      'closure_reason', COALESCE(NULLIF(TRIM(p_reason), ''), 'closed_account')
    ),
    updated_at = NOW(),
    deleted_at = COALESCE(deleted_at, NOW())
  WHERE id = p_user_id;

  GET DIAGNOSTICS v_user_rows = ROW_COUNT;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name = 'identities'
  ) INTO v_has_identities;

  IF v_has_identities THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'auth'
        AND table_name = 'identities'
        AND column_name = 'provider_id'
    ) INTO v_has_provider_id;

    IF v_has_provider_id THEN
      EXECUTE $sql$
        UPDATE auth.identities
        SET
          provider_id = CASE WHEN provider = 'email' THEN $1 ELSE provider_id END,
          identity_data = COALESCE(identity_data, '{}'::jsonb) || jsonb_build_object('email', $1, 'email_verified', false),
          updated_at = NOW()
        WHERE user_id = $2
      $sql$
      USING v_deleted_email, p_user_id;
    ELSE
      EXECUTE $sql$
        UPDATE auth.identities
        SET
          identity_data = COALESCE(identity_data, '{}'::jsonb) || jsonb_build_object('email', $1, 'email_verified', false),
          updated_at = NOW()
        WHERE user_id = $2
      $sql$
      USING v_deleted_email, p_user_id;
    END IF;

    GET DIAGNOSTICS v_identity_rows = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'status', 'synced',
    'user_id', p_user_id,
    'deleted_email', v_deleted_email,
    'auth_user_rows', v_user_rows,
    'auth_identity_rows', v_identity_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_closed_auth_record_sql(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_closed_auth_record_sql(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_closed_auth_record_sql(UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.close_user_account(
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
  v_profile RECORD;
  v_deleted_email TEXT;
  v_reason TEXT;
BEGIN
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'target_user_id inválido'
    );
  END IF;

  SELECT COALESCE(public.is_admin_user(v_actor_user_id), FALSE)
  INTO v_is_admin;

  IF v_actor_user_id <> p_target_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado para encerrar outra conta';
  END IF;

  SELECT
    p.id,
    p.is_deleted,
    p.deleted_at
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Perfil não encontrado',
      'user_id', p_target_user_id
    );
  END IF;

  v_reason := CASE
    WHEN v_actor_user_id = p_target_user_id THEN 'self_close_account'
    ELSE 'admin_close_account'
  END;

  PERFORM public.anonymize_profile_account(
    p_target_user_id,
    v_reason,
    v_actor_user_id
  );

  PERFORM public.sync_closed_auth_record_sql(
    p_target_user_id,
    v_actor_user_id,
    v_reason
  );

  v_deleted_email := public.closed_account_email(p_target_user_id);

  RETURN jsonb_build_object(
    'status', CASE WHEN COALESCE(v_profile.is_deleted, FALSE) THEN 'already_closed' ELSE 'closed' END,
    'user_id', p_target_user_id,
    'by', v_actor_user_id,
    'mode', 'soft_delete_anonymized',
    'deleted_email', v_deleted_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_user_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_user_account(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.is_cpf_registered(cpf_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := NULLIF(regexp_replace(COALESCE(cpf_input, ''), '\D', '', 'g'), '');

  IF normalized IS NULL OR length(normalized) <> 11 THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE COALESCE(p.is_deleted, FALSE) = FALSE
      AND NULLIF(regexp_replace(COALESCE(p.cpf, ''), '\D', '', 'g'), '') = normalized
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_cpf_registered(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cpf_registered(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.is_cpf_registered(TEXT) TO authenticated;

DO $$
DECLARE
  v_profile RECORD;
BEGIN
  FOR v_profile IN
    SELECT p.id
    FROM public.profiles p
    WHERE COALESCE(p.is_deleted, FALSE) = TRUE
  LOOP
    PERFORM public.anonymize_profile_account(
      v_profile.id,
      'closed_account_backfill',
      v_profile.id
    );

    PERFORM public.sync_closed_auth_record_sql(
      v_profile.id,
      v_profile.id,
      'closed_account_backfill'
    );
  END LOOP;
END;
$$;
