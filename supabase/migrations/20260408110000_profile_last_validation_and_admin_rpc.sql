-- Add last_validation_at to profiles for performance and ranking accuracy
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_validation_at TIMESTAMPTZ;

-- Backfill last_validation_at from existing validations
UPDATE public.profiles p
SET last_validation_at = v.max_created_at
FROM (
  SELECT user_id, MAX(created_at) as max_created_at
  FROM public.validations
  GROUP BY user_id
) v
WHERE p.id = v.user_id;

-- Create function to update last_validation_at on new validations
CREATE OR REPLACE FUNCTION public.update_profile_last_validation_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_validation_at = NEW.created_at
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on validations
DROP TRIGGER IF EXISTS tr_update_profile_last_validation ON public.validations;
CREATE TRIGGER tr_update_profile_last_validation
AFTER INSERT ON public.validations
FOR EACH ROW EXECUTE FUNCTION public.update_profile_last_validation_at();

-- Create RPC for admin to get last validation times efficiently
CREATE OR REPLACE FUNCTION public.get_last_validations_per_user()
RETURNS TABLE (user_id UUID, last_validation_at TIMESTAMPTZ) 
LANGUAGE sql 
SECURITY DEFINER
AS $$
  SELECT id as user_id, last_validation_at
  FROM public.profiles
  WHERE last_validation_at IS NOT NULL;
$$;

-- Ensure ranking function uses the most efficient source of truth if available
-- Though most rankings are cycle-specific, we keep it as is unless global.
