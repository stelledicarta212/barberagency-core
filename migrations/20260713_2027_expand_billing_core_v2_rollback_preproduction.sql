-- =============================================================================
-- ROLLBACK PRE-PRODUCCIÓN DE LA MIGRACIÓN CORE V2 (SÓLO TABLAS VACÍAS)
-- ARCHIVO: 20260713_2027_expand_billing_core_v2_rollback_preproduction.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- 1. Control de Seguridad: Abortar si existen registros en las tablas financieras
DO $body$
DECLARE
  v_count_invoices INT := 0;
  v_count_transactions INT := 0;
  v_count_attempts INT := 0;
  v_count_webhooks INT := 0;
  v_count_customers INT := 0;
  v_count_checkouts INT := 0;
  v_count_prices INT := 0;
  v_count_audit INT := 0;
BEGIN
  -- Verificar de forma segura si las tablas existen antes de contar
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'billing_invoices') THEN
    SELECT COUNT(*) INTO v_count_invoices FROM public.billing_invoices;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_transactions') THEN
    SELECT COUNT(*) INTO v_count_transactions FROM public.payment_transactions;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_attempts') THEN
    SELECT COUNT(*) INTO v_count_attempts FROM public.payment_attempts;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'payment_webhook_events') THEN
    SELECT COUNT(*) INTO v_count_webhooks FROM public.payment_webhook_events;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'billing_customers') THEN
    SELECT COUNT(*) INTO v_count_customers FROM public.billing_customers;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'billing_checkouts') THEN
    SELECT COUNT(*) INTO v_count_checkouts FROM public.billing_checkouts;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'plan_prices') THEN
    -- Excluir el catálogo semilla
    SELECT COUNT(*) INTO v_count_prices FROM public.plan_prices;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'billing_audit_logs') THEN
    SELECT COUNT(*) INTO v_count_audit FROM public.billing_audit_logs;
  END IF;

  -- Evaluar si existe algún dato transaccional real registrado
  IF (v_count_invoices > 0 OR v_count_transactions > 0 OR v_count_attempts > 0 OR 
      v_count_webhooks > 0 OR v_count_customers > 0 OR v_count_checkouts > 0 OR 
      v_count_prices > 4 OR v_count_audit > 0) THEN
    RAISE EXCEPTION 'MUTATION BLOCKED: Se aborta rollback de preproducción. Se detectaron datos financieros o de auditoría reales en las tablas de facturación. Use el plan de contingencia de rollback post-producción para desactivar flujos de forma segura sin borrar datos.';
  END IF;
END $body$;

-- 2. Eliminar funciones RPC y triggers creados
DROP FUNCTION IF EXISTS public.billing_create_checkout(INT, INT);
DROP FUNCTION IF EXISTS public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT);

DROP TRIGGER IF EXISTS tr_block_audit_update_delete ON public.billing_audit_logs;
DROP TRIGGER IF EXISTS tr_block_sub_events_update_delete ON public.subscription_events;
DROP FUNCTION IF EXISTS public.fn_block_audit_mutation();

-- 3. Desvincular columnas agregadas a public.subscriptions de forma segura
ALTER TABLE public.subscriptions 
DROP COLUMN IF EXISTS plan_price_id,
DROP COLUMN IF EXISTS provider_status,
DROP COLUMN IF EXISTS metadata;

-- 4. Eliminar las tablas creadas en orden inverso de dependencias
DROP TABLE IF EXISTS public.billing_audit_logs CASCADE;
DROP TABLE IF EXISTS public.idempotency_records CASCADE;
DROP TABLE IF EXISTS public.payment_webhook_events CASCADE;
DROP TABLE IF EXISTS public.subscription_events CASCADE;
DROP TABLE IF EXISTS public.payment_transactions CASCADE;
DROP TABLE IF EXISTS public.payment_attempts CASCADE;
DROP TABLE IF EXISTS public.billing_invoices CASCADE;
DROP TABLE IF EXISTS public.billing_checkouts CASCADE;
DROP TABLE IF EXISTS public.billing_customers CASCADE;
DROP TABLE IF EXISTS public.plan_prices CASCADE;

COMMIT;
