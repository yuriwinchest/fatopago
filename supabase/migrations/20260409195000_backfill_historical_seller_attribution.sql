WITH payment_backfill (
  pix_payment_id,
  seller_id,
  seller_referral_id,
  seller_source,
  plan_purchase_id
) AS (
  VALUES
    (
      '57df6785-9acd-451d-a68b-f42842d61483'::UUID,
      '5aae0045-e3de-45eb-87eb-99009f6af049'::UUID,
      19::BIGINT,
      'link'::TEXT,
      '516241c9-f404-4449-b0d9-7d02c719d1c5'::UUID
    ),
    (
      'b33cd0fc-7f9a-407c-95ee-c4c4c9eae766'::UUID,
      '395682c9-a4af-45f6-8182-40a6b0b504c2'::UUID,
      37::BIGINT,
      'link'::TEXT,
      NULL::UUID
    ),
    (
      '4ef0cd6f-b1a5-4e7b-89aa-1080c8692fc4'::UUID,
      '395682c9-a4af-45f6-8182-40a6b0b504c2'::UUID,
      28::BIGINT,
      'link'::TEXT,
      'e782c913-d630-4bf1-b47f-2bc6881fcf9e'::UUID
    ),
    (
      'd35bba43-44c2-46a1-a9d0-4d624cf4093c'::UUID,
      '395682c9-a4af-45f6-8182-40a6b0b504c2'::UUID,
      39::BIGINT,
      'link'::TEXT,
      NULL::UUID
    ),
    (
      '1a6291db-8079-4497-a950-eea16f892e18'::UUID,
      '395682c9-a4af-45f6-8182-40a6b0b504c2'::UUID,
      30::BIGINT,
      'link'::TEXT,
      NULL::UUID
    ),
    (
      '1eb5099b-d8a5-487a-bc87-d953df590f4a'::UUID,
      '395682c9-a4af-45f6-8182-40a6b0b504c2'::UUID,
      31::BIGINT,
      'link'::TEXT,
      '3b217d61-e707-4de9-8a38-927958d299a5'::UUID
    ),
    (
      '657d5145-7109-4c15-925c-d4b7561afd13'::UUID,
      '395682c9-a4af-45f6-8182-40a6b0b504c2'::UUID,
      24::BIGINT,
      'link'::TEXT,
      '598e3539-8b30-447b-a224-0e02ac250a9d'::UUID
    )
)
UPDATE public.pix_payments AS px
SET
  seller_id = pb.seller_id,
  seller_referral_id = pb.seller_referral_id,
  seller_source = pb.seller_source,
  updated_at = NOW()
FROM payment_backfill AS pb
WHERE px.id = pb.pix_payment_id
  AND (
    px.seller_id IS DISTINCT FROM pb.seller_id
    OR px.seller_referral_id IS DISTINCT FROM pb.seller_referral_id
    OR COALESCE(px.seller_source, '') IS DISTINCT FROM pb.seller_source
  );

WITH payment_backfill (
  pix_payment_id,
  seller_id,
  seller_referral_id,
  seller_source,
  plan_purchase_id
) AS (
  VALUES
    (
      '57df6785-9acd-451d-a68b-f42842d61483'::UUID,
      '5aae0045-e3de-45eb-87eb-99009f6af049'::UUID,
      19::BIGINT,
      'link'::TEXT,
      '516241c9-f404-4449-b0d9-7d02c719d1c5'::UUID
    ),
    (
      '4ef0cd6f-b1a5-4e7b-89aa-1080c8692fc4'::UUID,
      '395682c9-a4af-45f6-8182-40a6b0b504c2'::UUID,
      28::BIGINT,
      'link'::TEXT,
      'e782c913-d630-4bf1-b47f-2bc6881fcf9e'::UUID
    ),
    (
      '1eb5099b-d8a5-487a-bc87-d953df590f4a'::UUID,
      '395682c9-a4af-45f6-8182-40a6b0b504c2'::UUID,
      31::BIGINT,
      'link'::TEXT,
      '3b217d61-e707-4de9-8a38-927958d299a5'::UUID
    ),
    (
      '657d5145-7109-4c15-925c-d4b7561afd13'::UUID,
      '395682c9-a4af-45f6-8182-40a6b0b504c2'::UUID,
      24::BIGINT,
      'link'::TEXT,
      '598e3539-8b30-447b-a224-0e02ac250a9d'::UUID
    )
)
UPDATE public.plan_purchases AS pp
SET
  seller_id = pb.seller_id,
  seller_referral_id = pb.seller_referral_id,
  updated_at = NOW()
