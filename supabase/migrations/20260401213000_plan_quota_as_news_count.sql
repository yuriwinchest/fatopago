CREATE OR REPLACE FUNCTION public.get_validation_cost_by_category(p_category TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN 1.00;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_plan_purchase_quota_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_quota NUMERIC(12,2);
  v_quota_int INTEGER;
  v_used INTEGER;
BEGIN
  v_quota := GREATEST(
    COALESCE(public.resolve_plan_purchase_amount(NEW.plan_id, NEW.validation_credit_total), NEW.validation_credit_total, 0),
    0
  );
  v_quota_int := GREATEST(FLOOR(v_quota)::INTEGER, 0);
  v_used := GREATEST(COALESCE(NEW.used_validations, 0), 0);

  NEW.max_validations := v_quota_int;
  NEW.validation_credit_total := v_quota;
  NEW.validation_credit_remaining := GREATEST(v_quota - v_used, 0);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_plan_purchase_quota_before_insert ON public.plan_purchases;
CREATE TRIGGER trg_normalize_plan_purchase_quota_before_insert
BEFORE INSERT ON public.plan_purchases
FOR EACH ROW
EXECUTE FUNCTION public.normalize_plan_purchase_quota_before_insert();

WITH normalized AS (
  SELECT
    pp.id,
    GREATEST(
      COALESCE(public.resolve_plan_purchase_amount(pp.plan_id, pp.validation_credit_total), pp.validation_credit_total, 0),
      0
    )::NUMERIC(12,2) AS quota_total,
    GREATEST(COALESCE(pp.used_validations, 0), 0)::INTEGER AS used_validations_count
  FROM public.plan_purchases pp
)
UPDATE public.plan_purchases pp
SET
  used_validations = n.used_validations_count,
  max_validations = GREATEST(FLOOR(n.quota_total)::INTEGER, n.used_validations_count),
  validation_credit_total = n.quota_total,
  validation_credit_remaining = GREATEST(n.quota_total - n.used_validations_count, 0),
  status = CASE
    WHEN pp.status = 'active' AND GREATEST(n.quota_total - n.used_validations_count, 0) <= 0.009 THEN 'completed'
    ELSE pp.status
  END,
  completed_at = CASE
    WHEN pp.status = 'active' AND GREATEST(n.quota_total - n.used_validations_count, 0) <= 0.009 THEN COALESCE(pp.completed_at, NOW())
    ELSE pp.completed_at
  END,
  updated_at = NOW()
FROM normalized n
WHERE pp.id = n.id
  AND (
    COALESCE(pp.validation_credit_total, -1) <> n.quota_total
    OR COALESCE(pp.validation_credit_remaining, -1) <> GREATEST(n.quota_total - n.used_validations_count, 0)
    OR COALESCE(pp.max_validations, -1) <> GREATEST(FLOOR(n.quota_total)::INTEGER, n.used_validations_count)
    OR COALESCE(pp.used_validations, -1) <> n.used_validations_count
    OR (pp.status = 'active' AND GREATEST(n.quota_total - n.used_validations_count, 0) <= 0.009)
  );

UPDATE public.profiles
SET
  compensatory_credit_balance = CEIL(GREATEST(COALESCE(compensatory_credit_balance, 0), 0))::NUMERIC(12,2),
  updated_at = NOW()
WHERE COALESCE(compensatory_credit_balance, 0) <> CEIL(GREATEST(COALESCE(compensatory_credit_balance, 0), 0));

UPDATE public.news_task_manual_review_votes mv
SET validation_cost = 1.00
FROM public.news_tasks nt
WHERE nt.id = mv.task_id
  AND nt.consensus_status = 'manual_review'
  AND COALESCE(mv.validation_cost, 0) <> 1.00;
