-- Remove o ciclo de teste iniciado em 2026-03-29 15:00:00 UTC
-- do ranking publico/historico de vencedores.
-- Sem isso, outro usuario do mesmo ciclo subiria como vencedor ao remover
-- apenas a Brenda.

DELETE FROM public.cycle_winner_followups
WHERE cycle_start_at = TIMESTAMPTZ '2026-03-29 15:00:00+00';

DELETE FROM public.user_validation_cycle_stats
WHERE cycle_start_at = TIMESTAMPTZ '2026-03-29 15:00:00+00';
