-- =============================================================================
-- MIGRACIÓN DE EXPANSIÓN: PATRÓN TRANSACTIONAL OUTBOX
-- ARCHIVO: 20260713_2030_add_billing_outbox.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- =============================================================================
-- 1) TABLA BILLING_OUTBOX Y SUS RESTRICCIONES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.billing_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'checkout_created', 'payment_approved', 'payment_failed', 'invoice_paid',
    'subscription_activated', 'subscription_extended', 'subscription_past_due',
    'grace_period_started', 'subscription_suspended', 'subscription_reactivated',
    'cancellation_requested', 'subscription_cancelled', 'refund_completed', 'dispute_opened'
  )),
  aggregate_type TEXT NOT NULL CHECK (aggregate_type IN ('checkout', 'payment', 'invoice', 'subscription', 'webhook')),
  aggregate_id TEXT NOT NULL,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  subscription_id BIGINT REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'processed', 'retry_scheduled', 'failed', 'dead_letter', 'cancelled'
  )),
  priority INT NOT NULL DEFAULT 0 CHECK (priority >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  processing_started_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_retry_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  correlation_id UUID,
  causation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para el polling rápido de eventos pendientes
CREATE INDEX IF NOT EXISTS idx_billing_outbox_polling 
ON public.billing_outbox(status, priority DESC, available_at) 
WHERE status IN ('pending', 'retry_scheduled');

-- Índice para identificar bloqueos caducados
CREATE INDEX IF NOT EXISTS idx_billing_outbox_stale 
ON public.billing_outbox(locked_at) 
WHERE status = 'processing';

-- =============================================================================
-- 2) CONFIGURACIÓN DE SEGURIDAD Y RLS (FAIL-CLOSED)
-- =============================================================================

ALTER TABLE public.billing_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_outbox FORCE ROW LEVEL SECURITY;

-- Revocar accesos por defecto a PUBLIC
REVOKE ALL ON public.billing_outbox FROM PUBLIC;

-- El frontend (anon / authenticated) no tiene políticas asignadas. 
-- Queda completamente bloqueado (Fail-closed).
-- El backend worker de n8n opera como 'postgres' (superuser) y tiene acceso total.

-- =============================================================================
-- 3) TRÓGGER DE INMUTABILIDAD EN PROCESADOS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_block_outbox_reversion()
RETURNS TRIGGER AS $body$
BEGIN
  -- Evitar que un evento ya procesado con éxito sea alterado o devuelto a pending
  IF OLD.status = 'processed' THEN
    RAISE EXCEPTION 'MUTATION_DENIED: Un evento de outbox en estado processed es inmutable.';
  END IF;
  RETURN NEW;
END;
$body$ LANGUAGE plpgsql;

CREATE TRIGGER tr_block_outbox_processed_change
BEFORE UPDATE ON public.billing_outbox
FOR EACH ROW EXECUTE FUNCTION public.fn_block_outbox_reversion();

-- =============================================================================
-- 4) RE-ESCRITURA DE RPCS CORE INTEGRANDO EL OUTBOX ATÓMICO
-- =============================================================================

