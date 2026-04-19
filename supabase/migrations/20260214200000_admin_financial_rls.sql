-- Enable RLS on transactions table (if not already enabled)
alter table public.transactions enable row level security;
-- Drop existing policy if any for admin select
drop policy if exists "Admin Select Transactions" on public.transactions;
-- Create policy allowing admin email to select all transactions
create policy "Admin Select Transactions" on public.transactions for
select to authenticated using (
        (auth.jwt()->>'email') = 'fatopago@gmail.com'
    );
-- Also allow admin to see commissions if not already (it seemed to work before, but let's be safe)
alter table public.commissions enable row level security;
drop policy if exists "Admin Select Commissions" on public.commissions;
create policy "Admin Select Commissions" on public.commissions for
select to authenticated using (
        (auth.jwt()->>'email') = 'fatopago@gmail.com'
    );
-- Allow admin to see referrals
alter table public.referrals enable row level security;
drop policy if exists "Admin Select Referrals" on public.referrals;
create policy "Admin Select Referrals" on public.referrals for
select to authenticated using (
        (auth.jwt()->>'email') = 'fatopago@gmail.com'
    );