-- Backfill ledger entries for historical transactions created before trigger-based capture.

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
    'backfilled', TRUE
  ) AS metadata,
  COALESCE(t.created_at, NOW()) AS created_at
FROM public.transactions t
ON CONFLICT (source_table, source_id) DO NOTHING;