-- RPC 1: billing_create_checkout
CREATE OR REPLACE FUNCTION public.billing_create_checkout(
  p_barberia_id INT,
  p_plan_price_id INT
)
RETURNS TABLE (
  checkout_id UUID,
  external_reference TEXT,
  amount NUMERIC,
  currency TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_jwt_user INT;
  v_owner_id INT;
  v_price_amount NUMERIC;
  v_price_currency CHAR(3);
  v_price_name TEXT;
  v_price_active BOOLEAN;
  v_checkout_id UUID;
  v_external_reference TEXT;
  v_idempotency_key TEXT;
  v_expires_at TIMESTAMPTZ;
  v_outbox_idempotency TEXT;
BEGIN
  -- 1. Validar sesión
  v_jwt_user := public.jwt_user_id();
  IF v_jwt_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Debe iniciar sesión.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validar propiedad
  SELECT owner_id INTO v_owner_id FROM public.barberias WHERE id = p_barberia_id AND deleted_at IS NULL;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'BARBERIA_NOT_FOUND: La barbería no existe.' USING ERRCODE = 'P0002';
  ELSIF v_owner_id <> v_jwt_user THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Sin permisos sobre inquilino.' USING ERRCODE = '42501';
  END IF;

  -- 3. Cargar precio
  SELECT p.amount, p.currency, p.name, p.active INTO v_price_amount, v_price_currency, v_price_name, v_price_active
  FROM public.plan_prices p WHERE p.id = p_plan_price_id;
  IF v_price_amount IS NULL OR v_price_active = false THEN
    RAISE EXCEPTION 'INVALID_PRICE: Precio comercial inválido.' USING ERRCODE = '23514';
  END IF;

  -- 4. Reutilizar checkout activo si existe
  SELECT id, bc.external_reference INTO v_checkout_id, v_external_reference
  FROM public.billing_checkouts bc
  WHERE barberia_id = p_barberia_id AND plan_price_id = p_plan_price_id AND status = 'created' AND expires_at > now()
  LIMIT 1;

  IF v_checkout_id IS NOT NULL THEN
    checkout_id := v_checkout_id;
    external_reference := v_external_reference;
    amount := v_price_amount;
    currency := v_price_currency;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 5. Generar claves y referencias
  v_checkout_id := gen_random_uuid();
  v_expires_at := now() + interval '3 hours';
  v_external_reference := 'ba_v1_' || p_barberia_id::text || '_' || v_price_name || '_' || substring(v_checkout_id::text, 1, 8) || '_' || substring(md5(random()::text), 1, 6);
  v_idempotency_key := md5(p_barberia_id::text || '_' || p_plan_price_id::text || '_' || v_price_name || '_' || to_char(now(), 'YYYYMMDD_HH24'));

  -- 6. Insertar checkout
  INSERT INTO public.billing_checkouts (id, barberia_id, plan_price_id, status, idempotency_key, external_reference, expires_at)
  VALUES (v_checkout_id, p_barberia_id, p_plan_price_id, 'created', v_idempotency_key, v_external_reference, v_expires_at);

  -- 7. Registrar evento en billing_outbox (Atomicidad total)
  v_outbox_idempotency := 'checkout_created:' || v_checkout_id::text;
  INSERT INTO public.billing_outbox (
    event_type, aggregate_type, aggregate_id, barberia_id, payload, idempotency_key, correlation_id
  )
  VALUES (
    'checkout_created', 'checkout', v_checkout_id::text, p_barberia_id,
    jsonb_build_object('checkout_id', v_checkout_id, 'amount', v_price_amount, 'external_reference', v_external_reference),
    v_outbox_idempotency, v_checkout_id
  );

  checkout_id := v_checkout_id;
  external_reference := v_external_reference;
  amount := v_price_amount;
  currency := v_price_currency;
  RETURN NEXT;
END;
$body$;


-- RPC 2: billing_process_approved_payment
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
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $body$
DECLARE
  v_ref_parts TEXT[];
  v_barberia_id INT;
  v_price_name TEXT;
  v_checkout_id UUID;
  v_plan_price_id INT;
  v_plan_id INT;
  v_expected_amount NUMERIC;
  v_expected_currency CHAR(3);
  v_interval_type TEXT;
  v_interval_count INT;
  
  v_invoice_id UUID;
  v_subscription_id BIGINT;
  v_sub_status TEXT;
  v_current_period_end TIMESTAMPTZ;
  
  v_new_period_start TIMESTAMPTZ;
  v_new_period_end TIMESTAMPTZ;
  v_attempt_id UUID;
  v_transaction_id UUID;
  v_is_new_sub BOOLEAN := false;
BEGIN
  -- 1. Idempotencia física de transacciones
  IF EXISTS (SELECT 1 FROM public.payment_transactions WHERE provider_payment_id = p_provider_payment_id) THEN
    SELECT pt.id, pa.invoice_id, s.id
    INTO v_attempt_id, invoice_id, subscription_id
    FROM public.payment_transactions pt
    JOIN public.payment_attempts pa ON pt.payment_attempt_id = pa.id
    LEFT JOIN public.subscriptions s ON pa.barberia_id = s.barberia_id AND s.status = 'active'
    WHERE pt.provider_payment_id = p_provider_payment_id;
    
    success := true;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2. Desestructurar external_reference
  v_ref_parts := string_to_array(p_external_reference, '_');
  IF array_length(v_ref_parts, 1) < 5 OR v_ref_parts[1] <> 'ba' OR v_ref_parts[2] <> 'v1' THEN
    RAISE EXCEPTION 'INVALID_REF: Formato incorrecto.' USING ERRCODE = '22023';
  END IF;

  v_barberia_id := v_ref_parts[3]::int;
  v_price_name := v_ref_parts[4];
  
  SELECT id, plan_price_id INTO v_checkout_id, v_plan_price_id
  FROM public.billing_checkouts WHERE external_reference = p_external_reference;
  IF v_checkout_id IS NULL THEN
    RAISE EXCEPTION 'CHECKOUT_NOT_FOUND: Checkout no encontrado.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Cargar precio
  SELECT plan_id, amount, currency, interval_type, interval_count
  INTO v_plan_id, v_expected_amount, v_expected_currency, v_interval_type, v_interval_count
  FROM public.plan_prices WHERE id = v_plan_price_id;

  -- 4. Validar fraude
  IF p_amount < v_expected_amount THEN
    RAISE EXCEPTION 'FRAUD_DETECTION: Monto menor al esperado.' USING ERRCODE = '23514';
  END IF;

  -- 5. Crear o actualizar factura
  SELECT id INTO v_invoice_id FROM public.billing_invoices 
  WHERE barberia_id = v_barberia_id AND metadata->>'checkout_id' = v_checkout_id::text LIMIT 1;

  IF v_invoice_id IS NULL THEN
    v_invoice_id := gen_random_uuid();
    INSERT INTO public.billing_invoices (id, barberia_id, amount, currency, status, due_date, paid_at, metadata)
    VALUES (v_invoice_id, v_barberia_id, v_expected_amount, v_expected_currency, 'paid', now(), now(), jsonb_build_object('checkout_id', v_checkout_id));
  ELSE
    UPDATE public.billing_invoices SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = v_invoice_id;
  END IF;

  -- 6. Registrar intento
  v_attempt_id := gen_random_uuid();
  INSERT INTO public.payment_attempts (id, barberia_id, invoice_id, amount, currency, provider, provider_ref, status)
  VALUES (v_attempt_id, v_barberia_id, v_invoice_id, p_amount, v_expected_currency, 'mercadopago', p_provider_payment_id, 'approved');

  -- 7. Registrar transacción física
  v_transaction_id := gen_random_uuid();
  INSERT INTO public.payment_transactions (id, payment_attempt_id, provider, provider_payment_id, amount_paid, fee_amount, payment_method_type)
  VALUES (v_transaction_id, v_attempt_id, 'mercadopago', p_provider_payment_id, p_amount, p_fee, p_method);

  UPDATE public.billing_checkouts SET status = 'completed' WHERE id = v_checkout_id;

  -- 8. Calcular periodos
  SELECT id, status, period_end INTO v_subscription_id, v_sub_status, v_current_period_end
  FROM public.subscriptions WHERE barberia_id = v_barberia_id AND status IN ('active', 'trialing', 'past_due', 'paused') LIMIT 1;

  IF v_subscription_id IS NOT NULL AND v_current_period_end > now() THEN
    v_new_period_start := v_current_period_end;
    v_new_period_end := v_current_period_end + (v_interval_count::text || ' ' || v_interval_type)::interval;
  ELSE
    v_new_period_start := now();
    v_new_period_end := now() + (v_interval_count::text || ' ' || v_interval_type)::interval;
  END IF;

  -- 9. Upsert de suscripción
  IF v_subscription_id IS NULL THEN
    v_is_new_sub := true;
    INSERT INTO public.subscriptions (barberia_id, plan_id, plan_price_id, status, estado, period_start, period_end, provider, provider_ref)
    VALUES (v_barberia_id, v_plan_id, v_plan_price_id, 'active', 'activa', v_new_period_start, v_new_period_end, 'mercadopago', p_provider_payment_id)
    RETURNING id INTO v_subscription_id;

    INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
    VALUES (v_subscription_id, 'created', jsonb_build_object('invoice_id', v_invoice_id));
  ELSE
    UPDATE public.subscriptions 
    SET plan_id = v_plan_id, plan_price_id = v_plan_price_id, status = 'active', estado = 'activa', period_start = v_new_period_start, period_end = v_new_period_end, provider = 'mercadopago', provider_ref = p_provider_payment_id, updated_at = now()
    WHERE id = v_subscription_id;

    INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
    VALUES (v_subscription_id, 'renewed', jsonb_build_object('invoice_id', v_invoice_id));
  END IF;

  UPDATE public.barberias SET plan_id = v_plan_id WHERE id = v_barberia_id;
  UPDATE public.billing_invoices SET subscription_id = v_subscription_id WHERE id = v_invoice_id;

  -- ---------------------------------------------------------------------------
  -- 10. GENERAR EVENTOS ATÓMICOS EN BILLING_OUTBOX (Idempotencia y Trazabilidad)
  -- ---------------------------------------------------------------------------
  
  -- Evento A: payment_approved
  INSERT INTO public.billing_outbox (event_type, aggregate_type, aggregate_id, barberia_id, subscription_id, invoice_id, payment_transaction_id, payload, idempotency_key, correlation_id)
  VALUES (
    'payment_approved', 'payment', p_provider_payment_id, v_barberia_id, v_subscription_id, v_invoice_id, v_transaction_id,
    jsonb_build_object('amount', p_amount, 'method', p_method, 'provider_payment_id', p_provider_payment_id),
    'payment_approved:mercadopago:' || p_provider_payment_id, v_checkout_id
  );

  -- Evento B: invoice_paid
  INSERT INTO public.billing_outbox (event_type, aggregate_type, aggregate_id, barberia_id, subscription_id, invoice_id, payload, idempotency_key, correlation_id)
  VALUES (
    'invoice_paid', 'invoice', v_invoice_id::text, v_barberia_id, v_subscription_id, v_invoice_id,
    jsonb_build_object('amount', v_expected_amount, 'due_date', now()),
    'invoice_paid:' || v_invoice_id::text, v_checkout_id
  );

  -- Evento C: subscription_activated / subscription_extended
  IF v_is_new_sub THEN
    INSERT INTO public.billing_outbox (event_type, aggregate_type, aggregate_id, barberia_id, subscription_id, payload, idempotency_key, correlation_id)
    VALUES (
      'subscription_activated', 'subscription', v_subscription_id::text, v_barberia_id, v_subscription_id,
      jsonb_build_object('period_start', v_new_period_start, 'period_end', v_new_period_end, 'plan_id', v_plan_id),
      'subscription_activated:' || v_subscription_id::text || ':' || extract(epoch from v_new_period_start)::text, v_checkout_id
    );
  ELSE
    INSERT INTO public.billing_outbox (event_type, aggregate_type, aggregate_id, barberia_id, subscription_id, payload, idempotency_key, correlation_id)
    VALUES (
      'subscription_extended', 'subscription', v_subscription_id::text, v_barberia_id, v_subscription_id,
      jsonb_build_object('period_start', v_new_period_start, 'period_end', v_new_period_end, 'plan_id', v_plan_id),
      'subscription_extended:' || v_subscription_id::text || ':' || extract(epoch from v_new_period_start)::text, v_checkout_id
    );
  END IF;

  -- Auditoría
  INSERT INTO public.billing_audit_logs (actor_type, barberia_id, entity_type, entity_id, action)
  VALUES ('system', v_barberia_id, 'subscriptions', v_subscription_id::text, 'payment_and_outbox_created');

  success := true;
  invoice_id := v_invoice_id;
  subscription_id := v_subscription_id;
  RETURN NEXT;
END;
$body$;

-- =============================================================================
-- 5) RPC WORKER DE CONSUMO SEGURO Y CONCURRENCIA
-- =============================================================================

