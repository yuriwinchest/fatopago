-- Lock settlement RPC execution scope.
-- Supabase environment may carry broad EXECUTE grants by default, so revoke explicitly.

REVOKE ALL ON FUNCTION public.settle_news_task(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_open_news_tasks(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.settle_news_task(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.settle_open_news_tasks(INTEGER, INTEGER) TO service_role;

