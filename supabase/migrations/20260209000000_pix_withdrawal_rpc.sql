-- Atomic PIX withdrawal request (deduct balance + create records) via RPC
-- Mirrors the pattern used in 20260130000000_secure_validation_rpc.sql.

CREATE OR REPLACE FUNCTION public.request_pix_withdrawal(
  p_amount NUMERIC,
  p_pix_key TEXT,
  p_pix_key_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_withdrawal_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  IF p_amount IS NULL OR p_amount < 10 THEN
    RETURN json_build_object('status', 'error', 'message', 'Valor mínimo para saque é R$ 10,00');
  END IF;

  IF p_pix_key IS NULL OR length(btrim(p_pix_key)) < 3 THEN
    RETURN json_build_object('status', 'error', 'message', 'Chave PIX inválida');
  END IF;

  IF p_pix_key_type IS NULL OR p_pix_key_type NOT IN ('cpf', 'email', 'phone', 'random') THEN
    RETURN json_build_object('status', 'error', 'message', 'Tipo de chave PIX inválido');
  END IF;

  -- Lock profile row to prevent race conditions (double-withdraw).
  SELECT current_balance
  INTO v_current_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Perfil não encontrado');
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  IF v_current_balance < p_amount THEN
    RETURN json_build_object('status', 'error', 'message', 'Saldo insuficiente');
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.profiles
  SET current_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_user_id;

  INSERT INTO public.pix_withdrawals (
    user_id, amount, pix_key, pix_key_type, status, created_at, updated_at
  ) VALUES (
    v_user_id, p_amount, btrim(p_pix_key), p_pix_key_type, 'pending', NOW(), NOW()
  )
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO public.transactions (
    user_id, amount, type, description, status, created_at, updated_at
  ) VALUES (
    v_user_id,
    p_amount,
    'debit',
    'Saque PIX (solicitacao)',
    'pending',
    NOW(),
    NOW()
  );

  RETURN json_build_object(
    'status', 'success',
    'withdrawal_id', v_withdrawal_id,
    'new_balance', v_new_balance
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_pix_withdrawal(NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_pix_withdrawal(NUMERIC, TEXT, TEXT) TO authenticated;

