-- ==============================================================================
-- MIGRATION ROLLBACK: 20261006_1600_ba_soft_delete_barberia_rollback.sql
-- DESCRIPTION: Drops public.ba_soft_delete_barberia function.
-- ==============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_subscriptions_entitlement_guard ON public.subscriptions;
DROP TRIGGER IF EXISTS trg_business_licenses_entitlement_guard ON public.business_licenses;
DROP FUNCTION IF EXISTS public.fn_enforce_barberia_entitlement_lock_and_guard();

DROP FUNCTION IF EXISTS public.ba_restore_soft_deleted_barberia(integer, integer);
DROP FUNCTION IF EXISTS public.ba_soft_delete_barberia(integer, integer);
DROP TABLE IF EXISTS public.barberia_soft_delete_audit;

NOTIFY pgrst, 'reload schema';

COMMIT;
