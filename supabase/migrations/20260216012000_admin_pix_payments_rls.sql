-- Admin: allow selecting PIX payments for operational follow-up (pending payments, etc.)
-- Restrict by admin email present in JWT.

ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Select Pix Payments" ON public.pix_payments;
CREATE POLICY "Admin Select Pix Payments"
ON public.pix_payments
FOR SELECT
TO authenticated
USING ((auth.jwt()->>'email') = 'fatopago@gmail.com');

