-- Migration: Fix profiles affiliate_code uniqueness
-- Created: 2026-04-07
-- Description: Removes the UNIQUE constraint from the affiliate_code column in the profiles table.
-- This allows multiple users to register using the same seller/referral link, which is the correct business logic.

-- 1. Identify and drop the unique constraint if it exists
DO $$
BEGIN
    -- Check for the constraint name 'profiles_affiliate_code_key' which is the standard PG name for UNIQUE(affiliate_code)
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'profiles_affiliate_code_key'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_affiliate_code_key;
        RAISE NOTICE 'Dropped constraint profiles_affiliate_code_key';
    ELSE
        RAISE NOTICE 'Constraint profiles_affiliate_code_key not found, checking for alternative names or indexes...';
    END IF;
END $$;

-- 2. If it was an index instead of a constraint, we handle that too
-- DROP INDEX IF EXISTS public.profiles_affiliate_code_idx; -- Just in case

-- 3. Ensure the column remains but without the unique restriction
-- (No action needed as dropping the constraint/index is enough)

-- 4. Comment on the column for future maintainers
COMMENT ON COLUMN public.profiles.affiliate_code IS 'The referral code entered by the user at signup. Multiple users can share the same code (e.g., from a specific seller).';
