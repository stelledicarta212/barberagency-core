-- =============================================================================
-- MIGRACIÓN CORRECTIVA: ROL DE BACKEND DE ALTO ENDURECIMIENTO (LEAST PRIVILEGE)
-- ARCHIVO: 20260713_2032_harden_billing_worker_role.sql
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- 1. Crear el rol de grupo (NOLOGIN, NOINHERIT)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'n8n_billing_worker_role') THEN
    CREATE ROLE n8n_billing_worker_role WITH NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END
$$;

-- 2. Revocar privilegios públicos sobre las funciones RPC
REVOKE EXECUTE ON FUNCTION public.billing_create_checkout(INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;

-- 3. Crear el RPC Backend seguro que encapsula la sesión y validación
-- Justificación de SECURITY DEFINER: El rol invocador n8n_billing_worker_role no tiene privilegios directos de DML
-- sobre las tablas (least privilege design). Se ejecuta con privilegios elevados del propietario de forma segura
-- parametrizando las entradas y fijando el search_path.
CREATE OR REPLACE FUNCTION public.billing_create_checkout_backend(
  p_barberia_id INT,
  p_plan_code TEXT,
  p_billing_term TEXT,
  p_verified_user_id INT
)
RETURNS TABLE (
  checkout_id UUID,
  external_reference TEXT,
  amount NUMERIC,
  currency TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_plan_price_id INT;
  v_price_active BOOLEAN;
BEGIN
  -- A. Validar entradas
  IF p_barberia_id IS NULL OR p_barberia_id <= 0 THEN
    RAISE EXCEPTION 'INVALID_BARBERIA_ID: Barberia ID must be a positive integer.' USING ERRCODE = '22000';
  END IF;

  IF p_plan_code NOT IN ('barberagency_full', 'barberagency_starter') THEN
    RAISE EXCEPTION 'INVALID_PLAN_CODE: Plan code not allowed.' USING ERRCODE = '22000';
  END IF;

  IF p_billing_term NOT IN ('monthly', 'quarterly', 'semiannual', 'annual') THEN
    RAISE EXCEPTION 'INVALID_BILLING_TERM: Billing term not allowed.' USING ERRCODE = '22000';
  END IF;

  -- B. Resolver ID de precio activo
  SELECT pp.id, pp.active 
  INTO v_plan_price_id, v_price_active
  FROM public.plan_prices pp
  JOIN public.planes p ON pp.plan_id = p.id
  WHERE p.code = p_plan_code AND pp.name = p_billing_term
  LIMIT 1;

  IF v_plan_price_id IS NULL OR NOT v_price_active THEN
    RAISE EXCEPTION 'PRICE_NOT_FOUND: Active plan or price not found for the given criteria.' USING ERRCODE = 'P0002';
  END IF;

  -- C. Configurar claims locales de la transacción (evita fugas en pooler)
  PERFORM set_config('request.jwt.claims', json_build_object('user_id', p_verified_user_id::text)::text, true);

  -- D. Delegar en el RPC core que aplica las políticas RLS de inquilino
  RETURN QUERY
  SELECT bc.checkout_id, bc.external_reference, bc.amount, bc.currency
  FROM public.billing_create_checkout(p_barberia_id, v_plan_price_id) bc;
END;
$body$;

-- Revocar privilegios públicos del nuevo RPC
REVOKE EXECUTE ON FUNCTION public.billing_create_checkout_backend(INT, TEXT, TEXT, INT) FROM PUBLIC;

-- 4. Conceder privilegios mínimos al rol de grupo n8n_billing_worker_role
GRANT USAGE ON SCHEMA public TO n8n_billing_worker_role;
GRANT EXECUTE ON FUNCTION public.billing_create_checkout_backend(INT, TEXT, TEXT, INT) TO n8n_billing_worker_role;
GRANT EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) TO n8n_billing_worker_role;
GRANT EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO n8n_billing_worker_role;

-- 5. Asegurar RLS activo en tablas de pagos
ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_prices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkouts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions FORCE ROW LEVEL SECURITY;

COMMIT;
