-- =============================================================================
-- MIGRACIÓN DE EXPANSIÓN (EXPAND-ONLY) - MÓDULO DE PAGOS Y FACTURACIÓN SAAS
-- ARCHIVO: 20260713_2027_expand_billing_core.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

-- Configuración de timeouts para evitar bloqueos largos en base de datos de producción
SET statement_timeout = '10s';
SET lock_timeout = '5s';

-- Iniciar transacción para garantizar atomicidad
BEGIN;

-- =============================================================================
-- 1) TABLAS DE CATÁLOGO Y CONFIGURACIÓN COMERCIAL
-- =============================================================================

-- public.plan_prices: Precios versionados asociados a public.planes
CREATE TABLE IF NOT EXISTS public.plan_prices (
  id SERIAL PRIMARY KEY,
  plan_id INT NOT NULL REFERENCES public.planes(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$') DEFAULT 'COP',
  interval_type TEXT NOT NULL CHECK (interval_type IN ('month', 'year')),
  interval_count INT NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crear índice para agilizar consultas por plan activo y tipo de ciclo
CREATE INDEX IF NOT EXISTS idx_plan_prices_active_lookup 
ON public.plan_prices(plan_id, interval_type, currency) 
WHERE active = true;

-- Restricción UNIQUE compuesta para evitar tener precios activos duplicados con el mismo ciclo
CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_price_active_tier 
ON public.plan_prices(plan_id, interval_type, interval_count, currency) 
WHERE active = true;

-- =============================================================================
-- 2) PERFILES DE FACTURACIÓN CLIENTE (GATEWAY MAPPING)
-- =============================================================================

-- public.billing_customers: Mapeo de barberías con su Customer ID en el proveedor
CREATE TABLE IF NOT EXISTS public.billing_customers (
  id BIGSERIAL PRIMARY KEY,
  barberia_id INT NOT NULL UNIQUE REFERENCES public.barberias(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'paypal', 'stripe', 'wompi', 'manual')),
  provider_customer_id TEXT NOT NULL,
  billing_email TEXT NOT NULL CHECK (billing_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  tax_id TEXT, -- Documento NIT, RUT, CC
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
  idempotency_key TEXT NOT NULL UNIQUE, -- Bloquea duplicados al iniciar
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_billing_checkouts_lookup 
ON public.billing_checkouts(barberia_id, status);

-- =============================================================================
-- 4) ENTIDADES FINANCIERAS (FACTURAS E INTENTOS)
-- =============================================================================

-- public.billing_invoices: Historial de facturas generadas por el SaaS
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  subscription_id BIGINT, -- Se asocia una vez se inserta la suscripción (se declara FK después)
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
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
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'paypal', 'stripe', 'wompi', 'manual')),
  provider_ref TEXT, -- preference_id / checkout_id de Mercado Pago
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'in_process', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único en (provider, provider_ref) para evitar duplicar el checkout de Mercado Pago
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempt_provider_ref 
ON public.payment_attempts(provider, provider_ref) 
WHERE provider_ref IS NOT NULL;

-- public.payment_transactions: Cobros físicos reportados por Mercado Pago
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_attempt_id UUID NOT NULL REFERENCES public.payment_attempts(id) ON DELETE RESTRICT,
  provider_payment_id TEXT NOT NULL, -- ID de transacción física de Mercado Pago
  amount_paid NUMERIC(10,2) NOT NULL CHECK (amount_paid >= 0),
  fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  payment_method_type TEXT NOT NULL, -- PSE, credit_card, cash
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_provider_payment UNIQUE (provider_payment_id)
);

-- =============================================================================
-- 5) LOGS, IDEMPOTENCIA Y AUDITORÍA INMUTABLE
-- =============================================================================

