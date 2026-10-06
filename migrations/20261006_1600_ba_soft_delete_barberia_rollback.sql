-- ==============================================================================
-- MIGRATION ROLLBACK: 20261006_1600_ba_soft_delete_barberia_rollback.sql
-- DESCRIPTION: Drops public.ba_soft_delete_barberia function.
-- ==============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.ba_soft_delete_barberia(integer, integer);

NOTIFY pgrst, 'reload schema';

COMMIT;
