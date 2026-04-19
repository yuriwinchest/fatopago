ALTER TABLE public.transactions
ALTER COLUMN "date" DROP NOT NULL;
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
        AND table_name = 'transactions'
        AND column_name = 'category_id'
) THEN
ALTER TABLE public.transactions
ALTER COLUMN category_id DROP NOT NULL;
END IF;
END $$;