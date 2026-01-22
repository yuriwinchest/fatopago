
/*
 * FATOPAGO - REFACTORED DATABASE SCHEMA
 * High Performance & Security (RLS)
 */

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. SECURE PROFILES (Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    city TEXT,
    state TEXT,
    reputation_score INTEGER DEFAULT 0,
    current_balance NUMERIC(10,2) DEFAULT 0.00,
    level TEXT DEFAULT 'Novato',
    affiliate_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_reputation ON public.profiles(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 3. NEWS TASKS (Articles to validate)
CREATE TABLE IF NOT EXISTS public.news_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content JSONB NOT NULL, -- { title, description, source, category, difficulty, reward }
    active BOOLEAN DEFAULT TRUE,
    expiration_date TIMESTAMPTZ,
    true_votes INTEGER DEFAULT 0,
    false_votes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for News (Feed Optimization)
CREATE INDEX IF NOT EXISTS idx_news_tasks_created_at ON public.news_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_tasks_active ON public.news_tasks(active);

-- 4. VALIDATIONS (Voting Records)
CREATE TABLE IF NOT EXISTS public.validations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.news_tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    verdict BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_task_vote UNIQUE(user_id, task_id)
);

-- Indexes for Validations (History & Integrity)
CREATE INDEX IF NOT EXISTS idx_validations_user_history ON public.validations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validations_task_stats ON public.validations(task_id);

-- 5. FINANCIAL LEDGER (Transactions)
CREATE TABLE IF NOT EXISTS public.fp_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal')),
    description TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Finance (Extracts)
CREATE INDEX IF NOT EXISTS idx_fp_transactions_user ON public.fp_transactions(user_id, created_at DESC);

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fp_transactions ENABLE ROW LEVEL SECURITY;

-- Reset Policies to Avoid Duplicates
DROP POLICY IF EXISTS "Public Read Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Self Update Profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public Read News" ON public.news_tasks;
DROP POLICY IF EXISTS "Self Vote" ON public.validations;
DROP POLICY IF EXISTS "Public Read Validations" ON public.validations;
DROP POLICY IF EXISTS "Self Read Transactions" ON public.fp_transactions;

-- New Policies
CREATE POLICY "Public Read Profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Self Update Profiles" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public Read News" ON public.news_tasks FOR SELECT USING (true);

CREATE POLICY "Self Vote" ON public.validations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public Read Validations" ON public.validations FOR SELECT USING (true);

CREATE POLICY "Self Read Transactions" ON public.fp_transactions FOR SELECT USING (auth.uid() = user_id);
