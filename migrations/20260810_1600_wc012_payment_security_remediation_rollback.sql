-- =============================================================================
-- WC-012 LOCAL REMEDIATION ROLLBACK PLAN
-- ARCHIVO: 20260810_1600_wc012_payment_security_remediation_rollback.sql
-- ESTADO: LOCAL CANDIDATE - NO EJECUTAR EN PRODUCCION SIN REVISION Y AUTORIZACION
-- =============================================================================

-- Rollback operativo seguro, por etapas:
-- 1. Detener entrada de nuevos eventos: desactivar primero los workflows Sandbox
--    receiver, processor y outbox en n8n. No borrar workflows ni ejecuciones.
-- 2. Preservar todos los registros: no TRUNCATE, no DELETE de pagos, eventos,
--    invoices, subscriptions, licencias ni outbox.
-- 3. Revocar credenciales operativas nuevas fuera de Git, sin volver a usar
--    postgres como credencial operativa.
-- 4. Ejecutar los REVOKE por firma exacta antes de intentar DROP ROLE.
-- 5. No usar DROP OWNED ni REASSIGN OWNED sin inventario explícito del impacto.

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

REVOKE EXECUTE ON FUNCTION public.billing_create_checkout_backend(INT, TEXT, TEXT, INT) FROM ba_checkout_app;
REVOKE EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) FROM ba_webhook_worker;
REVOKE EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) FROM ba_webhook_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_claim_batch(TEXT, INT, INT) FROM ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_processed(UUID) FROM ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_failed(UUID, TEXT, TEXT, INT) FROM ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_release_stale_locks(INT) FROM ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_requeue_dead_letter(UUID) FROM ba_outbox_worker;

REVOKE USAGE ON SCHEMA public FROM ba_checkout_app, ba_webhook_worker, ba_outbox_worker;

DO $$
BEGIN
  EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM ba_checkout_app, ba_webhook_worker, ba_outbox_worker', current_database());
END;
$$;

-- Mantener roles existentes sin DROP por defecto. Si una revision independiente
-- aprueba su eliminacion, verificar antes:
-- SELECT * FROM pg_shdepend WHERE refobjid IN (
--   SELECT oid FROM pg_roles WHERE rolname IN ('ba_checkout_app','ba_webhook_worker','ba_outbox_worker')
-- );

COMMIT;
