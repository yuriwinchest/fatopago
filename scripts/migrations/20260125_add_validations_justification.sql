-- Add justification fields to store "FALSO" evidence.
-- Safe migration: add nullable columns first (no breaking changes).

ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS proof_link TEXT;

-- Optional (recommended later):
-- 1) Backfill/cleanup existing rows if needed
-- 2) Add constraints if you want to enforce justification on FALSE votes
--    (only after you're sure old rows comply)
--
-- ALTER TABLE public.validations
--   ADD CONSTRAINT validations_false_requires_justification
--   CHECK (verdict = true OR (justification IS NOT NULL AND length(btrim(justification)) >= 10));