-- public.payment_webhook_events: Historial de payloads crudos de webhooks
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'paypal', 'stripe', 'wompi', 'manual')),
  provider_event_id TEXT, -- ID del evento de Mercado Pago si existe
  fallback_key TEXT NOT NULL, -- HASH SHA-256 del body crudo en n8n como respaldo
  event_type TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice único para evitar procesar dos veces el mismo webhook
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_provider_event 
ON public.payment_webhook_events(provider, provider_event_id) 
WHERE provider_event_id IS NOT NULL;

-- Índice único para fallback si no existe provider_event_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_provider_fallback 
ON public.payment_webhook_events(provider, fallback_key) 
WHERE provider_event_id IS NULL;

-- public.idempotency_records: Registro transaccional de idempotencia
CREATE TABLE IF NOT EXISTS public.idempotency_records (
  idkey TEXT PRIMARY KEY, -- Clave generada
  response_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- public.billing_audit_logs: Logs de auditoría inmutables (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.billing_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id INT, -- usuario que realiza el cambio (null para sistema)
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'cron_job')),
  barberia_id INT REFERENCES public.barberias(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- subscriptions, billing_invoices
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL, -- update_status, manual_grant
  old_values JSONB,
  new_values JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para bloquear cualquier UPDATE/DELETE en la tabla de auditoría (Append-only)
CREATE OR REPLACE FUNCTION public.fn_block_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Operación no permitida: La tabla billing_audit_logs es inmutable (Append-Only).';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_block_audit_update_delete
BEFORE UPDATE OR DELETE ON public.billing_audit_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_block_audit_mutation();

-- =============================================================================
-- 6) SUSCRIPCIONES Y EVENTOS
-- =============================================================================

-- public.subscription_events: Logs históricos de las suscripciones (APPEND-ONLY)
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL, -- Declarada FK después para no romper dependencias
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

-- Agregar columnas necesarias a public.subscriptions de forma retrocompatible
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

-- =============================================================================
-- 9) ROLES Y POLÍTICAS DE ACCESO
-- =============================================================================

-- NOTA: Se asume la existencia de los roles de aplicación de BarberAgency.
-- Las políticas de lectura validan la relación de propiedad mediante claims de JWT.

-- A. Políticas para plan_prices (Global pública)
CREATE POLICY policy_plan_prices_read ON public.plan_prices
  FOR SELECT TO public USING (active = true);

-- B. Políticas para billing_customers (Tenant readable)
CREATE POLICY policy_billing_customers_read ON public.billing_customers
  FOR SELECT TO public USING (
    barberia_id IN (SELECT id FROM public.barberias WHERE owner_id = public.jwt_user_id())
  );

-- C. Políticas para billing_checkouts (Tenant readable)
CREATE POLICY policy_billing_checkouts_read ON public.billing_checkouts
  FOR SELECT TO public USING (
    barberia_id IN (SELECT id FROM public.barberias WHERE owner_id = public.jwt_user_id())
  );

-- D. Políticas para billing_invoices (Tenant readable)
CREATE POLICY policy_billing_invoices_read ON public.billing_invoices
  FOR SELECT TO public USING (
    barberia_id IN (SELECT id FROM public.barberias WHERE owner_id = public.jwt_user_id())
  );

-- E. Políticas para payment_attempts (Tenant readable)
CREATE POLICY policy_payment_attempts_read ON public.payment_attempts
  FOR SELECT TO public USING (
    barberia_id IN (SELECT id FROM public.barberias WHERE owner_id = public.jwt_user_id())
  );

-- F. Políticas para payment_transactions (Tenant readable)
CREATE POLICY policy_payment_transactions_read ON public.payment_transactions
  FOR SELECT TO public USING (
    payment_attempt_id IN (
      SELECT id FROM public.payment_attempts 
      WHERE barberia_id IN (SELECT id FROM public.barberias WHERE owner_id = public.jwt_user_id())
    )
  );

