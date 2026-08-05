-- =============================================================================
-- MIGRACIÓN DE PERMISOS FÍSICOS (GRANTS Y REVOKES V2)
-- ARCHIVO: 20260713_2028_billing_roles_and_grants.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- 1. Revocar todos los privilegios por defecto a PUBLIC sobre las nuevas tablas
REVOKE ALL ON public.plan_prices FROM PUBLIC;
REVOKE ALL ON public.billing_customers FROM PUBLIC;
REVOKE ALL ON public.billing_checkouts FROM PUBLIC;
REVOKE ALL ON public.billing_invoices FROM PUBLIC;
REVOKE ALL ON public.payment_attempts FROM PUBLIC;
REVOKE ALL ON public.payment_transactions FROM PUBLIC;
REVOKE ALL ON public.payment_webhook_events FROM PUBLIC;
REVOKE ALL ON public.idempotency_records FROM PUBLIC;
REVOKE ALL ON public.billing_audit_logs FROM PUBLIC;
REVOKE ALL ON public.subscription_events FROM PUBLIC;

-- Revocar todos los privilegios a PUBLIC sobre las funciones RPC stubs
REVOKE EXECUTE ON FUNCTION public.billing_create_checkout(INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;

-- =============================================================================
-- 2. GRANTS A LOS ROLES REALES EXISTENTES (PostgREST Integration)
-- =============================================================================

-- A) Rol: anon (Público no autenticado - Solo lectura del catálogo de precios)
GRANT SELECT ON public.planes TO anon;
GRANT SELECT ON public.plan_prices TO anon;

-- B) Rol: authenticated (Frontend del panel - Lectura de sus propios datos controlada por RLS)
GRANT SELECT ON public.planes TO authenticated;
GRANT SELECT ON public.plan_prices TO authenticated;
GRANT SELECT ON public.billing_customers TO authenticated;
GRANT SELECT ON public.billing_checkouts TO authenticated;
GRANT SELECT ON public.billing_invoices TO authenticated;
GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.subscription_events TO authenticated;

-- Permitir al usuario autenticado iniciar intenciones de checkout mediante el RPC
GRANT EXECUTE ON FUNCTION public.billing_create_checkout(INT, INT) TO authenticated;

-- =============================================================================
-- 3. LOGS, WEBHOOKS Y PROCESAMIENTO ASÍNCRONO (Backend Integration)
-- =============================================================================
-- El backend (workflows de n8n) se conecta a PostgreSQL utilizando las credenciales del
-- superusuario 'postgres' (rol propietario de la base de datos).
-- El rol 'postgres' posee la bandera 'rolbypassrls = true' y tiene privilegios completos
-- por defecto. Por lo tanto, no se requieren grants adicionales para la ejecución del backend.
-- Esto aísla por completo las tablas 'payment_webhook_events', 'idempotency_records' y
-- 'billing_audit_logs' del acceso API del frontend (PostgREST), garantizando fail-closed.

COMMIT;
