-- =============================================================================
-- MIGRACIÓN DE RPC TRANSACCIONALES CORE DE PAGOS
-- ARCHIVO: 20260713_2029_billing_rpc_core.sql
-- ESTADO: SOLO LECTURA (NO EJECUTAR DIRECTAMENTE)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) RPC: billing_create_checkout
-- -----------------------------------------------------------------------------
-- Propósito: Inicia de forma segura una intención de checkout verificando 
-- propiedad del tenant y vigencia del precio.
-- RLS/PostgREST: Invocada directamente por el usuario autenticado (ba_session).
-- -----------------------------------------------------------------------------
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
SECURITY DEFINER -- Se ejecuta bajo los privilegios del rol invocador
SET search_path = public -- Previene secuestros de search_path
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
  -- 1. Validar sesión JWT activa
  v_jwt_user := public.jwt_user_id();
  IF v_jwt_user IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Debe iniciar sesión para realizar esta operación.' USING ERRCODE = '42501';
  END IF;

  -- 2. Validar que la barbería existe y pertenece al usuario autenticado
  SELECT owner_id INTO v_owner_id 
  FROM public.barberias 
  WHERE id = p_barberia_id AND deleted_at IS NULL;
  
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'BARBERIA_NOT_FOUND: La barbería seleccionada no existe.' USING ERRCODE = 'P0002';
  ELSIF v_owner_id <> v_jwt_user THEN
    RAISE EXCEPTION 'UNAUTHORIZED: No tiene permisos para administrar esta barbería.' USING ERRCODE = '42501';
  END IF;

  -- 3. Consultar y verificar el precio comercial
  SELECT p.amount, p.currency, p.name, p.active INTO v_price_amount, v_price_currency, v_price_name, v_price_active
  FROM public.plan_prices p
  WHERE p.id = p_plan_price_id;

  IF v_price_amount IS NULL OR v_price_active = false THEN
    RAISE EXCEPTION 'INVALID_PRICE: El plan o precio seleccionado no existe o está inactivo.' USING ERRCODE = '23514';
  END IF;

  -- 4. Evitar checkouts activos concurrentes idénticos (dentro de la misma hora)
  SELECT id INTO v_checkout_id 
  FROM public.billing_checkouts
  WHERE barberia_id = p_barberia_id 
    AND plan_price_id = p_plan_price_id 
    AND status = 'created'
    AND expires_at > now()
  LIMIT 1;

  IF v_checkout_id IS NOT NULL THEN
    -- Si ya existe una intención idéntica vigente, la reutiliza para evitar spam de links de cobro
    SELECT bc.id, bc.external_reference, v_price_amount, v_price_currency
    INTO checkout_id, external_reference, amount, currency
    FROM public.billing_checkouts bc
    WHERE bc.id = v_checkout_id;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 5. Generar identificadores y referencias seguras
  v_checkout_id := gen_random_uuid();
  v_expires_at := now() + interval '3 hours'; -- Expiración del link a las 3 horas
  
  -- external_reference estructurada: ba_v1_{barberia_id}_{billing_term}_{checkout_id}_{random_hash}
  v_external_reference := 'ba_v1_' || p_barberia_id::text || '_' || v_price_name || '_' || substring(v_checkout_id::text, 1, 8) || '_' || substring(md5(random()::text), 1, 6);
  v_idempotency_key := md5(p_barberia_id::text || '_' || p_plan_price_id::text || '_' || v_price_name || '_' || to_char(now(), 'YYYYMMDD_HH24'));

  -- 6. Insertar registro físico en billing_checkouts
  INSERT INTO public.billing_checkouts (
    id,
    barberia_id,
    plan_price_id,
    status,
    idempotency_key,
    external_reference,
    created_at,
    expires_at
  )
  VALUES (
    v_checkout_id,
    p_barberia_id,
    p_plan_price_id,
    'created',
    v_idempotency_key,
    v_external_reference,
    now(),
    v_expires_at
  );

  -- 7. Asignar variables de retorno
  checkout_id := v_checkout_id;
  external_reference := v_external_reference;
  amount := v_price_amount;
  currency := v_price_currency;
  
  RETURN NEXT;
END;
$body$;

-- -----------------------------------------------------------------------------
-- 2) RPC: billing_register_webhook
-- -----------------------------------------------------------------------------
-- Propósito: Registra y deduplica notificaciones en la tabla payment_webhook_events.
-- RLS/PostgREST: Invocada por el rol de ingestión (ba_webhook_ingestor) o superusuario.
-- Justificación SECURITY DEFINER: Debe poder escribir en logs de auditoría 
-- y validar unicidad sobre tablas backend-only sin importar el rol invocador.
-- -----------------------------------------------------------------------------
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
SECURITY DEFINER -- Se ejecuta con privilegios del creador (postgres/superuser)
SET search_path = public
AS $body$
DECLARE
  v_fallback_key TEXT;
  v_existing_id UUID;
  v_webhook_id UUID;
