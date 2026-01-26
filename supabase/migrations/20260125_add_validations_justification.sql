-- Add justification fields to store "FALSO" evidence.
-- Safe migration: add nullable columns first (no breaking changes).

ALTER TABLE public.validations
  ADD COLUMN IF NOT EXISTS justification TEXT,
  ADD COLUMN IF NOT EXISTS proof_link TEXT;

