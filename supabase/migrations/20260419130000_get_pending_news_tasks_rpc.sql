-- Função RPC que substitui o padrão "id=not.in.(uuid1,uuid2,...)" do frontend.
-- Motivo: conforme o usuário valida mais notícias, a URL cresce e o response
-- header do PostgREST estoura o buffer do nginx (502 Bad Gateway).
--
-- Esta função faz o anti-join server-side, então o frontend só precisa passar:
--   - p_category (string): categoria ou 'Todas'
--   - p_plan_purchase_id (uuid, opcional): id do plano ativo do usuário (se houver)
--   - p_cycle_start_at (timestamptz, opcional): início do ciclo (fallback sem plano)
--   - p_limit, p_offset: paginação
--
-- Regra de exclusão (espelha src/hooks/useValidationHub.ts:fetchValidatedTaskIds):
--   - COM plano ativo: exclui validações do plano atual (permite revalidar
--     notícias de pacotes anteriores).
--   - SEM plano (só crédito compensatório): exclui validações feitas a partir
--     do cycle_start_at atual.
--   - Se nenhum dos dois for informado, não exclui nada (comportamento seguro).

CREATE OR REPLACE FUNCTION public.get_pending_news_tasks(
    p_category text DEFAULT 'Todas',
    p_plan_purchase_id uuid DEFAULT NULL,
    p_cycle_start_at timestamptz DEFAULT NULL,
    p_limit int DEFAULT 20,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    created_at timestamptz,
    title text,
    description text,
    category text,
    source text,
    difficulty text,
    image_url text,
    link text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_limit int := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
    v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        nt.id,
        nt.created_at,
        (nt.content->>'title')::text          AS title,
        (nt.content->>'description')::text    AS description,
        (nt.content->>'category')::text       AS category,
        (nt.content->>'source')::text         AS source,
        (nt.content->>'difficulty')::text     AS difficulty,
        (nt.content->>'image_url')::text      AS image_url,
        (nt.content->>'link')::text           AS link
    FROM public.news_tasks nt
    WHERE nt.is_admin_post = true
      AND nt.consensus_reached = false
      AND nt.consensus_status = 'open'
      AND (p_category = 'Todas' OR (nt.content->>'category') = p_category)
      AND NOT EXISTS (
          SELECT 1
          FROM public.validations v
          WHERE v.task_id = nt.id
            AND v.user_id = v_user_id
            AND (
                (p_plan_purchase_id IS NOT NULL AND v.plan_purchase_id = p_plan_purchase_id)
                OR
                (p_plan_purchase_id IS NULL
                 AND p_cycle_start_at IS NOT NULL
                 AND v.created_at >= p_cycle_start_at)
            )
      )
    ORDER BY nt.admin_priority ASC NULLS LAST, nt.created_at DESC
    LIMIT v_limit
    OFFSET v_offset;
END;
$$;

-- Permissões: qualquer user autenticado pode chamar. A própria função filtra
-- por auth.uid() internamente - impossível um user ver lista de outro.
REVOKE ALL ON FUNCTION public.get_pending_news_tasks(text, uuid, timestamptz, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_news_tasks(text, uuid, timestamptz, int, int) TO authenticated;

-- Índice defensivo: o WHERE interno usa (v.task_id, v.user_id). Se já existir
-- algum índice cobrindo, este é NO-OP via IF NOT EXISTS.
CREATE INDEX IF NOT EXISTS validations_task_id_user_id_idx
    ON public.validations (task_id, user_id);

COMMENT ON FUNCTION public.get_pending_news_tasks(text, uuid, timestamptz, int, int) IS
    'Retorna notícias pendentes de validação para auth.uid() aplicando filtros de ciclo/plano. Criada em 2026-04-19 para substituir id=not.in.(lista gigante) que causava 502 Bad Gateway.';
