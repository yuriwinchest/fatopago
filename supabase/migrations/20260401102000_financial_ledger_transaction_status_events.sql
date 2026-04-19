-- Blindagem append-only do livro-razao para capturar mudancas de status em transactions.
-- Objetivo:
-- 1) Garantir linha base no ledger para qualquer transacao legada sem captura.
-- 2) Registrar cada transicao de status como evento imutavel (sem mutar linha antiga).
-- 3) Backfill de eventos de status quando houver drift historico entre transactions e ledger base.

-- 1) Linha base faltante para transacoes legadas (idempotente)
INSERT INTO public.financial_ledger (
  user_id,
  entry_type,
  amount,
  source_table,
  source_id,
  description,
  transaction_status,
  actor_user_id,
  metadata,
  created_at
)
SELECT
  t.user_id,
  CASE WHEN t.type = 'credit' THEN 'credit' ELSE 'debit' END AS entry_type,
  COALESCE(t.amount, 0)::NUMERIC(12,2) AS amount,
  'transactions' AS source_table,
  t.id::TEXT AS source_id,
  COALESCE(t.description, '') AS description,
  COALESCE(t.status, '') AS transaction_status,
  t.user_id AS actor_user_id,
  jsonb_build_object(
    'transaction_type', t.type,
    'backfilled', TRUE,
    'source', 'transactions_base_backfill',
    'transaction_created_at', t.created_at
  ) AS metadata,
  COALESCE(t.created_at, NOW()) AS created_at
FROM public.transactions t
LEFT JOIN public.financial_ledger fl
  ON fl.source_table = 'transactions'
 AND fl.source_id = t.id::TEXT
WHERE fl.id IS NULL
ON CONFLICT (source_table, source_id) DO NOTHING;

-- 2) Trigger append-only para transicoes de status
CREATE OR REPLACE FUNCTION public.capture_transaction_status_to_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.financial_ledger (
    user_id,
    entry_type,
    amount,
    source_table,
    source_id,
    description,
    transaction_status,
    actor_user_id,
    metadata
  )
  VALUES (
    NEW.user_id,
    'adjustment',
    0::NUMERIC(12,2),
    'transactions_status',
    NEW.id::TEXT || ':' || COALESCE(NEW.status, ''),
    FORMAT(
      'Mudanca de status da transacao: %s -> %s',
      COALESCE(OLD.status, '(vazio)'),
      COALESCE(NEW.status, '(vazio)')
    ),
    COALESCE(NEW.status, ''),
    COALESCE(auth.uid(), NEW.user_id),
    jsonb_build_object(
      'transaction_id', NEW.id,
      'transaction_type', NEW.type,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'status_changed_at', COALESCE(NEW.updated_at, NOW()),
      'source', 'transaction_status_trigger'
    )
  )
  ON CONFLICT (source_table, source_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_capture_transaction_status_to_ledger ON public.transactions;
CREATE TRIGGER trg_capture_transaction_status_to_ledger
AFTER UPDATE ON public.transactions
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.capture_transaction_status_to_ledger();

-- 3) Backfill de eventos de status quando status atual divergir do status capturado na linha base
WITH tx_base AS (
  SELECT
    t.id,
    t.user_id,
    t.type,
    t.status AS current_status,
    t.created_at,
    t.updated_at,
    fl.transaction_status AS base_status
  FROM public.transactions t
  LEFT JOIN public.financial_ledger fl
    ON fl.source_table = 'transactions'
   AND fl.source_id = t.id::TEXT
)
INSERT INTO public.financial_ledger (
  user_id,
  entry_type,
  amount,
  source_table,
  source_id,
  description,
  transaction_status,
  actor_user_id,
  metadata,
  created_at
)
SELECT
  tb.user_id,
  'adjustment',
  0::NUMERIC(12,2),
  'transactions_status',
  tb.id::TEXT || ':' || COALESCE(tb.current_status, ''),
  FORMAT(
    'Backfill de status da transacao para %s',
    COALESCE(tb.current_status, '(vazio)')
  ),
  COALESCE(tb.current_status, ''),
  tb.user_id,
  jsonb_build_object(
    'transaction_id', tb.id,
    'transaction_type', tb.type,
    'old_status', tb.base_status,
    'new_status', tb.current_status,
    'backfilled', TRUE,
    'source', 'transaction_status_backfill',
    'status_changed_at', COALESCE(tb.updated_at, tb.created_at, NOW())
  ),
  COALESCE(tb.updated_at, tb.created_at, NOW())
FROM tx_base tb
WHERE COALESCE(tb.base_status, '') IS DISTINCT FROM COALESCE(tb.current_status, '')
ON CONFLICT (source_table, source_id) DO NOTHING;
