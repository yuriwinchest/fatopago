-- Add new columns for enhanced user profile
alter table public.profiles
add column if not exists cpf text,
    add column if not exists birth_date date;
-- Add simple verification/constraint if needed, but keeping it flexible for now.
-- Ideally, CPF should be unique if used for PIX keys later.
-- For now, allow duplicates just in case of formatting issues (better to fix in app logic first).
-- alter table public.profiles add constraint profiles_cpf_unique unique (cpf);
-- Update RLS to allow users to update their own CPF/Birth Date (already covered by existing policies usually).
-- Ensure admin can read these columns (already covered by "Admin Select Profiles" assuming it selects *).