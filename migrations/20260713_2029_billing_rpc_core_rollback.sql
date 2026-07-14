-- =============================================================================
-- ROLLBACK DE RPC TRANSACCIONALES CORE DE PAGOS
-- ARCHIVO: 20260713_2029_billing_rpc_core_rollback.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

DROP FUNCTION IF EXISTS public.billing_create_checkout(INT, INT);
DROP FUNCTION IF EXISTS public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT);

COMMIT;
