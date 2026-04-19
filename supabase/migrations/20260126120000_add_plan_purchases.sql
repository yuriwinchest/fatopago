-- Plan purchases for validation access control

CREATE TABLE IF NOT EXISTS public.plan_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('starter', 'pro', 'expert')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  max_validations INTEGER NOT NULL,
  used_validations INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  last_validation_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS plan_purchases_user_idx ON public.plan_purchases (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS plan_purchases_user_active_unique
  ON public.plan_purchases (user_id)
  WHERE status = 'active';

ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS plan_purchase_id UUID REFERENCES public.plan_purchases(id) ON DELETE SET NULL;
