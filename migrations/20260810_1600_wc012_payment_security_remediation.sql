-- =============================================================================
-- WC-012 LOCAL REMEDIATION: SECURITY, AMOUNT/CURRENCY AND E2E BINDING
-- ARCHIVO: 20260810_1600_wc012_payment_security_remediation.sql
-- ESTADO: LOCAL CANDIDATE - NO EJECUTAR EN PRODUCCION SIN REVISION Y AUTORIZACION
-- SUPERCEDES: 20260803_1500_wc012_provision_ba_app.sql
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- La migracion previa ba_app queda como historial. No debe usarse como modelo
-- operativo final porque mezcla checkout, webhook y outbox en un unico rol.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ba_checkout_app') THEN
    CREATE ROLE ba_checkout_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 20;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ba_webhook_worker') THEN
    CREATE ROLE ba_webhook_worker LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 20;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ba_outbox_worker') THEN
    CREATE ROLE ba_outbox_worker LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 10;
  END IF;
END;
$$;

ALTER ROLE ba_checkout_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 20;
ALTER ROLE ba_webhook_worker WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 20;
ALTER ROLE ba_outbox_worker WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 10;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO ba_checkout_app, ba_webhook_worker, ba_outbox_worker', current_database());
END;
$$;

GRANT USAGE ON SCHEMA public TO ba_checkout_app, ba_webhook_worker, ba_outbox_worker;

-- Neutralizar el rol historico ba_app creado por 20260803_1500.
-- Se conserva el rol para auditoria/historial, pero sin permisos operativos.
DO $body$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ba_app') THEN
    EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM ba_app', current_database());
    REVOKE USAGE ON SCHEMA public FROM ba_app;
    REVOKE SELECT ON
      public.payment_attempts,
      public.subscriptions,
      public.barberias,
      public.planes,
      public.plan_prices,
      public.billing_checkouts,
      public.billing_invoices,
      public.billing_customers,
      public.subscription_events
    FROM ba_app;
    IF to_regprocedure('public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB)') IS NOT NULL THEN
      REVOKE EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) FROM ba_app;
    END IF;
    IF to_regprocedure('public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT)') IS NOT NULL THEN
      REVOKE EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT) FROM ba_app;
    END IF;
    IF to_regprocedure('public.billing_outbox_claim_batch(TEXT, INT, INT)') IS NOT NULL THEN
      REVOKE EXECUTE ON FUNCTION public.billing_outbox_claim_batch(TEXT, INT, INT) FROM ba_app;
    END IF;
    IF to_regprocedure('public.billing_outbox_mark_processed(UUID)') IS NOT NULL THEN
      REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_processed(UUID) FROM ba_app;
    END IF;
    IF to_regprocedure('public.billing_outbox_mark_failed(UUID, TEXT, TEXT, INT)') IS NOT NULL THEN
      REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_failed(UUID, TEXT, TEXT, INT) FROM ba_app;
    END IF;
    IF to_regprocedure('public.billing_outbox_release_stale_locks(INT)') IS NOT NULL THEN
      REVOKE EXECUTE ON FUNCTION public.billing_outbox_release_stale_locks(INT) FROM ba_app;
    END IF;
    IF to_regprocedure('public.billing_outbox_requeue_dead_letter(UUID)') IS NOT NULL THEN
      REVOKE EXECUTE ON FUNCTION public.billing_outbox_requeue_dead_letter(UUID) FROM ba_app;
    END IF;
    IF to_regprocedure('public.jwt_user_id()') IS NOT NULL THEN
      REVOKE EXECUTE ON FUNCTION public.jwt_user_id() FROM ba_app;
    END IF;
  END IF;
END;
$body$;

ALTER TABLE public.billing_checkouts
  ADD COLUMN IF NOT EXISTS provider_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS init_point TEXT,
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id INT,
  ADD COLUMN IF NOT EXISTS provider_transaction_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS provider_currency_id CHAR(3),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validation_error TEXT;

UPDATE public.billing_checkouts bc
   SET owner_user_id = b.owner_id
  FROM public.barberias b
 WHERE b.id = bc.barberia_id
   AND bc.owner_user_id IS NULL;

ALTER TABLE public.payment_attempts
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT,
  ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS expected_currency CHAR(3),
  ADD COLUMN IF NOT EXISTS provider_transaction_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS provider_currency_id CHAR(3);

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS provider_checkout_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_event_id TEXT,
  ADD COLUMN IF NOT EXISTS external_reference TEXT,
  ADD COLUMN IF NOT EXISTS currency CHAR(3);

