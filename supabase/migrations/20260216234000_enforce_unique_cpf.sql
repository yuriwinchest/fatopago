-- Normalize stored CPF values to digits only (best effort).
UPDATE public.profiles
SET cpf = NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '')
WHERE cpf IS NOT NULL;

-- Public helper for signup flow to check if CPF already exists.
-- SECURITY DEFINER allows execution even with RLS.
CREATE OR REPLACE FUNCTION public.is_cpf_registered(cpf_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := NULLIF(regexp_replace(COALESCE(cpf_input, ''), '\D', '', 'g'), '');

  IF normalized IS NULL OR length(normalized) <> 11 THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE NULLIF(regexp_replace(COALESCE(p.cpf, ''), '\D', '', 'g'), '') = normalized
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_cpf_registered(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cpf_registered(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.is_cpf_registered(TEXT) TO authenticated;

-- Hard guarantee: one CPF (digits) cannot be used by multiple profiles.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique_digits_idx
ON public.profiles ((NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '')))
WHERE NULLIF(regexp_replace(COALESCE(cpf, ''), '\D', '', 'g'), '') IS NOT NULL;
