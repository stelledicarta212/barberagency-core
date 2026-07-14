-- =============================================================================
-- ROLLBACK DE MIGRACIÓN: ROL DE BACKEND DE ALTO ENDURECIMIENTO
-- ARCHIVO: 20260713_2032_harden_billing_worker_role_rollback.sql
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.billing_create_checkout_backend(INT, TEXT, TEXT, INT);
DROP ROLE IF EXISTS n8n_billing_worker_role;

COMMIT;
