CREATE OR REPLACE FUNCTION public.admin_create_collaborator(
  p_email text,
  p_password text
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_encrypted_pw text;
BEGIN
  -- 1. Ensure calling user is an Admin
  PERFORM public.assert_fatopago_admin();

  -- 2. Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'E-mail j est em uso.');
  END IF;

  v_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    p_email, v_encrypted_pw, now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"is_collaborator": true}',
    now(), now()
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id, 'email', p_email),
    'email', now(), now(), now()
  );

  RETURN jsonb_build_object('status', 'success', 'user_id', v_user_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_collaborator(text, text) TO authenticated;

-- LIST COLLABORATORS
CREATE OR REPLACE FUNCTION public.admin_list_collaborators()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_fatopago_admin();
  
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at
  FROM auth.users u
  WHERE u.raw_user_meta_data->>'is_collaborator' = 'true'
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_collaborators() TO authenticated;

-- DELETE COLLABORATOR
CREATE OR REPLACE FUNCTION public.admin_delete_collaborator(p_user_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_fatopago_admin();
  
  IF (SELECT raw_user_meta_data->>'is_collaborator' FROM auth.users WHERE id = p_user_id) = 'true' THEN
    DELETE FROM auth.users WHERE id = p_user_id;
    RETURN jsonb_build_object('status', 'success');
  ELSE
    RETURN jsonb_build_object('status', 'error', 'message', 'Usurio no  um colaborador.');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'error', 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_collaborator(uuid) TO authenticated;