-- RPC 1: billing_outbox_claim_batch
-- Bloquea y reclama un lote de eventos listos usando FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.billing_outbox_claim_batch(
  p_worker_id TEXT,
  p_limit INT,
  p_timeout_seconds INT
)
RETURNS TABLE (
  outbox_id UUID,
  event_type TEXT,
  payload JSONB,
  correlation_id UUID,
  causation_id UUID
) 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $body$
BEGIN
  RETURN QUERY
  WITH claimed_events AS (
    SELECT id 
    FROM public.billing_outbox
    WHERE status IN ('pending', 'retry_scheduled')
      AND available_at <= now()
    ORDER BY priority DESC, available_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED -- Evita bloqueos entre hilos del worker
  )
  UPDATE public.billing_outbox o
  SET status = 'processing',
      locked_at = now(),
      locked_by = p_worker_id,
      processing_started_at = now(),
      attempt_count = o.attempt_count + 1,
      updated_at = now()
  FROM claimed_events c
  WHERE o.id = c.id
  RETURNING o.id, o.event_type, o.payload, o.correlation_id, o.causation_id;
END;
$body$;

-- RPC 2: billing_outbox_mark_processed
CREATE OR REPLACE FUNCTION public.billing_outbox_mark_processed(
  p_event_id UUID
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $body$
BEGIN
  UPDATE public.billing_outbox
  SET status = 'processed',
      processed_at = now(),
      locked_at = NULL,
      locked_by = NULL,
      updated_at = now()
  WHERE id = p_event_id;
  
  RETURN FOUND;
END;
$body$;

-- RPC 3: billing_outbox_mark_failed
CREATE OR REPLACE FUNCTION public.billing_outbox_mark_failed(
  p_event_id UUID,
  p_error_code TEXT,
  p_error_message TEXT,
  p_backoff_seconds INT
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $body$
DECLARE
  v_attempts INT;
  v_max_attempts INT;
  v_next_retry TIMESTAMPTZ;
BEGIN
  SELECT attempt_count, max_attempts INTO v_attempts, v_max_attempts
  FROM public.billing_outbox WHERE id = p_event_id;
  
  IF v_attempts IS NULL THEN
    RETURN false;
  END IF;

  IF v_attempts < v_max_attempts THEN
    -- Backoff Exponencial: p_backoff_seconds * 2^(intentos - 1)
    v_next_retry := now() + (p_backoff_seconds * POWER(2, v_attempts - 1)) * interval '1 second';
    
    UPDATE public.billing_outbox
    SET status = 'retry_scheduled',
        failed_at = now(),
        locked_at = NULL,
        locked_by = NULL,
        next_retry_at = v_next_retry,
        available_at = v_next_retry,
        last_error_code = p_error_code,
        last_error_message = p_error_message,
        updated_at = now()
    WHERE id = p_event_id;
  ELSE
    -- Superó el límite de reintentos: Mover a cola de fallos irrecuperables (Dead Letter)
    UPDATE public.billing_outbox
    SET status = 'dead_letter',
        failed_at = now(),
        locked_at = NULL,
        locked_by = NULL,
        last_error_code = p_error_code,
        last_error_message = p_error_message,
        updated_at = now()
    WHERE id = p_event_id;
    
    -- Alerta de auditoría
    INSERT INTO public.billing_audit_logs (actor_type, entity_type, entity_id, action, reason)
    VALUES ('system', 'outbox', p_event_id::text, 'dead_letter_reached', p_error_message);
  END IF;

  RETURN true;
END;
$body$;

-- RPC 4: billing_outbox_release_stale_locks
-- Libera eventos colgados (por ejemplo, caídas del worker o n8n)
CREATE OR REPLACE FUNCTION public.billing_outbox_release_stale_locks(
  p_timeout_seconds INT
)
RETURNS INT 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $body$
DECLARE
  v_released_count INT;
BEGIN
  UPDATE public.billing_outbox
  SET status = 'retry_scheduled',
      locked_at = NULL,
      locked_by = NULL,
      available_at = now(),
      last_error_message = 'LOCK_STALE_TIMEOUT: Desbloqueado automáticamente por superar timeout.',
      updated_at = now()
  WHERE status = 'processing'
    AND locked_at <= now() - (p_timeout_seconds * interval '1 second');
    
  GET DIAGNOSTICS v_released_count = ROW_COUNT;
  RETURN v_released_count;
END;
$body$;

-- RPC 5: billing_outbox_requeue_dead_letter
-- Permite reencolar de forma manual un evento muerto tras solucionar la falla externa
CREATE OR REPLACE FUNCTION public.billing_outbox_requeue_dead_letter(
  p_event_id UUID
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $body$
BEGIN
  UPDATE public.billing_outbox
  SET status = 'pending',
      attempt_count = 0,
      locked_at = NULL,
      locked_by = NULL,
      available_at = now(),
      processed_at = NULL,
      failed_at = NULL,
      last_error_code = NULL,
      last_error_message = 'REQUEUED: Reencolado manualmente desde Dead-Letter.',
      updated_at = now()
  WHERE id = p_event_id AND status = 'dead_letter';
  
  RETURN FOUND;
END;
$body$;

COMMIT;
