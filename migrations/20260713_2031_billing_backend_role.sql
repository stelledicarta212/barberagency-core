-- =============================================================================
-- MIGRACIÓN CORRECTIVA: CREACIÓN DE ROL DE BACKEND DE BAJO PRIVILEGIO (N8N WORKER)
-- ARCHIVO: 20260713_2031_billing_backend_role.sql
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- 1. Crear el rol de ejecución para el worker de n8n (no superusuario, no bypassrls)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n_billing_worker') THEN
    CREATE ROLE n8n_billing_worker WITH LOGIN PASSWORD 'n8n_billing_worker_placeholder_pwd';
  END IF;
END
$$;

-- Asegurar que el rol no posea privilegios de superusuario ni bypassrls
ALTER ROLE n8n_billing_worker NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

-- 2. Conceder permisos de pertenencia para permitir impersonación controlada
-- Esto permite a n8n ejecutar 'SET ROLE authenticated' de forma segura.
GRANT authenticated TO n8n_billing_worker;

-- 3. Conceder privilegios mínimos sobre tablas del core para reconciliación y webhook
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_prices TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_customers TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_checkouts TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_invoices TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_attempts TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_webhook_events TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_audit_logs TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_events TO n8n_billing_worker;
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO n8n_billing_worker;
GRANT SELECT ON public.barberias TO n8n_billing_worker;
GRANT SELECT ON public.planes TO n8n_billing_worker;

-- 4. Conceder privilegios de ejecución de funciones RPC
GRANT EXECUTE ON FUNCTION public.billing_create_checkout(INT, INT) TO n8n_billing_worker;
GRANT EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) TO n8n_billing_worker;
GRANT EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO n8n_billing_worker;

-- 5. Conceder privilegios sobre secuencias (si aplica)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO n8n_billing_worker;

COMMIT;
