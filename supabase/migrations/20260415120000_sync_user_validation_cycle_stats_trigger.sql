-- [2026-04-15] Trigger de sincronia entre public.validations e public.user_validation_cycle_stats
--
-- Motivo: a tabela user_validation_cycle_stats (fonte do ranking vivo via
-- get_live_validation_ranking) era alimentada SOMENTE pelo submit_validation (+1)
-- e pelo backfill inicial. Qualquer DELETE/INSERT direto em public.validations
-- (limpeza, reprocessamento, correcao manual) gerava drift silencioso - o
-- ranking passava a divergir da verdade. Exemplo observado no ciclo #6:
-- Roberson tinha 120 validacoes reais mas aparecia como 60 no ranking.
--
-- Solucao: trigger AFTER INSERT/DELETE/UPDATE em public.validations que
-- reconcilia automaticamente a linha (user_id, cycle_start_at) usando
-- get_weekly_cycle_window.
--
-- SOLID:
--   - SRP: trigger cuida SO da sincronia; submit_validation continua com sua logica propria.
--   - Open/Closed: nao modifica submit_validation. Se ele continuar fazendo +1,
--     o recount abaixo sobrescreve com a contagem REAL (idempotente).

CREATE OR REPLACE FUNCTION public.sync_user_validation_cycle_stats_for_row(
  p_user_id UUID,
  p_created_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_start TIMESTAMPTZ;
  v_cycle_end TIMESTAMPTZ;
  v_count INTEGER;
  v_last TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL OR p_created_at IS NULL THEN
    RETURN;
  END IF;

  SELECT c.cycle_start_at, c.cycle_end_at
    INTO v_cycle_start, v_cycle_end
  FROM public.get_weekly_cycle_window(p_created_at, 0) c;

  IF v_cycle_start IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER, MAX(v.created_at)
    INTO v_count, v_last
  FROM public.validations v
  WHERE v.user_id = p_user_id
    AND v.created_at >= v_cycle_start
    AND v.created_at <  v_cycle_end;

  IF v_count = 0 THEN
    DELETE FROM public.user_validation_cycle_stats
    WHERE user_id = p_user_id
      AND cycle_start_at = v_cycle_start;
    RETURN;
  END IF;

  INSERT INTO public.user_validation_cycle_stats (
    user_id, cycle_start_at, cycle_end_at, validations_count, last_validation_at
  )
  VALUES (p_user_id, v_cycle_start, v_cycle_end, v_count, v_last)
  ON CONFLICT (user_id, cycle_start_at) DO UPDATE
  SET
    cycle_end_at = EXCLUDED.cycle_end_at,
    validations_count = EXCLUDED.validations_count,
    last_validation_at = EXCLUDED.last_validation_at,
    updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_user_validation_cycle_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.sync_user_validation_cycle_stats_for_row(NEW.user_id, NEW.created_at);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.sync_user_validation_cycle_stats_for_row(OLD.user_id, OLD.created_at);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.user_id IS DISTINCT FROM NEW.user_id
       OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
      PERFORM public.sync_user_validation_cycle_stats_for_row(OLD.user_id, OLD.created_at);
      PERFORM public.sync_user_validation_cycle_stats_for_row(NEW.user_id, NEW.created_at);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS validations_sync_cycle_stats ON public.validations;
CREATE TRIGGER validations_sync_cycle_stats
AFTER INSERT OR UPDATE OR DELETE ON public.validations
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_user_validation_cycle_stats();

REVOKE ALL ON FUNCTION public.sync_user_validation_cycle_stats_for_row(UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trg_sync_user_validation_cycle_stats() FROM PUBLIC;
