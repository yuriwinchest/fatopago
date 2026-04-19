DROP POLICY IF EXISTS "Users can insert own validations" ON public.validations;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.reputation_score := 0;
    NEW.current_balance := 0;
    NEW.referral_code := NULL;
    NEW.referral_active := FALSE;
    NEW.referred_by := NULL;
    NEW.plan_status := 'none';
    NEW.is_active := TRUE;
    RETURN NEW;
  END IF;

  IF NEW.current_balance IS DISTINCT FROM OLD.current_balance THEN
    RAISE EXCEPTION 'Atualização direta de saldo não é permitida';
  END IF;

  IF NEW.reputation_score IS DISTINCT FROM OLD.reputation_score THEN
    RAISE EXCEPTION 'Atualização direta de reputação não é permitida';
  END IF;

  IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
    RAISE EXCEPTION 'Atualização direta de código de indicação não é permitida';
  END IF;

  IF NEW.referral_active IS DISTINCT FROM OLD.referral_active THEN
    RAISE EXCEPTION 'Atualização direta do status de indicação não é permitida';
  END IF;

  IF NEW.referred_by IS DISTINCT FROM OLD.referred_by THEN
    RAISE EXCEPTION 'Atualização direta do vínculo de indicação não é permitida';
  END IF;

  IF NEW.plan_status IS DISTINCT FROM OLD.plan_status THEN
    RAISE EXCEPTION 'Atualização direta do status do plano não é permitida';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Atualização direta do status da conta não é permitida';
  END IF;

  IF NEW.affiliate_code IS DISTINCT FROM OLD.affiliate_code THEN
    RAISE EXCEPTION 'Atualização direta do vínculo comercial não é permitida';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;

CREATE TRIGGER trg_protect_profile_sensitive_fields
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_fields();
