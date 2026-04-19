CREATE TABLE IF NOT EXISTS public.mercadopago_webhook_receipts (
  request_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mercadopago_webhook_receipts_received_at_idx
  ON public.mercadopago_webhook_receipts (received_at DESC);

ALTER TABLE public.mercadopago_webhook_receipts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mercadopago_webhook_receipts FROM PUBLIC;
REVOKE ALL ON TABLE public.mercadopago_webhook_receipts FROM anon;
REVOKE ALL ON TABLE public.mercadopago_webhook_receipts FROM authenticated;
