-- Keep financial_ledger append-only for manual mutations,
-- but allow FK cascade cleanup when auth.users is being deleted.

CREATE OR REPLACE FUNCTION public.prevent_financial_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Allow DELETE only when parent user row is already gone in this transaction,
    -- which is the expected path for ON DELETE CASCADE from auth.users.
    IF NOT EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = OLD.user_id
    ) THEN
      RETURN OLD;
    END IF;
  END IF;

  RAISE EXCEPTION 'financial_ledger é append-only e não permite %', TG_OP;
END;
$$;

