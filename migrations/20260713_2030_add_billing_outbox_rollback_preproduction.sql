-- =============================================================================
-- ROLLBACK PRE-PRODUCCIÓN DE LA MIGRACIÓN TRANSACTIONAL OUTBOX
-- ARCHIVO: 20260713_2030_add_billing_outbox_rollback_preproduction.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- 1. Control de Seguridad: Abortar si existen registros lógicos en la tabla outbox
DO $body$
DECLARE
  v_count INT := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'billing_outbox') THEN
    SELECT COUNT(*) INTO v_count FROM public.billing_outbox;
    
    IF v_count > 0 THEN
      RAISE EXCEPTION 'MUTATION BLOCKED: Se aborta rollback de preproducción. Se detectaron % eventos históricos en la tabla billing_outbox.', v_count;
    END IF;
  END IF;
END $body$;

-- 2. Eliminar funciones de la cola de outbox
DROP FUNCTION IF EXISTS public.billing_outbox_claim_batch(TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.billing_outbox_mark_processed(UUID);
DROP FUNCTION IF EXISTS public.billing_outbox_mark_failed(UUID, TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.billing_outbox_release_stale_locks(INT);
DROP FUNCTION IF EXISTS public.billing_outbox_requeue_dead_letter(UUID);

-- 3. Eliminar triggers e inmutabilidad
DROP TRIGGER IF EXISTS tr_block_outbox_processed_change ON public.billing_outbox;
DROP FUNCTION IF EXISTS public.fn_block_outbox_reversion();

-- 4. Eliminar la tabla physical
DROP TABLE IF EXISTS public.billing_outbox CASCADE;

-- -----------------------------------------------------------------------------
-- 5. REVERTIR LAS RPCS CORE A LA VERSIÓN V2 ORIGINAL (SIN OUTBOX)
-- -----------------------------------------------------------------------------

-- Revertir RPC 1: billing_create_checkout
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
BEGIN
  v_jwt_user := public.jwt_user_id();
  IF v_jwt_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Debe iniciar sesión para realizar esta operación.' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id INTO v_owner_id 
  FROM public.barberias 
  WHERE id = p_barberia_id AND deleted_at IS NULL;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'BARBERIA_NOT_FOUND: La barbería seleccionada no existe.' USING ERRCODE = 'P0002';
  ELSIF v_owner_id <> v_jwt_user THEN
    RAISE EXCEPTION 'UNAUTHORIZED: No tiene permisos para administrar esta barbería.' USING ERRCODE = '42501';
  END IF;

  SELECT p.amount, p.currency, p.name, p.active INTO v_price_amount, v_price_currency, v_price_name, v_price_active
  FROM public.plan_prices p
  WHERE p.id = p_plan_price_id;

  IF v_price_amount IS NULL OR v_price_active = false THEN
    RAISE EXCEPTION 'INVALID_PRICE: El plan o precio seleccionado no existe o está inactivo.' USING ERRCODE = '23514';
  END IF;

  SELECT id INTO v_checkout_id 
  FROM public.billing_checkouts
  WHERE barberia_id = p_barberia_id 
    AND plan_price_id = p_plan_price_id 
    AND status = 'created'
    AND expires_at > now()
  LIMIT 1;

  IF v_checkout_id IS NOT NULL THEN
    SELECT bc.id, bc.external_reference, v_price_amount, v_price_currency
    INTO checkout_id, external_reference, amount, currency
    FROM public.billing_checkouts bc
    WHERE bc.id = v_checkout_id;
    RETURN NEXT;
    RETURN;
  END IF;

  v_checkout_id := gen_random_uuid();
  v_expires_at := now() + interval '3 hours';
  v_external_reference := 'ba_v1_' || p_barberia_id::text || '_' || v_price_name || '_' || substring(v_checkout_id::text, 1, 8) || '_' || substring(md5(random()::text), 1, 6);
  v_idempotency_key := md5(p_barberia_id::text || '_' || p_plan_price_id::text || '_' || v_price_name || '_' || to_char(now(), 'YYYYMMDD_HH24'));

  INSERT INTO public.billing_checkouts (
    id, barberia_id, plan_price_id, status, idempotency_key, external_reference, expires_at
  )
  VALUES (
    v_checkout_id, p_barberia_id, p_plan_price_id, 'created', v_idempotency_key, v_external_reference, v_expires_at
  );

  checkout_id := v_checkout_id;
  external_reference := v_external_reference;
  amount := v_price_amount;
  currency := v_price_currency;
  
  RETURN NEXT;
END;
$body$;


-- Revertir RPC 2: billing_process_approved_payment
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
BEGIN
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

  v_ref_parts := string_to_array(p_external_reference, '_');
  IF array_length(v_ref_parts, 1) < 5 OR v_ref_parts[1] <> 'ba' OR v_ref_parts[2] <> 'v1' THEN
    RAISE EXCEPTION 'INVALID_REF: Formato incorrecto.' USING ERRCODE = '22023';
  END IF;

  v_barberia_id := v_ref_parts[3]::int;
  v_price_name := v_ref_parts[4];
  
  SELECT id, plan_price_id INTO v_checkout_id, v_plan_price_id
  FROM public.billing_checkouts
  WHERE external_reference = p_external_reference;

  IF v_checkout_id IS NULL THEN
    RAISE EXCEPTION 'CHECKOUT_NOT_FOUND: No se encontró checkout.' USING ERRCODE = 'P0002';
  END IF;

  SELECT plan_id, amount, currency, interval_type, interval_count
  INTO v_plan_id, v_expected_amount, v_expected_currency, v_interval_type, v_interval_count
  FROM public.plan_prices
  WHERE id = v_plan_price_id;

  IF p_amount < v_expected_amount THEN
    RAISE EXCEPTION 'FRAUD_DETECTION: Monto menor al esperado.' USING ERRCODE = '23514';
  END IF;

  SELECT id INTO v_invoice_id 
  FROM public.billing_invoices 
  WHERE barberia_id = v_barberia_id AND metadata->>'checkout_id' = v_checkout_id::text
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    v_invoice_id := gen_random_uuid();
    INSERT INTO public.billing_invoices (
      id, barberia_id, amount, currency, status, due_date, paid_at, metadata
    )
    VALUES (
      v_invoice_id, v_barberia_id, v_expected_amount, v_expected_currency, 'paid', now(), now(), jsonb_build_object('checkout_id', v_checkout_id)
    );
  ELSE
    UPDATE public.billing_invoices 
    SET status = 'paid', paid_at = now(), updated_at = now() 
    WHERE id = v_invoice_id;
  END IF;

  v_attempt_id := gen_random_uuid();
  INSERT INTO public.payment_attempts (
    id, barberia_id, invoice_id, amount, currency, provider, provider_ref, status
  )
  VALUES (
    v_attempt_id, v_barberia_id, v_invoice_id, p_amount, v_expected_currency, 'mercadopago', p_provider_payment_id, 'approved'
  );

  INSERT INTO public.payment_transactions (
    id, payment_attempt_id, provider, provider_payment_id, amount_paid, fee_amount, payment_method_type
  )
  VALUES (
    gen_random_uuid(), v_attempt_id, 'mercadopago', p_provider_payment_id, p_amount, p_fee, p_method
  );

  UPDATE public.billing_checkouts 
  SET status = 'completed' 
  WHERE id = v_checkout_id;

  SELECT id, status, period_end INTO v_subscription_id, v_sub_status, v_current_period_end
  FROM public.subscriptions
  WHERE barberia_id = v_barberia_id AND status IN ('active', 'trialing', 'past_due', 'paused')
  LIMIT 1;

  IF v_subscription_id IS NOT NULL AND v_current_period_end > now() THEN
    v_new_period_start := v_current_period_end;
    v_new_period_end := v_current_period_end + (v_interval_count::text || ' ' || v_interval_type)::interval;
  ELSE
    v_new_period_start := now();
    v_new_period_end := now() + (v_interval_count::text || ' ' || v_interval_type)::interval;
  END IF;

  IF v_subscription_id IS NULL THEN
    INSERT INTO public.subscriptions (
      barberia_id, plan_id, plan_price_id, status, estado, period_start, period_end, provider, provider_ref
    )
    VALUES (
      v_barberia_id, v_plan_id, v_plan_price_id, 'active', 'activa', v_new_period_start, v_new_period_end, 'mercadopago', p_provider_payment_id
    )
    RETURNING id INTO v_subscription_id;
    
    INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
    VALUES (v_subscription_id, 'created', jsonb_build_object('invoice_id', v_invoice_id));
  ELSE
    UPDATE public.subscriptions 
    SET plan_id = v_plan_id,
        plan_price_id = v_plan_price_id,
        status = 'active',
        estado = 'activa',
        period_start = v_new_period_start,
        period_end = v_new_period_end,
        provider = 'mercadopago',
        provider_ref = p_provider_payment_id,
        updated_at = now()
    WHERE id = v_subscription_id;

    INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
    VALUES (v_subscription_id, 'renewed', jsonb_build_object('invoice_id', v_invoice_id));
  END IF;

  UPDATE public.barberias SET plan_id = v_plan_id WHERE id = v_barberia_id;
  UPDATE public.billing_invoices SET subscription_id = v_subscription_id WHERE id = v_invoice_id;

  INSERT INTO public.billing_audit_logs (actor_type, barberia_id, entity_type, entity_id, action)
  VALUES ('system', v_barberia_id, 'subscriptions', v_subscription_id::text, 'payment_conciliation');

  success := true;
  invoice_id := v_invoice_id;
  subscription_id := v_subscription_id;
  
  RETURN NEXT;
END;
$body$;

COMMIT;
