DROP FUNCTION IF EXISTS public.list_active_sellers_for_contact();

CREATE OR REPLACE FUNCTION public.list_active_sellers_for_contact()
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.avatar_url
  FROM public.sellers s
  WHERE s.is_active = TRUE
  ORDER BY s.name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_active_sellers_for_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_active_sellers_for_contact() TO authenticated;
