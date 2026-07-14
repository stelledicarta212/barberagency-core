-- =============================================================================
-- MIGRACIÓN DE EXPANSIÓN V2 (EXPAND-ONLY CORE)
-- ARCHIVO: 20260713_2027_expand_billing_core_v2.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- =============================================================================
-- 1) TABLAS DE CATÁLOGO Y CONFIGURACIÓN COMERCIAL
-- =============================================================================

-- public.plan_prices: Precios versionados asociados a public.planes
CREATE TABLE IF NOT EXISTS public.plan_prices (
  id SERIAL PRIMARY KEY,
  plan_id INT NOT NULL REFERENCES public.planes(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (name IN ('monthly', 'quarterly', 'semiannual', 'annual')), -- Códigos estables de periodo
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)) DEFAULT 'COP',
  interval_type TEXT NOT NULL CHECK (interval_type IN ('month', 'year')),
  interval_count INT NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_prices_active_lookup 
ON public.plan_prices(plan_id, interval_type, currency) 
WHERE active = true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_price_active_tier 
ON public.plan_prices(plan_id, name, currency) 
WHERE active = true;

-- =============================================================================
-- 2) PERFILES DE FACTURACIÓN CLIENTE
-- =============================================================================

-- public.billing_customers: Mapeo de barberías con su Customer ID en el proveedor
CREATE TABLE IF NOT EXISTS public.billing_customers (
  id BIGSERIAL PRIMARY KEY,
  barberia_id INT NOT NULL UNIQUE REFERENCES public.barberias(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'paypal', 'stripe', 'wompi', 'manual')),
  provider_customer_id TEXT NOT NULL,
  billing_email TEXT NOT NULL CHECK (length(billing_email) >= 5 AND billing_email LIKE '%@%.%'),
  tax_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3) INTENCIONES DE CHECKOUT
-- =============================================================================

-- public.billing_checkouts: Intención de inicio de checkout por el cliente
CREATE TABLE IF NOT EXISTS public.billing_checkouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  plan_price_id INT NOT NULL REFERENCES public.plan_prices(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'expired', 'completed', 'failed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  external_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at)
);

-- Restricción UNIQUE exigida: UNIQUE(external_reference) en billing_checkouts
ALTER TABLE public.billing_checkouts 
ADD CONSTRAINT uq_billing_checkouts_ext_ref UNIQUE (external_reference);

CREATE INDEX IF NOT EXISTS idx_billing_checkouts_lookup 
ON public.billing_checkouts(barberia_id, status);

-- =============================================================================
-- 4) ENTIDADES FINANCIERAS
-- =============================================================================

-- public.billing_invoices: Historial de facturas generadas por el SaaS
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  subscription_id BIGINT, -- Se asocia una vez se inserta la suscripción (FK abajo)
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void', 'disputed', 'overdue')),
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ CHECK (paid_at >= created_at OR paid_at IS NULL),
  invoice_pdf_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_barberia 
ON public.billing_invoices(barberia_id, status);

-- public.payment_attempts: Intentos de cobro de una factura
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.billing_invoices(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL CHECK (length(currency) = 3 AND currency = upper(currency)),
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'paypal', 'stripe', 'wompi', 'manual')),
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_process', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempt_provider_ref 
ON public.payment_attempts(provider, provider_ref) 
WHERE provider_ref IS NOT NULL;

-- public.payment_transactions: Cobros físicos
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_attempt_id UUID NOT NULL REFERENCES public.payment_attempts(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'paypal', 'stripe', 'wompi', 'manual')),
  provider_payment_id TEXT, -- ID físico del pago en pasarela
  amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid >= 0),
  fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  payment_method_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Restricción: UNIQUE(provider, provider_payment_id) cuando no sea nulo
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_payment_trans 
ON public.payment_transactions(provider, provider_payment_id) 
WHERE provider_payment_id IS NOT NULL;

-- =============================================================================
-- 5) LOGS, IDEMPOTENCIA Y AUDITORÍA INMUTABLE
-- =============================================================================