FROM payment_backfill AS pb
WHERE pp.id = pb.plan_purchase_id
  AND (
    pp.seller_id IS DISTINCT FROM pb.seller_id
    OR pp.seller_referral_id IS DISTINCT FROM pb.seller_referral_id
  );

WITH payment_backfill (
  pix_payment_id
) AS (
  VALUES
    ('57df6785-9acd-451d-a68b-f42842d61483'::UUID),
    ('b33cd0fc-7f9a-407c-95ee-c4c4c9eae766'::UUID),
    ('4ef0cd6f-b1a5-4e7b-89aa-1080c8692fc4'::UUID),
    ('d35bba43-44c2-46a1-a9d0-4d624cf4093c'::UUID),
    ('1a6291db-8079-4497-a950-eea16f892e18'::UUID),
    ('1eb5099b-d8a5-487a-bc87-d953df590f4a'::UUID),
    ('657d5145-7109-4c15-925c-d4b7561afd13'::UUID)
)
INSERT INTO public.seller_funnel_events (
  seller_id,
  seller_referral_id,
  referred_user_id,
  affiliate_code,
  event_type,
  source,
  path,
  metadata,
  created_at
)
SELECT
  px.seller_id,
  px.seller_referral_id,
  px.user_id,
  s.seller_code,
  'pix_generated',
  COALESCE(px.seller_source, 'system'),
  '/plans',
  jsonb_build_object(
    'pix_payment_id', px.id,
    'mp_payment_id', px.mp_payment_id,
    'plan_id', px.plan_id,
    'amount', COALESCE(px.amount, 0),
    'status', px.status
  ),
  COALESCE(px.created_at, NOW())
FROM public.pix_payments AS px
JOIN payment_backfill AS pb
  ON pb.pix_payment_id = px.id
JOIN public.sellers AS s
  ON s.id = px.seller_id
WHERE px.seller_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.seller_funnel_events AS sfe
    WHERE sfe.seller_id = px.seller_id
      AND sfe.event_type = 'pix_generated'
      AND sfe.metadata ->> 'pix_payment_id' = px.id::TEXT
  );

WITH payment_backfill (
  pix_payment_id
) AS (
  VALUES
    ('57df6785-9acd-451d-a68b-f42842d61483'::UUID),
    ('4ef0cd6f-b1a5-4e7b-89aa-1080c8692fc4'::UUID),
    ('1eb5099b-d8a5-487a-bc87-d953df590f4a'::UUID),
    ('657d5145-7109-4c15-925c-d4b7561afd13'::UUID)
)
INSERT INTO public.seller_funnel_events (
  seller_id,
  seller_referral_id,
  referred_user_id,
  affiliate_code,
  event_type,
  source,
  path,
  metadata,
  created_at
)
SELECT
  px.seller_id,
  px.seller_referral_id,
  px.user_id,
  s.seller_code,
  'pix_approved',
  COALESCE(px.seller_source, 'system'),
  '/plans',
  jsonb_build_object(
    'pix_payment_id', px.id,
    'mp_payment_id', px.mp_payment_id,
    'plan_id', px.plan_id,
    'amount', COALESCE(px.amount, 0),
    'status', px.status,
    'approved_at', COALESCE(px.plan_activated_at, px.updated_at, px.created_at, NOW())
  ),
  COALESCE(px.plan_activated_at, px.updated_at, px.created_at, NOW())
FROM public.pix_payments AS px
JOIN payment_backfill AS pb
  ON pb.pix_payment_id = px.id
JOIN public.sellers AS s
  ON s.id = px.seller_id
WHERE px.seller_id IS NOT NULL
  AND (
    COALESCE(LOWER(px.status), '') IN ('approved', 'paid', 'completed', 'authorized')
    OR px.plan_activated_at IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.seller_funnel_events AS sfe
    WHERE sfe.seller_id = px.seller_id
      AND sfe.event_type = 'pix_approved'
      AND sfe.metadata ->> 'pix_payment_id' = px.id::TEXT
  );

SELECT public.credit_seller_commission_for_plan_purchase(plan_purchase_id)
FROM (
  VALUES
    ('516241c9-f404-4449-b0d9-7d02c719d1c5'::UUID),
    ('e782c913-d630-4bf1-b47f-2bc6881fcf9e'::UUID),
    ('3b217d61-e707-4de9-8a38-927958d299a5'::UUID),
    ('598e3539-8b30-447b-a224-0e02ac250a9d'::UUID)
) AS approved_plan_purchases(plan_purchase_id);
