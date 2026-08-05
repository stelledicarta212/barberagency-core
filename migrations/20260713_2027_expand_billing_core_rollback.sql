-- =============================================================================
-- ROLLBACK DE LA MIGRACIÓN DE EXPANSIÓN - MÓDULO DE PAGOS Y FACTURACIÓN SAAS
-- ARCHIVO: 20260713_2027_expand_billing_core_rollback.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- 1) Eliminar funciones RPC y triggers creados
DROP FUNCTION IF EXISTS public.billing_create_checkout(INT, INT);
DROP FUNCTION IF EXISTS public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT);

DROP TRIGGER IF EXISTS tr_block_audit_update_delete ON public.billing_audit_logs;
DROP TRIGGER IF EXISTS tr_block_sub_events_update_delete ON public.subscription_events;
DROP FUNCTION IF EXISTS public.fn_block_audit_mutation();

-- 2) Desvincular columnas agregadas a public.subscriptions de forma segura
ALTER TABLE public.subscriptions 
DROP COLUMN IF EXISTS plan_price_id,
DROP COLUMN IF EXISTS provider_status,
DROP COLUMN IF EXISTS metadata;

-- 3) Eliminar las tablas creadas en orden inverso de dependencias (para evitar fallas de FK)
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
