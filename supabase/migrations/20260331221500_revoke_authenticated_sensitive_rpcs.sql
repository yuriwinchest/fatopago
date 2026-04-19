-- Explicitly revoke execute from authenticated/anon on sensitive payment RPCs.
-- Previous grants may persist across CREATE OR REPLACE FUNCTION.

REVOKE EXECUTE ON FUNCTION public.expire_stale_pix_payments(INTEGER) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_pix_payment(TEXT, UUID) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_pix_payment_reversal(TEXT, TEXT, TEXT) FROM authenticated, anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.expire_stale_pix_payments(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_pix_payment(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_pix_payment_reversal(TEXT, TEXT, TEXT) TO service_role;
