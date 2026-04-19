-- Permitir Admin ver todos os perfis
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'profiles'
        AND policyname = 'Admins can view all profiles'
) THEN CREATE POLICY "Admins can view all profiles" ON public.profiles FOR
SELECT TO authenticated USING (
        (auth.jwt()->>'email') = 'fatopago@gmail.com'
    );
END IF;
END $$;
-- Permitir Admin deletar perfis
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
        AND tablename = 'profiles'
        AND policyname = 'Admins can delete any profile'
) THEN CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE TO authenticated USING (
    (auth.jwt()->>'email') = 'fatopago@gmail.com'
);
END IF;
END $$;