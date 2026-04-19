CREATE OR REPLACE FUNCTION public.resolve_plan_purchase_amount(
  p_plan_id TEXT,
  p_validation_credit_total NUMERIC DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    p_validation_credit_total,
    CASE
      WHEN p_plan_id = 'starter' THEN 6::NUMERIC
      WHEN p_plan_id = 'pro' THEN 10::NUMERIC
      WHEN p_plan_id = 'expert' THEN 20::NUMERIC
      WHEN p_plan_id = 'starter_monthly' THEN 24::NUMERIC
      WHEN p_plan_id = 'pro_monthly' THEN 40::NUMERIC
      WHEN p_plan_id = 'expert_monthly' THEN 80::NUMERIC
      ELSE 0::NUMERIC
    END
  );
$$;