CREATE OR REPLACE FUNCTION public.billing_register_webhook(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS TABLE (
  webhook_id UUID,
  already_processed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_fallback_key TEXT;
  v_existing RECORD;
  v_webhook_id UUID;
  v_payment_id TEXT;
BEGIN
  IF p_provider IS DISTINCT FROM 'mercadopago' THEN
    RAISE EXCEPTION 'UNSUPPORTED_WEBHOOK_PROVIDER' USING ERRCODE = '23514';
  END IF;
  IF p_event_type NOT IN ('payment.created', 'payment.updated') THEN
    RAISE EXCEPTION 'UNSUPPORTED_WEBHOOK_EVENT_TYPE' USING ERRCODE = '23514';
  END IF;
  v_payment_id := p_payload #>> '{data,id}';
  IF v_payment_id IS NULL OR btrim(v_payment_id) = '' THEN
    RAISE EXCEPTION 'WEBHOOK_PAYMENT_ID_REQUIRED' USING ERRCODE = '23514';
  END IF;

  v_fallback_key := encode(digest(p_payload::text, 'sha256'), 'hex');

  IF p_provider_event_id IS NOT NULL THEN
    SELECT id, processed, payload #>> '{data,id}' AS payment_id
      INTO v_existing
    FROM public.payment_webhook_events
    WHERE provider = p_provider AND provider_event_id = p_provider_event_id;

    IF v_existing.id IS NOT NULL THEN
      IF v_existing.payment_id IS DISTINCT FROM v_payment_id THEN
        RAISE EXCEPTION 'PROVIDER_EVENT_ID_REUSED_FOR_DIFFERENT_PAYMENT' USING ERRCODE = '23505';
      END IF;
      webhook_id := v_existing.id;
      already_processed := v_existing.processed;
      RETURN NEXT;
      RETURN;
    END IF;
  ELSE
    SELECT id, processed, payload #>> '{data,id}' AS payment_id
      INTO v_existing
    FROM public.payment_webhook_events
    WHERE provider = p_provider AND fallback_key = v_fallback_key;

    IF v_existing.id IS NOT NULL THEN
      webhook_id := v_existing.id;
      already_processed := v_existing.processed;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  v_webhook_id := gen_random_uuid();
  INSERT INTO public.payment_webhook_events (
    id, provider, provider_event_id, fallback_key, event_type, payload, processed, created_at
  )
  VALUES (
    v_webhook_id, p_provider, p_provider_event_id, v_fallback_key, p_event_type, p_payload, false, now()
  );

  webhook_id := v_webhook_id;
  already_processed := false;
  RETURN NEXT;
END;
$body$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_checkouts_provider_checkout_id
  ON public.billing_checkouts(provider_checkout_id)
  WHERE provider_checkout_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempt_provider_event
  ON public.payment_attempts(provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_provider_payment
  ON public.payment_transactions(provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_transactions_provider_event
  ON public.payment_transactions(provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_payment_correlation_checkout
  ON public.payment_attempts(provider_checkout_id, external_reference);

ALTER TABLE public.billing_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_checkouts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.billing_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_outbox FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.billing_create_checkout_backend(
  p_barberia_id INT,
  p_plan_code TEXT,
  p_billing_term TEXT,
  p_owner_user_id INT
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
BEGIN
  IF p_owner_user_id IS NULL OR p_owner_user_id <= 0 THEN
    RAISE EXCEPTION 'OWNER_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT pp.id INTO v_plan_price_id
  FROM public.plan_prices pp
  JOIN public.planes p ON p.id = pp.plan_id
  WHERE p.code = p_plan_code
    AND pp.name = p_billing_term
    AND pp.active = true;

  IF v_plan_price_id IS NULL THEN
    RAISE EXCEPTION 'PLAN_PRICE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('user_id', p_owner_user_id, 'role', 'authenticated')::text,
    true
  );

  RETURN QUERY
  SELECT * FROM public.billing_create_checkout(p_barberia_id, v_plan_price_id);
END;
$body$;

DROP FUNCTION IF EXISTS public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.billing_process_approved_payment(
  p_external_reference TEXT,
  p_provider_payment_id TEXT,
  p_provider_event_id TEXT,
  p_provider_checkout_id TEXT,
  p_amount NUMERIC,
  p_currency_id TEXT,
  p_fee NUMERIC,
  p_method TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  invoice_id UUID,
  subscription_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_checkout RECORD;
  v_plan RECORD;
  v_invoice_id UUID;
  v_attempt_id UUID;
  v_transaction_id UUID;
  v_subscription_id BIGINT;
  v_current_period_end TIMESTAMPTZ;
  v_new_period_start TIMESTAMPTZ;
  v_new_period_end TIMESTAMPTZ;
  v_is_new_sub BOOLEAN := false;
  v_webhook RECORD;
BEGIN
  IF p_provider_payment_id IS NULL OR btrim(p_provider_payment_id) = '' THEN
    RAISE EXCEPTION 'PAYMENT_ID_REQUIRED' USING ERRCODE = '23514';
  END IF;
  IF p_provider_event_id IS NULL OR btrim(p_provider_event_id) = '' THEN
    RAISE EXCEPTION 'PROVIDER_EVENT_ID_REQUIRED' USING ERRCODE = '23514';
  END IF;
  IF p_provider_checkout_id IS NULL OR btrim(p_provider_checkout_id) = '' THEN
    RAISE EXCEPTION 'PREFERENCE_ID_REQUIRED' USING ERRCODE = '23514';
  END IF;
  IF p_external_reference IS NULL OR btrim(p_external_reference) = '' THEN
    RAISE EXCEPTION 'EXTERNAL_REFERENCE_REQUIRED' USING ERRCODE = '23514';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_AMOUNT' USING ERRCODE = '23514';
  END IF;
  IF p_currency_id IS NULL OR p_currency_id !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_CURRENCY' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.payment_transactions
    WHERE provider = 'mercadopago' AND provider_payment_id = p_provider_payment_id
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.payment_transactions pt
      JOIN public.payment_attempts pa ON pa.id = pt.payment_attempt_id
      WHERE pt.provider = 'mercadopago'
        AND pt.provider_payment_id = p_provider_payment_id
        AND (
          pa.external_reference IS DISTINCT FROM p_external_reference
          OR pa.provider_checkout_id IS DISTINCT FROM p_provider_checkout_id
          OR pa.provider_event_id IS DISTINCT FROM p_provider_event_id
        )
    ) THEN
      RAISE EXCEPTION 'PAYMENT_ID_REUSED_FOR_DIFFERENT_CHECKOUT' USING ERRCODE = '23505';
    END IF;

    SELECT pa.invoice_id, bi.subscription_id
    INTO invoice_id, subscription_id
    FROM public.payment_transactions pt
    JOIN public.payment_attempts pa ON pa.id = pt.payment_attempt_id
    LEFT JOIN public.billing_invoices bi ON bi.id = pa.invoice_id
    WHERE pt.provider = 'mercadopago'
      AND pt.provider_payment_id = p_provider_payment_id
    LIMIT 1;
    success := true;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT id, processed, event_type, payload #>> '{data,id}' AS payment_id
    INTO v_webhook
  FROM public.payment_webhook_events
  WHERE provider = 'mercadopago'
    AND provider_event_id = p_provider_event_id;

  IF v_webhook.id IS NULL THEN
    RAISE EXCEPTION 'WEBHOOK_EVENT_NOT_REGISTERED' USING ERRCODE = 'P0002';
  END IF;
  IF v_webhook.event_type NOT IN ('payment.created', 'payment.updated') THEN
    RAISE EXCEPTION 'UNSUPPORTED_WEBHOOK_EVENT_TYPE' USING ERRCODE = '23514';
  END IF;
  IF v_webhook.payment_id IS DISTINCT FROM p_provider_payment_id THEN
    RAISE EXCEPTION 'WEBHOOK_PAYMENT_ID_MISMATCH' USING ERRCODE = '23514';
  END IF;

  SELECT bc.id,
         bc.barberia_id,
         bc.plan_price_id,
         bc.external_reference,
         bc.provider_checkout_id,
         bc.owner_user_id,
         b.owner_id
    INTO v_checkout
  FROM public.billing_checkouts bc
  JOIN public.barberias b ON b.id = bc.barberia_id AND b.deleted_at IS NULL
  WHERE bc.external_reference = p_external_reference
  FOR UPDATE;

  IF v_checkout.id IS NULL THEN
    RAISE EXCEPTION 'CHECKOUT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_checkout.provider_checkout_id IS DISTINCT FROM p_provider_checkout_id THEN
    RAISE EXCEPTION 'PREFERENCE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF v_checkout.external_reference IS DISTINCT FROM p_external_reference THEN
    RAISE EXCEPTION 'EXTERNAL_REFERENCE_MISMATCH' USING ERRCODE = '23514';
  END IF;
  IF v_checkout.owner_user_id IS NOT NULL AND v_checkout.owner_user_id IS DISTINCT FROM v_checkout.owner_id THEN
    RAISE EXCEPTION 'CHECKOUT_OWNER_MISMATCH' USING ERRCODE = '23514';
  END IF;

  SELECT pp.id AS plan_price_id,
         pp.plan_id,
         p.code AS plan_code,
         pp.name AS billing_term,
         pp.amount::NUMERIC(12,2) AS expected_amount,
         pp.currency::CHAR(3) AS expected_currency,
         pp.interval_type,
         pp.interval_count
    INTO v_plan
  FROM public.plan_prices pp
  JOIN public.planes p ON p.id = pp.plan_id
  WHERE pp.id = v_checkout.plan_price_id AND pp.active = true;

  IF v_plan.plan_price_id IS NULL THEN
    RAISE EXCEPTION 'PLAN_PRICE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_amount <> v_plan.expected_amount THEN
    RAISE EXCEPTION 'AMOUNT_MISMATCH: provider %, expected %', p_amount, v_plan.expected_amount USING ERRCODE = '23514';
  END IF;
  IF p_currency_id <> v_plan.expected_currency THEN
    RAISE EXCEPTION 'CURRENCY_MISMATCH: provider %, expected %', p_currency_id, v_plan.expected_currency USING ERRCODE = '23514';
  END IF;

  SELECT id INTO v_invoice_id
  FROM public.billing_invoices
  WHERE metadata->>'checkout_id' = v_checkout.id::text
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    v_invoice_id := gen_random_uuid();
    INSERT INTO public.billing_invoices (id, barberia_id, amount, currency, status, due_date, paid_at, metadata)
    VALUES (
      v_invoice_id,
      v_checkout.barberia_id,
      v_plan.expected_amount,
      v_plan.expected_currency,
      'paid',
      now(),
      now(),
      jsonb_build_object(
        'checkout_id', v_checkout.id,
        'external_reference', p_external_reference,
        'provider_checkout_id', p_provider_checkout_id,
        'provider_payment_id', p_provider_payment_id,
        'provider_event_id', p_provider_event_id,
        'owner_user_id', v_checkout.owner_id,
        'plan_price_id', v_plan.plan_price_id,
        'plan_code', v_plan.plan_code,
        'billing_term', v_plan.billing_term
      )
    );
  ELSE
    UPDATE public.billing_invoices
       SET status = 'paid',
           paid_at = COALESCE(paid_at, now()),
           updated_at = now(),
           metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
             'provider_checkout_id', p_provider_checkout_id,
             'provider_payment_id', p_provider_payment_id,
             'provider_event_id', p_provider_event_id
           )
     WHERE id = v_invoice_id;
  END IF;

  INSERT INTO public.payment_attempts (
    id, barberia_id, invoice_id, amount, currency, provider, provider_ref, status,
    provider_event_id, provider_checkout_id, external_reference, expected_amount,
    expected_currency, provider_transaction_amount, provider_currency_id
  )
  VALUES (
    gen_random_uuid(), v_checkout.barberia_id, v_invoice_id, p_amount, p_currency_id,
    'mercadopago', p_provider_payment_id, 'approved', p_provider_event_id,
    p_provider_checkout_id, p_external_reference, v_plan.expected_amount,
    v_plan.expected_currency, p_amount, p_currency_id
  )
  ON CONFLICT (provider, provider_ref) WHERE provider_ref IS NOT NULL
  DO UPDATE SET status = EXCLUDED.status, invoice_id = EXCLUDED.invoice_id
  RETURNING id INTO v_attempt_id;

  INSERT INTO public.payment_transactions (
    id, payment_attempt_id, provider, provider_payment_id, amount_paid, fee_amount,
    payment_method_type, provider_checkout_id, provider_event_id, external_reference, currency
  )
  VALUES (
    gen_random_uuid(), v_attempt_id, 'mercadopago', p_provider_payment_id,
    p_amount, COALESCE(p_fee, 0), p_method, p_provider_checkout_id,
    p_provider_event_id, p_external_reference, p_currency_id
  )
  RETURNING id INTO v_transaction_id;

  UPDATE public.billing_checkouts
     SET status = 'completed',
         provider_payment_id = p_provider_payment_id,
         provider_event_id = p_provider_event_id,
         provider_transaction_amount = p_amount,
         provider_currency_id = p_currency_id,
         verified_at = now()
   WHERE id = v_checkout.id;

  SELECT id, period_end
    INTO v_subscription_id, v_current_period_end
  FROM public.subscriptions
  WHERE barberia_id = v_checkout.barberia_id
    AND status IN ('active', 'trialing', 'past_due', 'paused')
  LIMIT 1
  FOR UPDATE;

  IF v_subscription_id IS NOT NULL AND v_current_period_end > now() THEN
    v_new_period_start := v_current_period_end;
    v_new_period_end := v_current_period_end + (v_plan.interval_count::text || ' ' || v_plan.interval_type)::interval;
  ELSE
    v_new_period_start := now();
    v_new_period_end := now() + (v_plan.interval_count::text || ' ' || v_plan.interval_type)::interval;
  END IF;

  IF v_subscription_id IS NULL THEN
    v_is_new_sub := true;
    INSERT INTO public.subscriptions (
      barberia_id, plan_id, plan_price_id, status, estado, period_start, period_end, provider, provider_ref
    )
    VALUES (
      v_checkout.barberia_id, v_plan.plan_id, v_plan.plan_price_id, 'active', 'activa',
      v_new_period_start, v_new_period_end, 'mercadopago', p_provider_payment_id
    )
    RETURNING id INTO v_subscription_id;
  ELSE
    UPDATE public.subscriptions
       SET plan_id = v_plan.plan_id,
           plan_price_id = v_plan.plan_price_id,
           status = 'active',
           estado = 'activa',
           period_start = v_new_period_start,
           period_end = v_new_period_end,
           provider = 'mercadopago',
           provider_ref = p_provider_payment_id,
           updated_at = now()
     WHERE id = v_subscription_id;
  END IF;

  INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
  VALUES (
    v_subscription_id,
    CASE WHEN v_is_new_sub THEN 'created' ELSE 'renewed' END,
    jsonb_build_object(
      'invoice_id', v_invoice_id,
      'checkout_id', v_checkout.id,
      'provider_payment_id', p_provider_payment_id,
      'provider_event_id', p_provider_event_id
    )
  );

  UPDATE public.barberias SET plan_id = v_plan.plan_id WHERE id = v_checkout.barberia_id;
  UPDATE public.billing_invoices SET subscription_id = v_subscription_id WHERE id = v_invoice_id;

  INSERT INTO public.billing_outbox (
    event_type, aggregate_type, aggregate_id, barberia_id, subscription_id,
    invoice_id, payment_transaction_id, payload, idempotency_key, correlation_id
  )
  VALUES (
    'payment_approved', 'payment', p_provider_payment_id, v_checkout.barberia_id,
    v_subscription_id, v_invoice_id, v_transaction_id,
    jsonb_build_object(
      'checkout_id', v_checkout.id,
      'provider_payment_id', p_provider_payment_id,
      'provider_event_id', p_provider_event_id,
      'provider_checkout_id', p_provider_checkout_id,
      'external_reference', p_external_reference,
      'expected_amount', v_plan.expected_amount,
      'provider_transaction_amount', p_amount,
      'expected_currency', v_plan.expected_currency,
      'provider_currency_id', p_currency_id,
      'owner_user_id', v_checkout.owner_id,
      'plan_price_id', v_plan.plan_price_id,
      'plan_code', v_plan.plan_code,
      'billing_term', v_plan.billing_term
    ),
    'payment_approved:mercadopago:' || p_provider_payment_id,
    v_checkout.id
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  UPDATE public.payment_webhook_events
     SET processed = true
   WHERE id = v_webhook.id;

  success := true;
  invoice_id := v_invoice_id;
  subscription_id := v_subscription_id;
  RETURN NEXT;
END;
$body$;

ALTER FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
ALTER FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB)
  OWNER TO CURRENT_USER;

ALTER FUNCTION public.billing_outbox_claim_batch(TEXT, INT, INT)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
ALTER FUNCTION public.billing_outbox_claim_batch(TEXT, INT, INT)
  OWNER TO CURRENT_USER;

ALTER FUNCTION public.billing_outbox_mark_processed(UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
ALTER FUNCTION public.billing_outbox_mark_processed(UUID)
  OWNER TO CURRENT_USER;

CREATE OR REPLACE FUNCTION public.billing_outbox_mark_processed(
  p_event_id UUID,
  p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
BEGIN
  UPDATE public.billing_outbox
     SET status = 'processed',
         processed_at = now(),
         locked_at = NULL,
         locked_by = NULL,
         updated_at = now()
   WHERE id = p_event_id
     AND status = 'processing'
     AND locked_by = p_worker_id;

  RETURN FOUND;
END;
$body$;
ALTER FUNCTION public.billing_outbox_mark_processed(UUID, TEXT)
  OWNER TO CURRENT_USER;

ALTER FUNCTION public.billing_outbox_mark_failed(UUID, TEXT, TEXT, INT)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
ALTER FUNCTION public.billing_outbox_mark_failed(UUID, TEXT, TEXT, INT)
  OWNER TO CURRENT_USER;

CREATE OR REPLACE FUNCTION public.billing_outbox_mark_failed(
  p_event_id UUID,
  p_worker_id TEXT,
  p_error_code TEXT,
  p_error_message TEXT,
  p_backoff_seconds INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
DECLARE
  v_attempts INT;
  v_max_attempts INT;
  v_next_retry TIMESTAMPTZ;
BEGIN
  SELECT attempt_count, max_attempts
    INTO v_attempts, v_max_attempts
  FROM public.billing_outbox
  WHERE id = p_event_id
    AND status = 'processing'
    AND locked_by = p_worker_id;

  IF v_attempts IS NULL THEN
    RETURN false;
  END IF;

  IF v_attempts < v_max_attempts THEN
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
     WHERE id = p_event_id
       AND status = 'processing'
       AND locked_by = p_worker_id;
  ELSE
    UPDATE public.billing_outbox
       SET status = 'dead_letter',
           failed_at = now(),
           locked_at = NULL,
           locked_by = NULL,
           last_error_code = p_error_code,
           last_error_message = p_error_message,
           updated_at = now()
     WHERE id = p_event_id
       AND status = 'processing'
       AND locked_by = p_worker_id;
  END IF;

  RETURN FOUND;
END;
$body$;
ALTER FUNCTION public.billing_outbox_mark_failed(UUID, TEXT, TEXT, TEXT, INT)
  OWNER TO CURRENT_USER;

ALTER FUNCTION public.billing_outbox_release_stale_locks(INT)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
ALTER FUNCTION public.billing_outbox_release_stale_locks(INT)
  OWNER TO CURRENT_USER;

ALTER FUNCTION public.billing_outbox_requeue_dead_letter(UUID)
  SECURITY DEFINER
  SET search_path = public, pg_temp;
ALTER FUNCTION public.billing_outbox_requeue_dead_letter(UUID)
  OWNER TO CURRENT_USER;

REVOKE EXECUTE ON FUNCTION public.billing_create_checkout_backend(INT, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated, ba_webhook_worker, ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_claim_batch(TEXT, INT, INT) FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_webhook_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_processed(UUID) FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_webhook_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_failed(UUID, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_webhook_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_processed(UUID, TEXT) FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_webhook_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_failed(UUID, TEXT, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_webhook_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_release_stale_locks(INT) FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_webhook_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_requeue_dead_letter(UUID) FROM PUBLIC, anon, authenticated, ba_checkout_app, ba_webhook_worker;

GRANT EXECUTE ON FUNCTION public.billing_create_checkout_backend(INT, TEXT, TEXT, INT) TO ba_checkout_app;
GRANT EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) TO ba_webhook_worker;
GRANT EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, TEXT) TO ba_webhook_worker;
GRANT EXECUTE ON FUNCTION public.billing_outbox_claim_batch(TEXT, INT, INT) TO ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_processed(UUID) FROM ba_outbox_worker;
REVOKE EXECUTE ON FUNCTION public.billing_outbox_mark_failed(UUID, TEXT, TEXT, INT) FROM ba_outbox_worker;
GRANT EXECUTE ON FUNCTION public.billing_outbox_mark_processed(UUID, TEXT) TO ba_outbox_worker;
GRANT EXECUTE ON FUNCTION public.billing_outbox_mark_failed(UUID, TEXT, TEXT, TEXT, INT) TO ba_outbox_worker;
GRANT EXECUTE ON FUNCTION public.billing_outbox_release_stale_locks(INT) TO ba_outbox_worker;
GRANT EXECUTE ON FUNCTION public.billing_outbox_requeue_dead_letter(UUID) TO ba_outbox_worker;

COMMIT;
