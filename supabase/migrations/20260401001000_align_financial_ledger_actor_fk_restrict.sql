-- Keep ledger fully immutable: avoid ON DELETE SET NULL side effects on actor_user_id.
-- Any delete on auth.users that is referenced by ledger must be blocked.

ALTER TABLE public.financial_ledger
  DROP CONSTRAINT IF EXISTS financial_ledger_actor_user_id_fkey;

ALTER TABLE public.financial_ledger
  ADD CONSTRAINT financial_ledger_actor_user_id_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES auth.users(id)
  ON DELETE RESTRICT;
