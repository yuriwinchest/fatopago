CREATE OR REPLACE FUNCTION public.is_valid_brazilian_cpf(p_cpf TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_digits TEXT := regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g');
  v_sum INTEGER := 0;
  v_remainder INTEGER;
  v_digit1 INTEGER;
  v_digit2 INTEGER;
  i INTEGER;
BEGIN
  IF length(v_digits) <> 11 THEN
    RETURN FALSE;
  END IF;

  IF v_digits ~ '^(\d)\1{10}$' THEN
    RETURN FALSE;
  END IF;

  FOR i IN 1..9 LOOP
    v_sum := v_sum + substr(v_digits, i, 1)::INTEGER * (11 - i);
  END LOOP;

  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 THEN
    v_remainder := 0;
  END IF;
  v_digit1 := v_remainder;

  IF v_digit1 <> substr(v_digits, 10, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + substr(v_digits, i, 1)::INTEGER * (12 - i);
  END LOOP;

  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 THEN
    v_remainder := 0;
  END IF;
  v_digit2 := v_remainder;

  RETURN v_digit2 = substr(v_digits, 11, 1)::INTEGER;
END;
$$;

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
  v_amount NUMERIC(12,2);
  v_pix_key_type TEXT;
  v_pix_key TEXT;
  v_digits TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Usuário não autenticado');
  END IF;

  IF p_amount IS NULL THEN
    RETURN json_build_object('status', 'error', 'message', 'Valor inválido');
  END IF;

  v_amount := round(p_amount::NUMERIC, 2);
  IF v_amount < 10 OR abs(v_amount - p_amount) > 0.000001 THEN
    RETURN json_build_object('status', 'error', 'message', 'Valor inválido');
  END IF;

  v_pix_key_type := lower(btrim(COALESCE(p_pix_key_type, '')));
  IF v_pix_key_type NOT IN ('cpf', 'email', 'phone', 'random') THEN
    RETURN json_build_object('status', 'error', 'message', 'Tipo de chave PIX inválido');
  END IF;

  v_pix_key := btrim(COALESCE(p_pix_key, ''));
  IF v_pix_key = '' THEN
    RETURN json_build_object('status', 'error', 'message', 'Chave PIX inválida');
  END IF;

  CASE v_pix_key_type
    WHEN 'cpf' THEN
      v_digits := regexp_replace(v_pix_key, '\D', '', 'g');
      IF NOT public.is_valid_brazilian_cpf(v_digits) THEN
        RETURN json_build_object('status', 'error', 'message', 'CPF PIX inválido');
      END IF;
      v_pix_key := v_digits;

    WHEN 'email' THEN
      v_pix_key := lower(v_pix_key);
      IF v_pix_key !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
        RETURN json_build_object('status', 'error', 'message', 'E-mail PIX inválido');
      END IF;

    WHEN 'phone' THEN
      v_digits := regexp_replace(v_pix_key, '\D', '', 'g');
      IF v_digits ~ '^55\d{10,11}$' THEN
        v_pix_key := '+' || v_digits;
      ELSIF v_digits ~ '^\d{10,11}$' THEN
        v_pix_key := '+55' || v_digits;
      ELSE
        RETURN json_build_object('status', 'error', 'message', 'Telefone PIX inválido');
      END IF;

    WHEN 'random' THEN
      v_pix_key := lower(v_pix_key);
      IF v_pix_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        RETURN json_build_object('status', 'error', 'message', 'Chave aleatória PIX inválida');
      END IF;
  END CASE;

  IF EXISTS (
    SELECT 1
    FROM public.pix_withdrawals
    WHERE user_id = v_user_id
      AND status IN ('pending', 'processing')
    LIMIT 1
  ) THEN
    RETURN json_build_object('status', 'error', 'message', 'Já existe um saque PIX em processamento');
  END IF;

  SELECT current_balance
  INTO v_current_balance
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'error', 'message', 'Perfil não encontrado');
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  IF v_current_balance < v_amount THEN
    RETURN json_build_object('status', 'error', 'message', 'Saldo insuficiente');
  END IF;

  v_new_balance := v_current_balance - v_amount;

  UPDATE public.profiles
  SET current_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_user_id;

  INSERT INTO public.pix_withdrawals (
    user_id, amount, pix_key, pix_key_type, status, created_at, updated_at
  ) VALUES (
    v_user_id, v_amount, v_pix_key, v_pix_key_type, 'pending', NOW(), NOW()
  )
  RETURNING id INTO v_withdrawal_id;

  INSERT INTO public.transactions (
    user_id, amount, type, description, status, created_at, updated_at
  ) VALUES (
    v_user_id,
    v_amount,
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

REVOKE ALL ON FUNCTION public.is_valid_brazilian_cpf(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_brazilian_cpf(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.request_pix_withdrawal(NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_pix_withdrawal(NUMERIC, TEXT, TEXT) TO authenticated;
