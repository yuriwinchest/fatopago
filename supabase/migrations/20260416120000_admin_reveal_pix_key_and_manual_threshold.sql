-- Admin: revelar chave PIX completa para transferencia manual
-- Muda threshold de revisao manual para R$0 (todas as retiradas passam por revisao enquanto nao tiver provedor automatico)

CREATE OR REPLACE FUNCTION public.admin_get_pix_withdrawal_full_key(
  p_withdrawal_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT pix_key INTO v_key
  FROM public.pix_withdrawals
  WHERE id = p_withdrawal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saque nao encontrado';
  END IF;

  RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_pix_withdrawal_full_key(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_pix_withdrawal_full_key(UUID) TO authenticated, service_role;

-- Altera o threshold de revisao manual para R$0 (TODAS as retiradas vao para revisao manual)
-- Motivo: o Mercado Pago NAO possui API de saque PIX no Brasil; processamento automatico nao funciona.
-- Quando integrar um provedor real (Transfeera, EBANX, Celcoin, etc), basta alterar de volta para o valor desejado.

DROP FUNCTION IF EXISTS public.request_pix_withdrawal(NUMERIC, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.request_pix_withdrawal(
  p_amount NUMERIC,
  p_pix_key TEXT,
  p_pix_key_type TEXT DEFAULT 'cpf'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_amount NUMERIC(12,2);
  v_pix_key TEXT;
  v_pix_key_type TEXT;
  v_profile public.profiles%ROWTYPE;
  v_existing_open INT;
  v_idempotency_key TEXT;
  v_withdrawal_id UUID;
  v_tx_id UUID;
  v_initial_status TEXT := 'pending';
  v_requires_manual_review BOOLEAN := FALSE;
  v_review_reason TEXT := '';
  v_manual_review_threshold NUMERIC(12,2) := 0.00;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Autenticacao necessaria');
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0), 2);
  v_pix_key := TRIM(COALESCE(p_pix_key, ''));
  v_pix_key_type := LOWER(TRIM(COALESCE(p_pix_key_type, 'cpf')));

  IF v_amount < 1.00 THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Valor minimo de saque e R$ 1,00');
  END IF;

  IF v_amount > 50000.00 THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Valor maximo de saque e R$ 50.000,00');
  END IF;

  IF v_pix_key = '' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Chave PIX obrigatoria');
  END IF;

  IF v_pix_key_type NOT IN ('cpf', 'cnpj', 'email', 'phone', 'random') THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Tipo de chave PIX invalido');
  END IF;

  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Perfil nao encontrado');
  END IF;

  IF COALESCE(v_profile.current_balance, 0) < v_amount THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', format('Saldo insuficiente. Disponivel: R$ %s', to_char(COALESCE(v_profile.current_balance, 0), 'FM999999990D00'))
    );
  END IF;

  SELECT COUNT(*) INTO v_existing_open
  FROM public.pix_withdrawals
  WHERE user_id = v_user_id
    AND status IN ('pending', 'pending_manual_review', 'processing');

  IF v_existing_open > 0 THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Voce ja possui um saque em andamento. Aguarde a conclusao antes de solicitar outro.');
  END IF;

  v_idempotency_key := 'pix_wd_' || v_user_id || '_' || to_char(v_now, 'YYYYMMDDHH24MISSMS');

  -- Threshold = R$0: TODAS as retiradas vao para revisao manual
  IF v_amount >= v_manual_review_threshold THEN
    v_requires_manual_review := TRUE;
    v_review_reason := format(
      'Revisao manual obrigatoria (threshold R$ %s)',
      to_char(v_manual_review_threshold, 'FM999999990D00')
    );
  END IF;

  IF v_pix_key_type = 'random' AND char_length(v_pix_key) > 50 THEN
    v_requires_manual_review := TRUE;
    v_review_reason := v_review_reason || '; Chave aleatoria longa';
  END IF;

  IF v_requires_manual_review THEN
    v_initial_status := 'pending_manual_review';
  END IF;

  UPDATE public.profiles
  SET current_balance = COALESCE(current_balance, 0) - v_amount,
      updated_at = v_now
  WHERE id = v_user_id;

  INSERT INTO public.transactions (
    user_id, amount, type, description, status, created_at, updated_at
  ) VALUES (
    v_user_id, v_amount, 'debit', 'Saque PIX (solicitacao)', 'pending', v_now, v_now
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.pix_withdrawals (
    user_id, amount, pix_key, pix_key_type, idempotency_key,
    status, transaction_id,
    manual_review_required, review_reason,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_amount, v_pix_key, v_pix_key_type, v_idempotency_key,
    v_initial_status, v_tx_id,
    v_requires_manual_review, CASE WHEN v_requires_manual_review THEN LEFT(v_review_reason, 240) ELSE NULL END,
    v_now, v_now
  )
  RETURNING id INTO v_withdrawal_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'withdrawal_id', v_withdrawal_id,
    'transaction_id', v_tx_id,
    'amount', v_amount,
    'initial_status', v_initial_status,
    'manual_review_required', v_requires_manual_review,
    'review_reason', CASE WHEN v_requires_manual_review THEN LEFT(v_review_reason, 240) ELSE NULL END
  );
END;
$$;
