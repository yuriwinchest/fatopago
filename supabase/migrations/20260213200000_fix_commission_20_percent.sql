-- Migration: Corrigir comissao de indicacao para 20% real do valor do plano
-- Antes: valores fixos (starter=R$5, pro=R$10, expert=R$20)
-- Depois: 20% real (starter=R$1.20, pro=R$2.00, expert=R$4.00)
-- Tambem remove restricao de que referrer precisa ter plan_status='active'

CREATE OR REPLACE FUNCTION public.handle_plan_purchase_activation()
RETURNS TRIGGER AS $$
DECLARE
    user_referrer_id UUID;
    commission_val NUMERIC;
BEGIN
    -- Only run if status is active (new purchase)
    IF NEW.status = 'active' THEN
        -- 1. Activate User's Referral Code
        UPDATE public.profiles
        SET referral_active = true,
            plan_status = 'active'
        WHERE id = NEW.user_id;

        -- 2. Check for Commission
        -- Find who referred this user
        SELECT referrer_id INTO user_referrer_id
        FROM public.referrals
        WHERE referred_id = NEW.user_id;

        IF user_referrer_id IS NOT NULL THEN
            -- Calculate Commission: 20% of plan price
            -- starter: R$6.00 * 20% = R$1.20
            -- pro:     R$10.00 * 20% = R$2.00
            -- expert:  R$20.00 * 20% = R$4.00
            IF NEW.plan_id = 'starter' THEN
                commission_val := 1.20;
            ELSIF NEW.plan_id = 'pro' THEN
                commission_val := 2.00;
            ELSIF NEW.plan_id = 'expert' THEN
                commission_val := 4.00;
            ELSE
                commission_val := 0;
            END IF;

            IF commission_val > 0 THEN
                -- Insert commission record
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

                -- Credit referrer's balance immediately
                UPDATE public.profiles
                SET current_balance = COALESCE(current_balance, 0) + commission_val
                WHERE id = user_referrer_id;

                -- Also record as a transaction for the referrer
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
                    'Comissao de indicacao - Plano ' ||
                        CASE NEW.plan_id
                            WHEN 'starter' THEN 'Basico'
                            WHEN 'pro' THEN 'Medio'
                            WHEN 'expert' THEN 'Maximo'
                            ELSE NEW.plan_id
                        END,
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

-- Enable RLS on referrals and commissions tables (if not already)
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for referrals: users can see their own referrals (as referrer)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'referrals' AND policyname = 'Users can view own referrals'
    ) THEN
        CREATE POLICY "Users can view own referrals"
        ON public.referrals FOR SELECT
        USING (auth.uid() = referrer_id);
    END IF;
END
$$;

-- RLS policies for commissions: users can see their own commissions (as referrer)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'commissions' AND policyname = 'Users can view own commissions'
    ) THEN
        CREATE POLICY "Users can view own commissions"
        ON public.commissions FOR SELECT
        USING (auth.uid() = referrer_id);
    END IF;
END
$$;
