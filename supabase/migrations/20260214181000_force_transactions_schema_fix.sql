ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS amount NUMERIC CHECK (amount >= 0);
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('credit', 'debit'));
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'failed'));
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();