-- G. Políticas para subscription_events (Tenant readable)
CREATE POLICY policy_subscription_events_read ON public.subscription_events
  FOR SELECT TO public USING (
    subscription_id IN (
      SELECT id FROM public.subscriptions 
      WHERE barberia_id IN (SELECT id FROM public.barberias WHERE owner_id = public.jwt_user_id())
    )
  );

-- H. Tablas Backend-Only (Fail-closed para frontend, SELECT bloqueado para el público)
-- public.payment_webhook_events, public.idempotency_records, public.billing_audit_logs
-- Ninguna política es creada para public / authenticated, forzando la denegación por defecto.

-- =============================================================================
-- 10) STUBS DE RPC TRANSACCIONALES
-- =============================================================================

-- Stub 1: billing_create_checkout
CREATE OR REPLACE FUNCTION public.billing_create_checkout(
  p_barberia_id INT,
  p_plan_price_id INT
)
RETURNS TABLE (
  checkout_id UUID,
  external_reference TEXT,
  amount NUMERIC,
  currency TEXT
) AS $$
BEGIN
  -- Lógica transaccional a implementar en la fase CONTRACT/IMPLEMENTACIÓN
  -- Valida sesión JWT y propietario de la barbería.
  -- Valida que no exista checkout equivalente activo.
  -- Retorna datos de cobro esperados.
  RAISE EXCEPTION 'RPC billing_create_checkout está actualmente en modo STUB. No implementada aún.';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Stub 2: billing_register_webhook
CREATE OR REPLACE FUNCTION public.billing_register_webhook(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS TABLE (
  webhook_id UUID,
  already_processed BOOLEAN
) AS $$
BEGIN
  -- Lógica de registro e idempotencia del webhook crudo.
  -- Retorna si ya fue procesado para abortar de inmediato.
  RAISE EXCEPTION 'RPC billing_register_webhook está actualmente en modo STUB. No implementada aún.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Usado con cuidado por webhook ingestor

-- Stub 3: billing_process_approved_payment
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
) AS $$
BEGIN
  -- Lógica transaccional crítica:
  -- 1) Valida external_reference e inmutabilidad de montos.
  -- 2) Inserta transacción en payment_transactions.
  -- 3) Pasa factura a 'paid'.
  -- 4) Registra o extiende periodo en subscriptions calculando fechas aritméticas.
  RAISE EXCEPTION 'RPC billing_process_approved_payment está actualmente en modo STUB. No implementada aún.';
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- =============================================================================
-- 11) SEED DE DATOS COMERCIALES (COP) - BLOQUEADOR DETECTADO
-- =============================================================================

-- BLOQUEADOR CRÍTICO REGISTRADO EN EL DIAGNÓSTICO:
-- La tabla public.planes no contiene una columna 'code' para reconciliación comercial idempotente.
-- Las únicas columnas físicas son 'id' y 'nombre' (con datos Starter y Pro).
-- Dado que la instrucción prohíbe asumir 'plan_id = 1' y exige detener el seed si planes no posee 'code':
-- SE DETIENE LA INSERCIÓN DEL SEED Y SE DEJA DOCUMENTADO COMO BLOQUEADOR PARA EVITAR ASUNCIONES EN PRODUCCIÓN.

/*
-- Código semilla propuesto si existiera la columna 'code' o tras agregarla:
INSERT INTO public.plan_prices (plan_id, name, amount, currency, interval_type, interval_count, active)
VALUES 
  ((SELECT id FROM public.planes WHERE code = 'pro'), 'Mensual Pro', 50000.00, 'COP', 'month', 1, true),
  ((SELECT id FROM public.planes WHERE code = 'pro'), 'Trimestral Pro', 142500.00, 'COP', 'month', 3, true),
  ((SELECT id FROM public.planes WHERE code = 'pro'), 'Semestral Pro', 270000.00, 'COP', 'month', 6, true),
  ((SELECT id FROM public.planes WHERE code = 'pro'), 'Anual Pro', 510000.00, 'COP', 'year', 1, true)
ON CONFLICT DO NOTHING;
*/

COMMIT;
