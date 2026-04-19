-- =============================================================================
-- Limpeza automática de notícias antigas a cada 15 dias
-- Mantém apenas: ciclo ATUAL + ciclo ANTERIOR
-- Notícias admin ainda abertas (consensus_status = 'open') são protegidas.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_news_tasks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_cycle_start TIMESTAMPTZ;
  v_previous_cycle_start TIMESTAMPTZ;
  v_cutoff TIMESTAMPTZ;
  v_deleted_validations BIGINT := 0;
  v_deleted_tasks BIGINT := 0;
  v_protected_open BIGINT := 0;
BEGIN
  -- Obter início do ciclo atual e do anterior
  SELECT c.cycle_start_at INTO v_current_cycle_start
  FROM public.get_weekly_cycle_window(NOW(), 0) c;

  SELECT c.cycle_start_at INTO v_previous_cycle_start
  FROM public.get_weekly_cycle_window(NOW(), 1) c;

  -- O corte é tudo ANTES do início do ciclo anterior
  v_cutoff := v_previous_cycle_start;

  IF v_cutoff IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'skipped',
      'reason', 'Não foi possível determinar a janela de ciclos.'
    );
  END IF;

  -- Contar notícias admin abertas que seriam afetadas (para proteção)
  SELECT COUNT(*) INTO v_protected_open
  FROM public.news_tasks
  WHERE cycle_start_at < v_cutoff
    AND is_admin_post = TRUE
    AND COALESCE(consensus_status, 'open') = 'open'
    AND COALESCE(consensus_reached, FALSE) = FALSE;

  -- 1) Deletar validações de tarefas antigas (exceto admin abertas)
  WITH old_tasks AS (
    SELECT id
    FROM public.news_tasks
    WHERE cycle_start_at < v_cutoff
      AND NOT (
        is_admin_post = TRUE
        AND COALESCE(consensus_status, 'open') = 'open'
        AND COALESCE(consensus_reached, FALSE) = FALSE
      )
  )
  DELETE FROM public.validations v
  USING old_tasks ot
  WHERE v.task_id = ot.id;

  GET DIAGNOSTICS v_deleted_validations = ROW_COUNT;

  -- 2) Deletar as notícias antigas
  --    (news_task_manual_review_votes tem ON DELETE CASCADE, deleta junto)
  WITH deleted AS (
    DELETE FROM public.news_tasks
    WHERE cycle_start_at < v_cutoff
      AND NOT (
        is_admin_post = TRUE
        AND COALESCE(consensus_status, 'open') = 'open'
        AND COALESCE(consensus_reached, FALSE) = FALSE
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_tasks FROM deleted;

  RETURN jsonb_build_object(
    'status', 'completed',
    'cutoff', v_cutoff,
    'current_cycle_start', v_current_cycle_start,
    'previous_cycle_start', v_previous_cycle_start,
    'deleted_tasks', v_deleted_tasks,
    'deleted_validations', v_deleted_validations,
    'protected_open_admin_tasks', v_protected_open
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_old_news_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_news_tasks() TO service_role;

-- =============================================================================
-- Agendar via pg_cron: executar a cada 15 dias, às 04:00 UTC (01:00 BRT)
-- Cron: "0 4 1,16 * *" = dia 1 e dia 16 de cada mês
-- =============================================================================
SELECT cron.unschedule('cleanup_old_news_tasks')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup_old_news_tasks'
);

SELECT cron.schedule(
  'cleanup_old_news_tasks',
  '0 4 1,16 * *',
  $$SELECT public.cleanup_old_news_tasks()$$
);
