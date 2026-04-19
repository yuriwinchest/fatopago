-- 1. Create Tables
-- Referrals table (Track who invited who)
CREATE TABLE IF NOT EXISTS public.referrals (
    id SERIAL PRIMARY KEY,
    referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(referred_id) -- A user can only be referred once
);
-- Commissions table
CREATE TABLE IF NOT EXISTS public.commissions (
    id SERIAL PRIMARY KEY,
    referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 2. Modify Profiles (users) table
-- We assume public.profiles exists. If not, this might fail, but based on code it exists.
-- We add the columns requested.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS referral_active BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS plan_status VARCHAR(20) DEFAULT 'none',
    -- We use 'affiliate_code' as the column for "The code I entered at signup"
    -- If it already exists, good. If not, add it.
ADD COLUMN IF NOT EXISTS affiliate_code TEXT;
-- 3. Function to Generate Referral Code on Insert
CREATE OR REPLACE FUNCTION public.handle_new_user_referral_setup() RETURNS TRIGGER AS $$
DECLARE found_referrer_id UUID;
BEGIN -- 1. Generate unique referral code (FAT + 6 random chars)
-- Loop to ensure uniqueness (though collision prob is low)
LOOP NEW.referral_code := 'FAT' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE referral_code = NEW.referral_code
) THEN EXIT;
END IF;
END LOOP;
-- 2. Set initial status
NEW.referral_active := false;
NEW.plan_status := 'none';
-- 3. Handle Referral (If user entered an affiliate_code)
IF NEW.affiliate_code IS NOT NULL
AND NEW.affiliate_code != '' THEN -- Find the owner of this code
SELECT id INTO found_referrer_id
FROM public.profiles
WHERE referral_code = NEW.affiliate_code;
IF found_referrer_id IS NOT NULL THEN -- Insert into referrals table
-- We perform this in an AFTER trigger usually, but here we just want to ensure it happens.
-- Since referrals table has separate ID, we can't do it in BEFORE trigger easily without side effects?
-- Actually, side effects in BEFORE triggers are allowed in PG but discouraged if logic is complex.
-- However, to keep it simple, we will do the INSERT into referrals in a separate AFTER trigger 
-- or just do it here if we are sure. 
-- Better approach: Do it in AFTER trigger to ensure profile is created first.
NULL;
-- Placeholder, moved to AFTER trigger
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Trigger for Setup (Before Insert)
DROP TRIGGER IF EXISTS on_profile_created_referral_setup ON public.profiles;
CREATE TRIGGER on_profile_created_referral_setup BEFORE
INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_referral_setup();
-- 4. Function to Process Referral Link (After Insert)
CREATE OR REPLACE FUNCTION public.process_referral_link() RETURNS TRIGGER AS $$
DECLARE found_referrer_id UUID;
BEGIN IF NEW.affiliate_code IS NOT NULL
AND NEW.affiliate_code != '' THEN
SELECT id INTO found_referrer_id
FROM public.profiles
WHERE referral_code = NEW.affiliate_code;
IF found_referrer_id IS NOT NULL
AND found_referrer_id != NEW.id THEN
INSERT INTO public.referrals (referrer_id, referred_id)
VALUES (found_referrer_id, NEW.id) ON CONFLICT (referred_id) DO NOTHING;
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Trigger for Referral Link (After Insert)
DROP TRIGGER IF EXISTS on_profile_created_process_link ON public.profiles;
CREATE TRIGGER on_profile_created_process_link
AFTER
INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.process_referral_link();
-- 5. Function to Activate Code & Commissions on Plan Purchase
CREATE OR REPLACE FUNCTION public.handle_plan_purchase_activation() RETURNS TRIGGER AS $$
DECLARE user_referrer_id UUID;
commission_val NUMERIC;
BEGIN -- Only run if status is active (new purchase)
IF NEW.status = 'active' THEN -- 1. Activate User's Referral Code
UPDATE public.profiles
SET referral_active = true,
    plan_status = 'active'
WHERE id = NEW.user_id;
-- 2. Check for Commission
-- Find who referred this user
SELECT referrer_id INTO user_referrer_id
FROM public.referrals
WHERE referred_id = NEW.user_id;
IF user_referrer_id IS NOT NULL THEN -- Check if Referrer has an ACTIVE plan
IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_referrer_id
        AND plan_status = 'active'
) THEN -- Calculate Commission (Example: 10% or Fixed)
-- Logic: Verify plan type. 
-- Starter: R$29.90 -> Com: R$5.00
-- Pro: R$49.90 -> Com: R$10.00
-- Expert: R$99.90 -> Com: R$20.00
IF NEW.plan_id = 'starter' THEN commission_val := 5.00;
ELSIF NEW.plan_id = 'pro' THEN commission_val := 10.00;
ELSIF NEW.plan_id = 'expert' THEN commission_val := 20.00;
ELSE commission_val := 0;
END IF;
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
-- Optional: Update Referrer Balance? (If balance exists)
UPDATE public.profiles
SET current_balance = COALESCE(current_balance, 0) + commission_val
WHERE id = user_referrer_id;
END IF;
END IF;
END IF;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Trigger on Plan Purchases
DROP TRIGGER IF EXISTS on_plan_purchase_activation ON public.plan_purchases;
CREATE TRIGGER on_plan_purchase_activation
AFTER
INSERT ON public.plan_purchases FOR EACH ROW EXECUTE FUNCTION public.handle_plan_purchase_activation();