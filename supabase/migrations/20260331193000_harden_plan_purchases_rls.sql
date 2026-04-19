-- Critical hardening: enforce row-level isolation on plan_purchases.
-- Without RLS, authenticated users can read cross-user package data via PostgREST.

ALTER TABLE public.plan_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plan_purchases_select_own ON public.plan_purchases;
DROP POLICY IF EXISTS "Plan Purchases Select Own" ON public.plan_purchases;
DROP POLICY IF EXISTS "Admin Select Plan Purchases" ON public.plan_purchases;

CREATE POLICY plan_purchases_select_own
ON public.plan_purchases
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin Select Plan Purchases"
ON public.plan_purchases
FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email') = 'fatopago@gmail.com');
