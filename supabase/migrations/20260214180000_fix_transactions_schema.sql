-- Fix missing columns if previous migration partially failed or table existed
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.pix_payments
ADD COLUMN IF NOT EXISTS plan_activated_at TIMESTAMPTZ;
ALTER TABLE public.pix_payments
ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE public.pix_payments
ADD COLUMN IF NOT EXISTS qr_code_base64 TEXT;
ALTER TABLE public.pix_payments
ADD COLUMN IF NOT EXISTS ticket_url TEXT;
ALTER TABLE public.pix_payments
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.pix_payments
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();