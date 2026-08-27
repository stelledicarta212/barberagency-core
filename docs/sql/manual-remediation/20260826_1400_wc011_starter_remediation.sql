-- MIGRATION: 20260826_1400_wc011_starter_remediation.sql
-- DESCRIPTION: Safely and idempotently provision Starter plan subscriptions for active tenants without any active subscriptions.
-- REVERSIBLE: YES
-- SAFE_FOR_MUTATING_TESTS: YES

/*
===============================================================================
ROLLBACK INSTRUCTIONS:
-------------------------------------------------------------------------------
DELETE FROM public.subscriptions
WHERE provider = 'system'
  AND provider_ref = 'onboarding_starter';
===============================================================================
*/

BEGIN;

-- Insert Starter plan subscriptions (plan_id = 1) for active, non-deleted barberias
-- that do not currently have any active or trialing subscription.
INSERT INTO public.subscriptions (
  barberia_id,
  plan_id,
  status,
  estado,
  period_start,
  period_end,
  provider,
  provider_ref
)
SELECT
  b.id,
  1 as plan_id,
  'active' as status,
  'activa' as estado,
  now() as period_start,
  now() + interval '30 days' as period_end,
  'system' as provider,
  'onboarding_starter' as provider_ref
FROM public.barberias b
WHERE b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.barberia_id = b.id
      AND (s.status IN ('active', 'trialing') OR s.estado = 'activa')
      AND (s.period_end IS NULL OR s.period_end > now())
  );

COMMIT;
