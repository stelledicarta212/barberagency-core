-- =============================================================================
-- ROLLBACK: 20260929_1800_loyalty_universal_provisioning_rollback.sql
-- =============================================================================

BEGIN;

DROP TRIGGER IF EXISTS tr_barberia_loyalty_auto_provision ON public.barberias;
DROP FUNCTION IF EXISTS public.trg_barberia_loyalty_auto_provision();

NOTIFY pgrst, 'reload schema';

COMMIT;
