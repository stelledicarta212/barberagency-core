-- =============================================================================
-- WC-006 RUNTIME ROLLBACK PLAN
-- ARCHIVO: 20260810_1700_wc006_runtime_license_transition_rollback.sql
-- ESTADO: LOCAL CANDIDATE - NO EJECUTAR EN PRODUCCION SIN REVISION Y AUTORIZACION
-- =============================================================================

-- Rollback operativo seguro:
-- 1. Detener primero la entrada de nuevos webhooks Sandbox.
-- 2. No borrar licencias, eventos, pagos, invoices ni subscriptions ya creados.
-- 3. Retirar solo el mecanismo runtime WC-006 agregado por esta migracion.

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

DROP TRIGGER IF EXISTS trg_wc006_apply_license_transition_on_paid_invoice
  ON public.billing_invoices;

REVOKE EXECUTE ON FUNCTION public.wc006_apply_license_transition(UUID)
  FROM ba_webhook_worker;

DROP FUNCTION IF EXISTS public.wc006_apply_license_transition_from_invoice_trigger();
DROP FUNCTION IF EXISTS public.wc006_apply_license_transition(UUID);

COMMIT;
