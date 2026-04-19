-- BACKFILL: Atualiza a coluna last_validation_at com base na validação mais recente para usuários que já validaram
UPDATE public.profiles p
SET last_validation_at = v.last_date
FROM (
    SELECT user_id, MAX(created_at) as last_date
    FROM public.validations
    GROUP BY user_id
) v
WHERE p.id = v.user_id
  AND (p.last_validation_at IS NULL OR p.last_validation_at < v.last_date);

-- CRITÉRIO DE DESEMPATE NO RANKING: Já deve estar implementado na função get_cycle_ranking,
-- mas vamos reforçar que o critério de ordenação deve incluir last_validation_at DESC como desempate.
-- O usuário disse: "O GANHADOR VAI SER QUEM VALIDOU POR ULTIMO OU SEJA 10E30" (quando as quantidades são iguais).
-- Então a order deve ser: validations_count DESC, last_validation_at DESC.