BEGIN
  -- 1. Calcular el hash SHA-256 del payload crudo para control de replay / fallback
  v_fallback_key := encode(digest(p_payload::text, 'sha256'), 'hex');

  -- 2. Comprobar si ya existe por ID del proveedor
  IF p_provider_event_id IS NOT NULL THEN
    SELECT id, processed INTO v_existing_id, already_processed
    FROM public.payment_webhook_events
    WHERE provider = p_provider AND provider_event_id = p_provider_event_id;
    
    IF v_existing_id IS NOT NULL THEN
      webhook_id := v_existing_id;
      RETURN NEXT;
      RETURN;
    END IF;
  ELSE
    -- Comprobar si ya existe por fallback_key (si no hay ID del proveedor)
    SELECT id, processed INTO v_existing_id, already_processed
    FROM public.payment_webhook_events
    WHERE provider = p_provider AND fallback_key = v_fallback_key;
    
    IF v_existing_id IS NOT NULL THEN
      webhook_id := v_existing_id;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- 3. Insertar nuevo evento crudo
  v_webhook_id := gen_random_uuid();
  INSERT INTO public.payment_webhook_events (
    id,
    provider,
    provider_event_id,
    fallback_key,
    event_type,
    payload,
    processed,
    created_at
  )
  VALUES (
    v_webhook_id,
    p_provider,
    p_provider_event_id,
    v_fallback_key,
    p_event_type,
    p_payload,
    false,
    now()
  );

  webhook_id := v_webhook_id;
  already_processed := false;
  
  RETURN NEXT;
END;
$body$;

-- -----------------------------------------------------------------------------
-- 3) RPC: billing_process_approved_payment
-- -----------------------------------------------------------------------------
-- Propósito: Procesa la confirmación física del pago. Realiza los asientos en 
-- facturación, cobros, RLS e inicia o extiende la suscripción.
-- RLS/PostgREST: Ejecución restringida exclusivamente a backend (ba_billing_worker / postgres).
-- Isolation Level: Serializable para prevenir concurrencias ante doble webhook.
-- -----------------------------------------------------------------------------
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
SECURITY INVOKER -- Debe ejecutarse con el rol autorizado del backend worker
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
  v_idempotency_key TEXT;
