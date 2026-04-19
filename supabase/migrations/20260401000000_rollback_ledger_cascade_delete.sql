-- Rollback risk introduced by cascade behavior on financial ledger.
-- Financial records must be immutable and preserved, even after account closure.

-- 1) Enforce FK protection on ledger (no cascade delete on auth.users).
ALTER TABLE public.financial_ledger
  DROP CONSTRAINT IF EXISTS financial_ledger_user_id_fkey;

ALTER TABLE public.financial_ledger
  ADD CONSTRAINT financial_ledger_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE RESTRICT;

-- 2) Ensure client roles cannot physically delete profiles.
REVOKE DELETE ON TABLE public.profiles FROM authenticated, anon;

-- 3) Implement account closure by anonymization + soft delete.
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

  IF COALESCE(v_profile.is_deleted, FALSE) THEN
    RETURN jsonb_build_object(
      'status', 'already_closed',
      'user_id', p_target_user_id,
      'deleted_at', v_profile.deleted_at
    );
  END IF;

  v_reason := CASE
    WHEN v_actor_user_id = p_target_user_id THEN 'self_close_account'
    ELSE 'admin_close_account'
  END;

  -- Reuse centralized PII anonymization for profile table.
  PERFORM public.anonymize_profile_account(
    p_target_user_id,
    v_reason,
    v_actor_user_id
  );

  v_deleted_email := format('deleted+%s@anon.fatopago.local', replace(p_target_user_id::TEXT, '-', ''));

  UPDATE auth.users
  SET
    email = v_deleted_email,
    phone = NULL,
    encrypted_password = NULL,
    banned_until = '2999-12-31 23:59:59+00'::TIMESTAMPTZ,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::JSONB) || jsonb_build_object(
      'account_status', 'closed',
      'closed_at', NOW(),
      'closed_by', v_actor_user_id::TEXT
    ),
    updated_at = NOW(),
    deleted_at = COALESCE(deleted_at, NOW())
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object(
    'status', 'closed',
    'user_id', p_target_user_id,
    'by', v_actor_user_id,
    'mode', 'soft_delete_anonymized'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.close_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_user_account(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_user_account(UUID) TO service_role;

-- 4) Force existing self-delete RPC to use close_user_account only.
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN public.close_user_account(v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
