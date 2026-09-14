-- ==============================================================================
-- MIGRATION: 20260912_1000_canonical_barberia_product_state_v1.sql
-- DESCRIPTION: Canonical per-barberia product state & entitlement resolver.
--              Resolves authoritative subscription, license, and entitlement
--              strictly for the selected barberia (tenant-scoped).
--              Fails closed on unauthorized tenant access.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ba_resolve_barberia_product_state(
  p_user_id integer,
  p_barberia_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_authorized boolean := false;
  v_user_role text := NULL;
  v_user_email text := NULL;
  v_subscription_state text := 'ZERO_BARBERIA';
  v_plan_code text := NULL;
  v_plan_name text := NULL;
  v_billing_term text := NULL;
  v_period_start timestamptz := NULL;
  v_period_end timestamptz := NULL;
  v_days_remaining integer := NULL;
  v_paid_found boolean := false;
  v_pending_found boolean := false;
  v_starter_found boolean := false;
  v_now timestamptz := clock_timestamp();
BEGIN
  -- 1. Fail closed on missing/invalid input
  IF p_user_id IS NULL OR p_user_id <= 0 OR p_barberia_id IS NULL OR p_barberia_id <= 0 THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'barberia_id', p_barberia_id,
      'barberia_state', 'none',
      'subscription_state', 'ZERO_BARBERIA',
      'plan_code', NULL,
      'plan_name', NULL,
      'billing_term', NULL,
      'period_start', NULL,
      'period_end', NULL,
      'days_remaining', NULL
    );
  END IF;

  -- 2. Validate user identity and role
  SELECT role, email
  INTO v_user_role, v_user_email
  FROM public.usuarios
  WHERE id = p_user_id;

  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'barberia_id', p_barberia_id,
      'barberia_state', 'none',
      'subscription_state', 'ZERO_BARBERIA',
      'plan_code', NULL,
      'plan_name', NULL,
      'billing_term', NULL,
      'period_start', NULL,
      'period_end', NULL,
      'days_remaining', NULL
    );
  END IF;

  -- 3. Verify membership / ownership / authorization for the target barberia
  IF v_user_role = 'super_admin' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = p_barberia_id AND b.deleted_at IS NULL
    ) INTO v_authorized;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = p_barberia_id
        AND b.deleted_at IS NULL
        AND (
          b.owner_id = p_user_id OR
          EXISTS (
            SELECT 1 FROM public.barberia_miembros bm
            WHERE bm.barberia_id = b.id
              AND (bm.usuario_id = p_user_id OR lower(bm.email) = lower(v_user_email))
              AND bm.activo = true
          ) OR
          EXISTS (
            SELECT 1 FROM public.barberos br
            WHERE br.barberia_id = b.id
              AND br.usuario_id = p_user_id
              AND br.activo = true
          )
        )
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object(
      'authorized', false,
      'barberia_id', p_barberia_id,
      'barberia_state', 'none',
      'subscription_state', 'ZERO_BARBERIA',
      'plan_code', NULL,
      'plan_name', NULL,
      'billing_term', NULL,
      'period_start', NULL,
      'period_end', NULL,
      'days_remaining', NULL
    );
  END IF;

  -- 4. Check for active paid subscription (has precedence over Starter)
  -- Requires canonical active status (s.estado = 'activa' OR active assigned license)
  SELECT
    true,
    'PAID_ACTIVE',
    COALESCE(p.code, 'barberagency_full'),
    COALESCE(p.nombre, 'BarberAgency'),
    COALESCE(pp.name, bl.current_period_term, 'monthly'),
    s.period_start,
    s.period_end
  INTO
    v_paid_found,
    v_subscription_state,
    v_plan_code,
    v_plan_name,
    v_billing_term,
    v_period_start,
    v_period_end
  FROM public.subscriptions s
  LEFT JOIN public.planes p ON s.plan_id = p.id
  LEFT JOIN public.plan_prices pp ON s.plan_price_id = pp.id
  LEFT JOIN public.business_licenses bl ON bl.assigned_barberia_id = s.barberia_id AND bl.status IN ('assigned', 'active')
  WHERE s.barberia_id = p_barberia_id
    AND s.plan_id <> 1
    AND (s.estado = 'activa' OR (s.status = 'active' AND bl.id IS NOT NULL))
    AND (s.period_end IS NULL OR s.period_end > v_now)
  ORDER BY s.id DESC
  LIMIT 1;

  -- If not in subscriptions table, check business_licenses table for active paid license
  IF NOT v_paid_found THEN
    SELECT
      true,
      'PAID_ACTIVE',
      COALESCE(bl.plan_code, 'barberagency_full'),
      COALESCE(p.nombre, 'BarberAgency'),
      COALESCE(bl.current_period_term, 'monthly'),
      bl.period_start,
      bl.period_end
    INTO
      v_paid_found,
      v_subscription_state,
      v_plan_code,
      v_plan_name,
      v_billing_term,
      v_period_start,
      v_period_end
    FROM public.business_licenses bl
    LEFT JOIN public.planes p ON bl.plan_code = p.code
    WHERE bl.assigned_barberia_id = p_barberia_id
      AND bl.status IN ('assigned', 'active')
      AND (bl.period_end IS NULL OR bl.period_end > v_now)
    ORDER BY bl.id DESC
    LIMIT 1;
  END IF;

  IF v_paid_found THEN
    IF v_period_end IS NOT NULL AND v_period_end > v_now THEN
      v_days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_period_end - v_now)) / 86400.0)::integer);
    ELSE
      v_days_remaining := NULL;
    END IF;

    RETURN jsonb_build_object(
      'authorized', true,
      'barberia_id', p_barberia_id,
      'barberia_state', 'single',
      'subscription_state', v_subscription_state,
      'plan_code', v_plan_code,
      'plan_name', v_plan_name,
      'billing_term', v_billing_term,
      'period_start', to_jsonb(v_period_start),
      'period_end', to_jsonb(v_period_end),
      'days_remaining', v_days_remaining
    );
  END IF;

  -- 5. Check for pending payment activation in billing_outbox
  SELECT
    true,
    COALESCE(bo.payload->>'plan_code', 'barberagency_full'),
    COALESCE(p.nombre, 'BarberAgency'),
    COALESCE(bo.payload->>'term', 'monthly')
  INTO
    v_pending_found,
    v_plan_code,
    v_plan_name,
    v_billing_term
  FROM public.billing_outbox bo
  LEFT JOIN public.planes p ON bo.payload->>'plan_code' = p.code
  WHERE bo.barberia_id = p_barberia_id
    AND bo.event_type = 'payment_approved'
    AND bo.status IN ('pending', 'processing')
    AND bo.created_at > v_now - interval '1 hour'
  ORDER BY bo.created_at DESC
  LIMIT 1;

  IF v_pending_found THEN
    RETURN jsonb_build_object(
      'authorized', true,
      'barberia_id', p_barberia_id,
      'barberia_state', 'single',
      'subscription_state', 'ACTIVATION_PENDING',
      'plan_code', v_plan_code,
      'plan_name', v_plan_name,
      'billing_term', v_billing_term,
      'period_start', NULL,
      'period_end', NULL,
      'days_remaining', NULL
    );
  END IF;

  -- 6. Check for Starter / Trial subscription
  SELECT
    true,
    s.period_start,
    s.period_end
  INTO
    v_starter_found,
    v_period_start,
    v_period_end
  FROM public.subscriptions s
  WHERE s.barberia_id = p_barberia_id
    AND s.plan_id = 1
  ORDER BY s.id DESC
  LIMIT 1;

  IF v_starter_found THEN
    v_plan_code := 'starter';
    v_plan_name := 'Starter';
    v_billing_term := NULL;

    IF v_period_end IS NOT NULL AND v_period_end > v_now THEN
      v_days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_period_end - v_now)) / 86400.0)::integer);
      IF v_days_remaining <= 2 AND v_days_remaining > 0 THEN
        v_subscription_state := 'TRIAL_EXPIRING';
      ELSE
        v_subscription_state := 'TRIAL_ACTIVE';
      END IF;
    ELSE
      v_subscription_state := 'TRIAL_EXPIRED';
      v_days_remaining := 0;
    END IF;

    RETURN jsonb_build_object(
      'authorized', true,
      'barberia_id', p_barberia_id,
      'barberia_state', 'single',
      'subscription_state', v_subscription_state,
      'plan_code', v_plan_code,
      'plan_name', v_plan_name,
      'billing_term', v_billing_term,
      'period_start', to_jsonb(v_period_start),
      'period_end', to_jsonb(v_period_end),
      'days_remaining', v_days_remaining
    );
  END IF;

  -- 7. Fallback to non-entitled TRIAL_EXPIRED
  RETURN jsonb_build_object(
    'authorized', true,
    'barberia_id', p_barberia_id,
    'barberia_state', 'single',
    'subscription_state', 'TRIAL_EXPIRED',
    'plan_code', NULL,
    'plan_name', NULL,
    'billing_term', NULL,
    'period_start', NULL,
    'period_end', NULL,
    'days_remaining', 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.ba_resolve_barberia_product_state(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ba_resolve_barberia_product_state(integer, integer) TO anon, authenticated, ba_app, postgres;

NOTIFY pgrst, 'reload schema';

COMMIT;