BEGIN
  -- 1. Control de Idempotencia física (Evita procesar dos veces el mismo pago)
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
  
  -- Validar formato mínimo (ba_v1_{barberia_id}_{billing_term}_{checkout_id_part}_{hash})
  IF array_length(v_ref_parts, 1) < 5 OR v_ref_parts[1] <> 'ba' OR v_ref_parts[2] <> 'v1' THEN
    RAISE EXCEPTION 'INVALID_REF: Formato de external_reference inválido o desconocido.' USING ERRCODE = '22023';
  END IF;

  v_barberia_id := v_ref_parts[3]::int;
  v_price_name := v_ref_parts[4];
  
  -- Buscar intención de checkout original
  SELECT id, plan_price_id INTO v_checkout_id, v_plan_price_id
  FROM public.billing_checkouts
  WHERE external_reference = p_external_reference;

  IF v_checkout_id IS NULL THEN
    RAISE EXCEPTION 'CHECKOUT_NOT_FOUND: No se encontró checkout para la referencia dada.' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Obtener el precio y plan comercial esperado
  SELECT plan_id, amount, currency, interval_type, interval_count
  INTO v_plan_id, v_expected_amount, v_expected_currency, v_interval_type, v_interval_count
  FROM public.plan_prices
  WHERE id = v_plan_price_id;

  -- 4. Validación estricta del monto recibido vs monto esperado de base de datos
  IF p_amount < v_expected_amount THEN
    RAISE EXCEPTION 'FRAUD_DETECTION: El monto pagado (%) es inferior al monto del plan (%).', p_amount, v_expected_amount USING ERRCODE = '23514';
  END IF;

  -- 5. Crear la Factura en base de datos si no existe asociada al checkout
  SELECT id INTO v_invoice_id 
  FROM public.billing_invoices 
  WHERE barberia_id = v_barberia_id AND metadata->>'checkout_id' = v_checkout_id::text
  LIMIT 1;

  IF v_invoice_id IS NULL THEN
    v_invoice_id := gen_random_uuid();
    INSERT INTO public.billing_invoices (
      id,
      barberia_id,
      amount,
      currency,
      status,
      due_date,
      paid_at,
      metadata
    )
    VALUES (
      v_invoice_id,
      v_barberia_id,
      v_expected_amount,
      v_expected_currency,
      'paid', -- Se inserta directamente como pagada al conciliar el webhook
      now(),
      now(),
      jsonb_build_object('checkout_id', v_checkout_id, 'external_reference', p_external_reference)
    );
  ELSE
    -- Actualizar factura preexistente a cobrada
    UPDATE public.billing_invoices 
    SET status = 'paid', paid_at = now(), updated_at = now() 
    WHERE id = v_invoice_id;
  END IF;

  -- 6. Crear el Intento de Pago asociado
  v_attempt_id := gen_random_uuid();
  INSERT INTO public.payment_attempts (
    id,
    barberia_id,
    invoice_id,
    amount,
    currency,
    provider,
    provider_ref,
    status
  )
  VALUES (
    v_attempt_id,
    v_barberia_id,
    v_invoice_id,
    p_amount,
    v_expected_currency,
    'mercadopago',
    p_provider_payment_id,
    'approved'
  );

  -- 7. Registrar la Transacción física aprobada
  INSERT INTO public.payment_transactions (
    id,
    payment_attempt_id,
    provider,
    provider_payment_id,
    amount_paid,
    fee_amount,
    payment_method_type,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    v_attempt_id,
    'mercadopago',
    p_provider_payment_id,
    p_amount,
    p_fee,
    p_method,
    now()
  );

  -- 8. Actualizar estado de la Intención de checkout original
  UPDATE public.billing_checkouts 
  SET status = 'completed' 
  WHERE id = v_checkout_id;

  -- ===========================================================================
  -- 9. ARITMÉTICA Y CÁLCULO DE PERIODOS DE SUSCRIPCIÓN
  -- ===========================================================================
  
  -- Buscar si existe una suscripción activa previa para este inquilino
  SELECT id, status, period_end INTO v_subscription_id, v_sub_status, v_current_period_end
  FROM public.subscriptions
  WHERE barberia_id = v_barberia_id AND status IN ('active', 'trialing', 'past_due', 'paused')
  LIMIT 1;

  -- Calcular el intervalo de extensión SQL de forma segura
  -- (v_interval_type es 'month' o 'year', v_interval_count es la cantidad)
  IF v_subscription_id IS NOT NULL AND v_current_period_end > now() THEN
    -- A. Renovación antes de vencer: Acumular periodo desde el vencimiento anterior
    v_new_period_start := v_current_period_end;
    v_new_period_end := v_current_period_end + (v_interval_count::text || ' ' || v_interval_type)::interval;
  ELSE
    -- B. Compra inicial o renovación después de vencido: Iniciar desde el segundo del pago
    v_new_period_start := now();
    v_new_period_end := now() + (v_interval_count::text || ' ' || v_interval_type)::interval;
  END IF;

  -- 10. Upsert sobre public.subscriptions manteniendo compatibilidad de estado legacy
  IF v_subscription_id IS NULL THEN
    INSERT INTO public.subscriptions (
      barberia_id,
      plan_id,
      plan_price_id,
      status,
      estado, -- Columna obsoleta legacy requerida por tiene_acceso()
      period_start,
      period_end,
      provider,
      provider_ref,
      created_at,
      updated_at
    )
    VALUES (
      v_barberia_id,
      v_plan_id,
      v_plan_price_id,
      'active',
      'activa', -- Escribe el valor legacy requerido para no romper tiene_acceso()
      v_new_period_start,
      v_new_period_end,
      'mercadopago',
      p_provider_payment_id,
      now(),
      now()
    )
    RETURNING id INTO v_subscription_id;
    
    -- Registrar evento histórico de creación
    INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
    VALUES (v_subscription_id, 'created', jsonb_build_object('plan_price_id', v_plan_price_id, 'invoice_id', v_invoice_id));
  ELSE
    -- Actualizar e incrementar vigencia de suscripción existente
    UPDATE public.subscriptions 
    SET plan_id = v_plan_id,
        plan_price_id = v_plan_price_id,
        status = 'active',
        estado = 'activa', -- Mantiene compatibilidad
        period_start = v_new_period_start,
        period_end = v_new_period_end,
        provider = 'mercadopago',
        provider_ref = p_provider_payment_id,
        updated_at = now()
    WHERE id = v_subscription_id;

    -- Registrar evento histórico de renovación
    INSERT INTO public.subscription_events (subscription_id, event_type, metadata)
    VALUES (v_subscription_id, 'renewed', jsonb_build_object('plan_price_id', v_plan_price_id, 'invoice_id', v_invoice_id));
  END IF;

  -- 11. Actualizar el plan_id en la tabla barberias para sincronizar caché
  UPDATE public.barberias 
  SET plan_id = v_plan_id 
  WHERE id = v_barberia_id;

  -- 12. Asociar el ID de la suscripción creada a la factura para auditorías
  UPDATE public.billing_invoices 
  SET subscription_id = v_subscription_id 
  WHERE id = v_invoice_id;

  -- 13. Escribir log inmutable de auditoría
  INSERT INTO public.billing_audit_logs (actor_type, barberia_id, entity_type, entity_id, action, new_values)
  VALUES ('system', v_barberia_id, 'subscriptions', v_subscription_id::text, 'payment_conciliation', jsonb_build_object('invoice_id', v_invoice_id, 'provider_payment_id', p_provider_payment_id));

  success := true;
  invoice_id := v_invoice_id;
  subscription_id := v_subscription_id;
  
  RETURN NEXT;
END;
$body$;

COMMIT;
