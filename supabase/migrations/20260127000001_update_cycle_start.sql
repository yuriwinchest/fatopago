-- Update existing records to use created_at as cycle_start_at
UPDATE public.news_tasks 
SET cycle_start_at = created_at 
WHERE cycle_start_at > created_at;
