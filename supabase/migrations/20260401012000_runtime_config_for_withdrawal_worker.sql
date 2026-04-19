-- Runtime config storage for scheduled withdrawal worker.
-- Avoids hardcoding secrets in migrations and does not rely on ALTER DATABASE ... SET permissions.

CREATE TABLE IF NOT EXISTS public.system_runtime_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.system_runtime_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS system_runtime_config_admin_select ON public.system_runtime_config;
CREATE POLICY system_runtime_config_admin_select
ON public.system_runtime_config
FOR SELECT
TO authenticated
USING (public.is_admin_user(auth.uid()));

REVOKE ALL ON TABLE public.system_runtime_config FROM PUBLIC;
REVOKE ALL ON TABLE public.system_runtime_config FROM anon;
REVOKE ALL ON TABLE public.system_runtime_config FROM authenticated;

CREATE OR REPLACE FUNCTION public.set_runtime_config(
  p_key TEXT,
  p_value TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := lower(btrim(COALESCE(p_key, '')));
  v_value TEXT := btrim(COALESCE(p_value, ''));
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND NOT public.is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Acesso negado');
  END IF;

  IF v_key = '' THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Chave inválida');
  END IF;

  INSERT INTO public.system_runtime_config (key, value, updated_at, updated_by)
  VALUES (v_key, v_value, NOW(), auth.uid())
  ON CONFLICT (key)
  DO UPDATE SET
    value = EXCLUDED.value,
    updated_at = NOW(),
    updated_by = EXCLUDED.updated_by;

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

REVOKE ALL ON FUNCTION public.set_runtime_config(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_runtime_config(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_withdrawal_worker_run()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT := NULL;
  v_base_url TEXT := NULL;
  v_limit_raw TEXT := NULL;
  v_limit INTEGER := 20;
  v_request_id BIGINT;
BEGIN
  IF NOT (
    COALESCE(auth.role(), '') = 'service_role'
    OR public.is_admin_user(auth.uid())
    OR current_user = 'postgres'
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT value
  INTO v_token
  FROM public.system_runtime_config
  WHERE key = 'withdrawal_worker_token'
  LIMIT 1;

  SELECT value
  INTO v_base_url
  FROM public.system_runtime_config
  WHERE key = 'supabase_functions_base_url'
  LIMIT 1;

  SELECT value
  INTO v_limit_raw
  FROM public.system_runtime_config
  WHERE key = 'withdrawal_worker_limit'
  LIMIT 1;

  -- Backward-compatible fallback
  v_token := COALESCE(v_token, NULLIF(current_setting('app.settings.withdrawal_worker_token', true), ''));
  v_base_url := COALESCE(v_base_url, NULLIF(current_setting('app.settings.supabase_functions_base_url', true), ''));
  v_limit_raw := COALESCE(v_limit_raw, NULLIF(current_setting('app.settings.withdrawal_worker_limit', true), ''));

  IF v_base_url IS NULL THEN
    RAISE EXCEPTION 'Configuração ausente: supabase_functions_base_url';
  END IF;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Configuração ausente: withdrawal_worker_token';
  END IF;

  BEGIN
    IF v_limit_raw IS NOT NULL THEN
      v_limit := LEAST(GREATEST(v_limit_raw::INTEGER, 1), 100);
    END IF;
  EXCEPTION
    WHEN others THEN
      v_limit := 20;
  END;

  SELECT net.http_post(
    url := v_base_url || '/process-pending-withdrawals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-token', v_token
    ),
    body := jsonb_build_object('limit', v_limit)
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_withdrawal_worker_run() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_withdrawal_worker_run() TO service_role;
