CREATE TABLE IF NOT EXISTS public.plan_catalog (
  plan_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'pro', 'expert')),
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  price NUMERIC(10,2) NOT NULL CHECK (price > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_seller_exclusive BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;

INSERT INTO public.plan_catalog (
  plan_id,
  display_name,
  tier,
  period,
  price,
  is_active,
  is_seller_exclusive,
  sort_order
)
VALUES
  ('starter', 'Pacote Diário Básico', 'starter', 'daily', 6.00, TRUE, FALSE, 10),
  ('pro', 'Pacote Diário Médio', 'pro', 'daily', 10.00, TRUE, FALSE, 20),
  ('expert', 'Pacote Diário Máximo', 'expert', 'daily', 20.00, TRUE, FALSE, 30),
  ('starter_weekly', 'Pacote Semanal Básico', 'starter', 'weekly', 42.00, TRUE, TRUE, 40),
  ('pro_weekly', 'Pacote Semanal Médio', 'pro', 'weekly', 70.00, TRUE, TRUE, 50),
  ('expert_weekly', 'Pacote Semanal Máximo', 'expert', 'weekly', 140.00, TRUE, TRUE, 60),
  ('starter_monthly', 'Pacote Mensal Básico', 'starter', 'monthly', 180.00, TRUE, TRUE, 70),
  ('pro_monthly', 'Pacote Mensal Médio', 'pro', 'monthly', 300.00, TRUE, TRUE, 80),
  ('expert_monthly', 'Pacote Mensal Máximo', 'expert', 'monthly', 600.00, TRUE, TRUE, 90)
ON CONFLICT (plan_id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  tier = EXCLUDED.tier,
  period = EXCLUDED.period,
  price = EXCLUDED.price,
  is_active = EXCLUDED.is_active,
  is_seller_exclusive = EXCLUDED.is_seller_exclusive,
  sort_order = EXCLUDED.sort_order,
  updated_at = timezone('utc', now());

CREATE OR REPLACE FUNCTION public.resolve_plan_purchase_amount(
  p_plan_id TEXT,
  p_validation_credit_total NUMERIC DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    p_validation_credit_total,
    (
      SELECT pc.price
      FROM public.plan_catalog AS pc
      WHERE pc.plan_id = p_plan_id
        AND pc.is_active = TRUE
      LIMIT 1
    ),
    0::NUMERIC
  );
$$;
