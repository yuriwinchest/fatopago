-- Add cycle tracking to news_tasks
-- This allows us to track 24h voting cycles

ALTER TABLE public.news_tasks
  ADD COLUMN IF NOT EXISTS cycle_start_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS cycle_number INTEGER DEFAULT 1;

-- Index for efficient cycle queries
CREATE INDEX IF NOT EXISTS idx_news_tasks_cycle 
  ON public.news_tasks(cycle_start_at DESC, cycle_number DESC);

-- Comment explaining the cycle system
COMMENT ON COLUMN public.news_tasks.cycle_start_at IS 'Timestamp when the 24h voting cycle started for this news';
COMMENT ON COLUMN public.news_tasks.cycle_number IS 'Sequential cycle number for this news item';