-- public.payment_webhook_events: Historial de payloads crudos de webhooks
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'paypal', 'stripe', 'wompi', 'manual')),
  provider_event_id TEXT, -- ID del webhook provisto por pasarela
  fallback_key TEXT NOT NULL, -- HASH calculado de payload en n8n
  event_type TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deduplicación exacta de webhooks
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_provider_event 
ON public.payment_webhook_events(provider, provider_event_id) 
WHERE provider_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_provider_fallback 
ON public.payment_webhook_events(provider, fallback_key) 
WHERE provider_event_id IS NULL;

-- public.idempotency_records: Registro transaccional de idempotencia
CREATE TABLE IF NOT EXISTS public.idempotency_records (
  idkey TEXT PRIMARY KEY, -- Restricción UNIQUE(idempotency_key) física
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- public.billing_audit_logs: Logs de auditoría inmutables (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.billing_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id INT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'cron_job')),
  barberia_id INT REFERENCES public.barberias(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para bloquear UPDATE/DELETE en auditoría
CREATE OR REPLACE FUNCTION public.fn_block_audit_mutation()
RETURNS TRIGGER AS $body$
BEGIN
  RAISE EXCEPTION 'Operación denegada: billing_audit_logs y subscription_events son tablas Append-Only e inmutables.';
END;
$body$ LANGUAGE plpgsql;

CREATE TRIGGER tr_block_audit_update_delete
BEFORE UPDATE OR DELETE ON public.billing_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_block_audit_mutation();

-- =============================================================================
-- 6) SUSCRIPCIONES Y EVENTOS
-- =============================================================================

-- public.subscription_events: Logs históricos de las suscripciones
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'renewed', 'grace_start', 'suspended', 'reactivated', 'canceled')),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER tr_block_sub_events_update_delete
BEFORE UPDATE OR DELETE ON public.subscription_events
FOR EACH ROW EXECUTE FUNCTION public.fn_block_audit_mutation();

-- =============================================================================
-- 7) ALTER TABLE Y ENLACES (EXPAND-ONLY)
-- =============================================================================

ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS plan_price_id INT REFERENCES public.plan_prices(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS provider_status TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Agregar restricciones de FK pendientes cruzadas de forma segura
ALTER TABLE public.billing_invoices 
ADD CONSTRAINT fk_billing_invoices_subscription 
FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;

ALTER TABLE public.subscription_events 
ADD CONSTRAINT fk_subscription_events_subscription 
FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;

-- =============================================================================
-- 8) SEGURIDAD - HABILITAR ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.plan_prices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkouts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- 9) POLÍTICAS RLS (CORREGIDAS Y SIN auth.uid())
-- =============================================================================

-- A. Políticas para plan_prices (Global pública)
CREATE POLICY policy_plan_prices_read ON public.plan_prices
  FOR SELECT TO public USING (active = true);

-- B. Políticas para billing_customers (Tenant readable vía EXISTS)
CREATE POLICY policy_billing_customers_read ON public.billing_customers
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.barberias b 
      WHERE b.id = billing_customers.barberia_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );

-- C. Políticas para billing_checkouts (Tenant readable vía EXISTS)
CREATE POLICY policy_billing_checkouts_read ON public.billing_checkouts
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.barberias b 
      WHERE b.id = billing_checkouts.barberia_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );

-- D. Políticas para billing_invoices (Tenant readable vía EXISTS)
CREATE POLICY policy_billing_invoices_read ON public.billing_invoices
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.barberias b 
      WHERE b.id = billing_invoices.barberia_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );

-- E. Políticas para payment_attempts (Tenant readable vía EXISTS)
CREATE POLICY policy_payment_attempts_read ON public.payment_attempts
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.barberias b 
      WHERE b.id = payment_attempts.barberia_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );

-- F. Políticas para payment_transactions (Tenant readable vía EXISTS)
CREATE POLICY policy_payment_transactions_read ON public.payment_transactions
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.payment_attempts pa
      JOIN public.barberias b ON pa.barberia_id = b.id
      WHERE pa.id = payment_transactions.payment_attempt_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );

-- G. Políticas para subscription_events (Tenant readable vía EXISTS)
CREATE POLICY policy_subscription_events_read ON public.subscription_events
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.barberias b ON s.barberia_id = b.id
      WHERE s.id = subscription_events.subscription_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );

-- H. Tablas Backend-Only (Fail-closed por defecto sin políticas para public)
-- - public.payment_webhook_events
-- - public.idempotency_records
-- - public.billing_audit_logs

-- =============================================================================
-- 10) STUBS DE RPC TRANSACCIONALES
-- =============================================================================

CREATE OR REPLACE FUNCTION public.billing_create_checkout(
  p_barberia_id INT,
  p_plan_price_id INT
)
RETURNS TABLE (
  checkout_id UUID,
  external_reference TEXT,
  amount NUMERIC,
  currency TEXT
) AS $body$
BEGIN
  RAISE EXCEPTION 'RPC billing_create_checkout está actualmente en modo STUB. No implementada aún.';
END;
$body$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION public.billing_register_webhook(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS TABLE (
  webhook_id UUID,
  already_processed BOOLEAN
) AS $body$
BEGIN
  RAISE EXCEPTION 'RPC billing_register_webhook está actualmente en modo STUB. No implementada aún.';
END;
$body$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.billing_process_approved_payment(
  p_external_reference TEXT,
  p_provider_payment_id TEXT,
  p_amount NUMERIC,
  p_fee NUMERIC,
  p_method TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  invoice_id UUID,
  subscription_id BIGINT
) AS $body$
BEGIN
  RAISE EXCEPTION 'RPC billing_process_approved_payment está actualmente en modo STUB. No implementada aún.';
END;
$body$ LANGUAGE plpgsql SECURITY INVOKER;

-- =============================================================================
-- 11) SEED DE DATOS COMERCIALES (COP) IDEMPOTENTE
-- =============================================================================

DO $body$
DECLARE
  v_plan_count INT;
  v_plan_id INT;
BEGIN
  -- Validar que exista exactamente un plan BarberAgency activo
  SELECT COUNT(*) INTO v_plan_count FROM public.planes WHERE code = 'barberagency_full';
  
  IF v_plan_count <> 1 THEN
    RAISE EXCEPTION 'Falla en Seed: Se esperada exactamente 1 plan con código barberagency_full, se encontraron %.', v_plan_count;
  END IF;

  SELECT id INTO v_plan_id FROM public.planes WHERE code = 'barberagency_full';

  -- mensual: 50.000 COP
  IF NOT EXISTS (SELECT 1 FROM public.plan_prices WHERE plan_id = v_plan_id AND name = 'monthly' AND currency = 'COP') THEN
    INSERT INTO public.plan_prices (plan_id, name, amount, currency, interval_type, interval_count, active)
    VALUES (v_plan_id, 'monthly', 50000.00, 'COP', 'month', 1, true);
  END IF;

  -- trimestral: 142.500 COP
  IF NOT EXISTS (SELECT 1 FROM public.plan_prices WHERE plan_id = v_plan_id AND name = 'quarterly' AND currency = 'COP') THEN
    INSERT INTO public.plan_prices (plan_id, name, amount, currency, interval_type, interval_count, active)
    VALUES (v_plan_id, 'quarterly', 142500.00, 'COP', 'month', 3, true);
  END IF;

  -- semestral: 270.000 COP
  IF NOT EXISTS (SELECT 1 FROM public.plan_prices WHERE plan_id = v_plan_id AND name = 'semiannual' AND currency = 'COP') THEN
    INSERT INTO public.plan_prices (plan_id, name, amount, currency, interval_type, interval_count, active)
    VALUES (v_plan_id, 'semiannual', 270000.00, 'COP', 'month', 6, true);
  END IF;

  -- anual: 510.000 COP
  IF NOT EXISTS (SELECT 1 FROM public.plan_prices WHERE plan_id = v_plan_id AND name = 'annual' AND currency = 'COP') THEN
    INSERT INTO public.plan_prices (plan_id, name, amount, currency, interval_type, interval_count, active)
    VALUES (v_plan_id, 'annual', 510000.00, 'COP', 'year', 1, true);
  END IF;

END $body$;

COMMIT;
