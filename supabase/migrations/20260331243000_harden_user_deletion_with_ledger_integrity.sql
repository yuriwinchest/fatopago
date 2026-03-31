-- Harden account deletion to preserve immutable financial history.
-- Strategy:
-- 1) Financial users are anonymized + disabled (soft-delete).
-- 2) Hard delete is allowed only when there is no financial history.
-- 3) financial_ledger remains strictly append-only (no DELETE/UPDATE).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

CREATE INDEX IF NOT EXISTS profiles_is_deleted_idx
  ON public.profiles (is_deleted, created_at DESC);

CREATE OR REPLACE FUNCTION public.user_has_financial_history(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT (
    EXISTS (SELECT 1 FROM public.financial_ledger fl WHERE fl.user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.pix_payments pp WHERE pp.user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.pix_withdrawals pw WHERE pw.user_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.plan_purchases p WHERE p.user_id = p_user_id)
  ) INTO v_has;

  RETURN COALESCE(v_has, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_financial_history(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_financial_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_financial_history(UUID) TO service_role;

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
    p.is_deleted
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

  IF COALESCE(v_profile.is_deleted, FALSE) THEN
    RETURN jsonb_build_object(
      'status', 'already_anonymized',
      'user_id', p_user_id
    );
  END IF;

  v_deleted_email := format('deleted+%s@anon.fatopago.local', replace(p_user_id::TEXT, '-', ''));

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
    'status', 'anonymized',
    'user_id', p_user_id,
    'anonymized_email', v_deleted_email,
    'actor_user_id', p_actor_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_profile_account(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.anonymize_profile_account(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_profile_account(UUID, TEXT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_profile_delete_with_financial_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.user_has_financial_history(OLD.id) THEN
    RAISE EXCEPTION 'Perfil com histórico financeiro não pode ser excluído fisicamente';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_delete_with_financial_history ON public.profiles;
CREATE TRIGGER trg_prevent_profile_delete_with_financial_history
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_delete_with_financial_history();

DROP FUNCTION IF EXISTS public.delete_own_account();

CREATE FUNCTION public.delete_own_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_has_history BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_has_history := public.user_has_financial_history(v_user_id);

  IF v_has_history THEN
    RETURN public.anonymize_profile_account(
      v_user_id,
      'self_delete_with_financial_history',
      v_user_id
    ) || jsonb_build_object('mode', 'anonymized');
  END IF;

  DELETE FROM public.profiles
  WHERE id = v_user_id;

  DELETE FROM auth.users
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'status', 'hard_deleted',
    'mode', 'hard_deleted',
    'user_id', v_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- Restore strict append-only behavior for the ledger.
CREATE OR REPLACE FUNCTION public.prevent_financial_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'financial_ledger é append-only e não permite %', TG_OP;
END;
$$;
