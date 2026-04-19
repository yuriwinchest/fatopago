ALTER TABLE public.plan_purchases
  DROP CONSTRAINT IF EXISTS plan_purchases_plan_id_check;

ALTER TABLE public.plan_purchases
  ADD CONSTRAINT plan_purchases_plan_id_check
  CHECK (
    plan_id IN (
      'starter',
      'pro',
      'expert',
      'starter_weekly',
      'pro_weekly',
      'expert_weekly',
      'starter_monthly',
      'pro_monthly',
      'expert_monthly'
    )
  );

ALTER TABLE public.pix_payments
  DROP CONSTRAINT IF EXISTS pix_payments_plan_id_check;

ALTER TABLE public.pix_payments
  ADD CONSTRAINT pix_payments_plan_id_check
  CHECK (
    plan_id IN (
      'starter',
      'pro',
      'expert',
      'starter_weekly',
      'pro_weekly',
      'expert_weekly',
      'starter_monthly',
      'pro_monthly',
      'expert_monthly'
    )
  );

CREATE OR REPLACE FUNCTION public.resolve_plan_purchase_amount(
  p_plan_id TEXT,
  p_validation_credit_total NUMERIC DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    p_validation_credit_total,
    CASE
      WHEN p_plan_id = 'starter' THEN 6::NUMERIC
      WHEN p_plan_id = 'pro' THEN 10::NUMERIC
      WHEN p_plan_id = 'expert' THEN 20::NUMERIC
      WHEN p_plan_id = 'starter_weekly' THEN 42::NUMERIC
      WHEN p_plan_id = 'pro_weekly' THEN 70::NUMERIC
      WHEN p_plan_id = 'expert_weekly' THEN 140::NUMERIC
      WHEN p_plan_id = 'starter_monthly' THEN 180::NUMERIC
      WHEN p_plan_id = 'pro_monthly' THEN 300::NUMERIC
      WHEN p_plan_id = 'expert_monthly' THEN 600::NUMERIC
      ELSE 0::NUMERIC
    END
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_plan_purchase_activation()
RETURNS TRIGGER AS $$
DECLARE
    user_referrer_id UUID;
    commission_val NUMERIC;
    resolved_amount NUMERIC;
    plan_label TEXT;
BEGIN
    IF NEW.status = 'active' THEN
        UPDATE public.profiles
        SET referral_active = true,
            plan_status = 'active'
        WHERE id = NEW.user_id;

        SELECT referrer_id INTO user_referrer_id
        FROM public.referrals
        WHERE referred_id = NEW.user_id;

        IF user_referrer_id IS NOT NULL THEN
            resolved_amount := public.resolve_plan_purchase_amount(NEW.plan_id, NEW.validation_credit_total);
            commission_val := ROUND(COALESCE(resolved_amount, 0) * 0.20, 2);

            plan_label := CASE NEW.plan_id
                WHEN 'starter' THEN 'Diário Básico'
                WHEN 'pro' THEN 'Diário Médio'
                WHEN 'expert' THEN 'Diário Máximo'
                WHEN 'starter_weekly' THEN 'Semanal Básico'
                WHEN 'pro_weekly' THEN 'Semanal Médio'
                WHEN 'expert_weekly' THEN 'Semanal Máximo'
                WHEN 'starter_monthly' THEN 'Mensal Básico'
                WHEN 'pro_monthly' THEN 'Mensal Médio'
                WHEN 'expert_monthly' THEN 'Mensal Máximo'
                ELSE NEW.plan_id
            END;

            IF commission_val > 0 THEN
                INSERT INTO public.commissions (
                    referrer_id,
                    referred_id,
                    plan_id,
                    amount,
                    status
                )
                VALUES (
                    user_referrer_id,
                    NEW.user_id,
                    NEW.plan_id,
                    commission_val,
                    'pending'
                );

                UPDATE public.profiles
                SET current_balance = COALESCE(current_balance, 0) + commission_val
                WHERE id = user_referrer_id;

                INSERT INTO public.transactions (
                    id,
                    user_id,
                    amount,
                    type,
                    description,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (
                    gen_random_uuid(),
                    user_referrer_id,
                    commission_val,
                    'credit',
                    'Comissão de indicação - Plano ' || plan_label,
                    'completed',
                    NOW(),
                    NOW()
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
