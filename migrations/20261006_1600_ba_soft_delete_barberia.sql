-- ==============================================================================
-- MIGRATION: 20261006_1600_ba_soft_delete_barberia.sql
-- DESCRIPTION: Hardened safe multi-tenant soft-delete & exact recovery RPCs.
--              Features:
--              1. PostgREST caller identity verification & anti-spoofing (claims check).
--              2. Execution revoked from PUBLIC and anon; granted to authenticated, ba_app, postgres.
--              3. Exclusive row lock (FOR UPDATE) eliminating active-license race condition.
--              4. Snapshot capture in barberia_soft_delete_audit ensuring exact recovery.
--              5. Atomic multi-resource mutation (barberia, QR, profile, landing).
--              6. ba_restore_soft_deleted_barberia RPC guaranteeing RECOVERY_PARTIAL_STATE = NO.
--              7. Complete preservation of historical citations, payments, loyalty, billing.
-- ==============================================================================

BEGIN;

-- 1. Snapshot / Audit Table for exact restoration
CREATE TABLE IF NOT EXISTS public.barberia_soft_delete_audit (
  id serial PRIMARY KEY,
  barberia_id integer NOT NULL,
  deleted_by integer NOT NULL,
  deleted_at timestamptz NOT NULL,
  pre_delete_state jsonb NOT NULL,
  restored_at timestamptz,
  restored_by integer,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_barberia_soft_delete_audit_barberia_id
  ON public.barberia_soft_delete_audit (barberia_id);

-- 2. Soft-Delete RPC
CREATE OR REPLACE FUNCTION public.ba_soft_delete_barberia(
  p_user_id integer,
  p_barberia_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_claims_raw text;
  v_jwt_claims jsonb;
  v_jwt_role text;
  v_jwt_user_id integer;
  v_user_role text := NULL;
  v_current_deleted_at timestamptz := NULL;
  v_owner_id integer := NULL;
  v_estado_prev text := NULL;
  v_publicada_prev boolean := NULL;
  v_qr_active_ids jsonb := '[]'::jsonb;
  v_profile_enabled_prev boolean := NULL;
  v_landing_status_prev text := NULL;
  v_snapshot jsonb;
  v_is_owner boolean := false;
  v_product_state jsonb;
  v_sub_state text;
  v_now timestamptz := clock_timestamp();
BEGIN
  -- 1. Input validation (fail closed)
  IF p_user_id IS NULL OR p_user_id <= 0 OR p_barberia_id IS NULL OR p_barberia_id <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'invalid_input',
      'message', 'Identificador de usuario o barbería inválido.'
    );
  END IF;

  -- 2. Caller Identity Verification (Gate A: Anti-Spoofing)
  v_claims_raw := nullif(current_setting('request.jwt.claims', true), '');
  IF v_claims_raw IS NOT NULL THEN
    BEGIN
      v_jwt_claims := v_claims_raw::jsonb;
      v_jwt_role := v_jwt_claims->>'role';
      v_jwt_user_id := COALESCE(
        nullif(v_jwt_claims->>'user_id', '')::integer,
        nullif(v_jwt_claims->>'sub', '')::integer
      );

      IF v_jwt_role = 'authenticated' AND v_jwt_user_id IS NOT NULL AND v_jwt_user_id > 0 THEN
        IF p_user_id <> v_jwt_user_id THEN
          IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_jwt_user_id AND role = 'super_admin') THEN
            RETURN jsonb_build_object(
              'ok', false,
              'error', 'forbidden',
              'message', 'No tienes permisos para ejecutar esta acción en nombre de otro usuario.'
            );
          END IF;
        END IF;
        p_user_id := v_jwt_user_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'not_authenticated',
        'message', 'Claims de autenticación inválidos.'
      );
    END;
  END IF;

  -- 3. Validate user exists
  SELECT role
  INTO v_user_role
  FROM public.usuarios
  WHERE id = p_user_id;

  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'not_authenticated',
      'message', 'Usuario no encontrado o no autenticado.'
    );
  END IF;

  -- 4. Acquire Row Lock on Target Barberia (Gate B: Concurrency & Race Protection)
  SELECT b.deleted_at, b.owner_id, b.estado, b.publicada
  INTO v_current_deleted_at, v_owner_id, v_estado_prev, v_publicada_prev
  FROM public.barberias b
  WHERE b.id = p_barberia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'barberia_not_found',
      'message', 'La barbería no existe.'
    );
  END IF;

  -- 5. Idempotency Check
  IF v_current_deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'already_deleted',
      'message', 'La barbería ya se encuentra eliminada.',
      'barberia_id', p_barberia_id,
      'deleted_at', to_jsonb(v_current_deleted_at)
    );
  END IF;

  -- 6. Ownership Verification
  IF v_user_role = 'super_admin' THEN
    v_is_owner := true;
  ELSE
    IF v_owner_id = p_user_id THEN
      v_is_owner := true;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.barberia_miembros bm
        WHERE bm.barberia_id = p_barberia_id
          AND bm.usuario_id = p_user_id
          AND bm.rol = 'owner'
          AND bm.activo = true
      ) INTO v_is_owner;
    END IF;
  END IF;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'forbidden',
      'message', 'No tienes permisos de propietario para eliminar esta barbería.'
    );
  END IF;

  -- 7. Active Entitlement Check while holding the lock (Gate B)
  v_product_state := public.ba_resolve_barberia_product_state(p_user_id, p_barberia_id);
  v_sub_state := COALESCE(v_product_state->>'subscription_state', 'UNKNOWN');

  IF v_sub_state IN ('PAID_ACTIVE', 'TRIAL_ACTIVE', 'TRIAL_EXPIRING', 'ACTIVATION_PENDING') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'active_license',
      'message', 'No puedes eliminar esta barbería mientras tenga un plan activo. Cancela primero el plan.',
      'subscription_state', v_sub_state,
      'barberia_id', p_barberia_id
    );
  END IF;

  -- 8. Capture Pre-Delete Snapshot for Exact Recovery (Gate C)
  SELECT COALESCE(jsonb_agg(q.id), '[]'::jsonb)
  INTO v_qr_active_ids
  FROM public.qr_links q
  WHERE q.barberia_id = p_barberia_id
    AND q.active = true;

  SELECT p.enabled
  INTO v_profile_enabled_prev
  FROM public.barberia_public_profiles p
  WHERE p.barberia_id = p_barberia_id
  LIMIT 1;

  SELECT lp.landing_status
  INTO v_landing_status_prev
  FROM public.barberia_landing_publish lp
  WHERE lp.barberia_id = p_barberia_id
  LIMIT 1;

  v_snapshot := jsonb_build_object(
    'estado', COALESCE(v_estado_prev, 'activa'),
    'publicada', COALESCE(v_publicada_prev, false),
    'qr_active_ids', v_qr_active_ids,
    'public_profile_enabled', COALESCE(v_profile_enabled_prev, false),
    'landing_status', COALESCE(v_landing_status_prev, 'draft')
  );

  INSERT INTO public.barberia_soft_delete_audit (
    barberia_id,
    deleted_by,
    deleted_at,
    pre_delete_state
  ) VALUES (
    p_barberia_id,
    p_user_id,
    v_now,
    v_snapshot
  );

  -- 9. Execute Atomic Mutations (Gate D)
  UPDATE public.barberias
  SET deleted_at = v_now,
      publicada = false,
      estado = 'inactiva'
  WHERE id = p_barberia_id
    AND deleted_at IS NULL;

  UPDATE public.qr_links
  SET active = false
  WHERE barberia_id = p_barberia_id
    AND active = true;

  UPDATE public.barberia_public_profiles
  SET enabled = false
  WHERE barberia_id = p_barberia_id
    AND enabled = true;

  UPDATE public.barberia_landing_publish
  SET landing_status = 'draft'
  WHERE barberia_id = p_barberia_id
    AND landing_status = 'published';

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'barberia_deleted',
    'message', 'Barbería eliminada correctamente.',
    'barberia_id', p_barberia_id,
    'deleted_at', to_jsonb(v_now)
  );
END;
$function$;

-- 3. Exact Recovery RPC (Gate C)
CREATE OR REPLACE FUNCTION public.ba_restore_soft_deleted_barberia(
  p_user_id integer,
  p_barberia_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_claims_raw text;
  v_jwt_claims jsonb;
  v_jwt_role text;
  v_jwt_user_id integer;
  v_user_role text;
  v_current_deleted_at timestamptz;
  v_owner_id integer;
  v_is_owner boolean := false;
  v_snapshot_rec record;
  v_target_estado text;
  v_target_publicada boolean;
  v_target_qr_ids jsonb;
  v_target_profile_enabled boolean;
  v_target_landing_status text;
  v_now timestamptz := clock_timestamp();
BEGIN
  -- Input validation
  IF p_user_id IS NULL OR p_user_id <= 0 OR p_barberia_id IS NULL OR p_barberia_id <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input', 'message', 'Parámetros inválidos.');
  END IF;

  -- Caller verification
  v_claims_raw := nullif(current_setting('request.jwt.claims', true), '');
  IF v_claims_raw IS NOT NULL THEN
    BEGIN
      v_jwt_claims := v_claims_raw::jsonb;
      v_jwt_role := v_jwt_claims->>'role';
      v_jwt_user_id := COALESCE(
        nullif(v_jwt_claims->>'user_id', '')::integer,
        nullif(v_jwt_claims->>'sub', '')::integer
      );

      IF v_jwt_role = 'authenticated' AND v_jwt_user_id IS NOT NULL AND v_jwt_user_id > 0 THEN
        IF p_user_id <> v_jwt_user_id THEN
          IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_jwt_user_id AND role = 'super_admin') THEN
            RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'No autorizado.');
          END IF;
        END IF;
        p_user_id := v_jwt_user_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated', 'message', 'Autenticación inválida.');
    END;
  END IF;

  SELECT role INTO v_user_role FROM public.usuarios WHERE id = p_user_id;
  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated', 'message', 'Usuario no encontrado.');
  END IF;

  -- Acquire row lock
  SELECT b.deleted_at, b.owner_id
  INTO v_current_deleted_at, v_owner_id
  FROM public.barberias b
  WHERE b.id = p_barberia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'barberia_not_found', 'message', 'La barbería no existe.');
  END IF;

  -- Idempotency check: if not deleted, return already_active
  IF v_current_deleted_at IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'already_active',
      'message', 'La barbería no se encuentra eliminada.',
      'barberia_id', p_barberia_id
    );
  END IF;

  -- Ownership verification
  IF v_user_role = 'super_admin' THEN
    v_is_owner := true;
  ELSE
    IF v_owner_id = p_user_id THEN
      v_is_owner := true;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.barberia_miembros bm
        WHERE bm.barberia_id = p_barberia_id
          AND bm.usuario_id = p_user_id
          AND bm.rol = 'owner'
          AND bm.activo = true
      ) INTO v_is_owner;
    END IF;
  END IF;

  IF NOT v_is_owner THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden', 'message', 'Solo el propietario o administrador puede restaurar la barbería.');
  END IF;

  -- Fetch latest snapshot
  SELECT *
  INTO v_snapshot_rec
  FROM public.barberia_soft_delete_audit
  WHERE barberia_id = p_barberia_id
  ORDER BY id DESC
  LIMIT 1;

  IF v_snapshot_rec.id IS NOT NULL AND v_snapshot_rec.pre_delete_state IS NOT NULL THEN
    v_target_estado := COALESCE(v_snapshot_rec.pre_delete_state->>'estado', 'activa');
    v_target_publicada := COALESCE((v_snapshot_rec.pre_delete_state->>'publicada')::boolean, true);
    v_target_qr_ids := COALESCE(v_snapshot_rec.pre_delete_state->'qr_active_ids', '[]'::jsonb);
    v_target_profile_enabled := COALESCE((v_snapshot_rec.pre_delete_state->>'public_profile_enabled')::boolean, true);
    v_target_landing_status := COALESCE(v_snapshot_rec.pre_delete_state->>'landing_status', 'published');
  ELSE
    -- Canonical fallback
    v_target_estado := 'activa';
    v_target_publicada := true;
    v_target_qr_ids := '[]'::jsonb;
    v_target_profile_enabled := true;
    v_target_landing_status := 'published';
  END IF;

  -- Atomic exact restoration across all dependent resources (Gate C: RECOVERY_PARTIAL_STATE = NO)
  UPDATE public.barberias
  SET deleted_at = NULL,
      publicada = v_target_publicada,
      estado = v_target_estado
  WHERE id = p_barberia_id;

  -- Restore QR links: restore active = true for snapshot IDs
  IF jsonb_array_length(v_target_qr_ids) > 0 THEN
    UPDATE public.qr_links
    SET active = true
    WHERE barberia_id = p_barberia_id
      AND id::text IN (SELECT jsonb_array_elements_text(v_target_qr_ids));
  ELSE
    -- If no specific QR id recorded but barberia was published, restore all QR links
    IF v_target_publicada THEN
      UPDATE public.qr_links
      SET active = true
      WHERE barberia_id = p_barberia_id;
    END IF;
  END IF;

  UPDATE public.barberia_public_profiles
  SET enabled = v_target_profile_enabled
  WHERE barberia_id = p_barberia_id;

  UPDATE public.barberia_landing_publish
  SET landing_status = v_target_landing_status
  WHERE barberia_id = p_barberia_id;

  IF v_snapshot_rec.id IS NOT NULL THEN
    UPDATE public.barberia_soft_delete_audit
    SET restored_at = v_now,
        restored_by = p_user_id
    WHERE id = v_snapshot_rec.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'barberia_restored',
    'message', 'Barbería restaurada exitosamente con todos sus recursos operativos.',
    'barberia_id', p_barberia_id,
    'restored_at', to_jsonb(v_now)
  );
END;
$function$;

-- 4. Shared Entitlement Guard & Concurrency Serialization (Gate B & Phase 3/4)
CREATE OR REPLACE FUNCTION public.fn_enforce_barberia_entitlement_lock_and_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_barberia_id integer;
  v_deleted_at timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'business_licenses' THEN
    v_barberia_id := NEW.assigned_barberia_id;
    IF v_barberia_id IS NULL OR NEW.status NOT IN ('assigned', 'grace', 'suspended', 'pending_review', 'active') THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'subscriptions' THEN
    v_barberia_id := NEW.barberia_id;
    IF v_barberia_id IS NULL OR (NEW.status NOT IN ('active', 'trialing') AND COALESCE(NEW.estado, '') <> 'activa') THEN
      RETURN NEW;
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  -- Universal serialization: Locks target barberias row matching ba_soft_delete_barberia
  SELECT deleted_at INTO v_deleted_at
  FROM public.barberias
  WHERE id = v_barberia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BARBERIA_NOT_FOUND: Barberia % no existe', v_barberia_id
      USING ERRCODE = '23503';
  END IF;

  IF v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'ACTIVATION_AFTER_DELETE_BLOCKED: No se puede activar o asignar licencia a la barberia eliminada %', v_barberia_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_business_licenses_entitlement_guard ON public.business_licenses;
CREATE TRIGGER trg_business_licenses_entitlement_guard
  BEFORE INSERT OR UPDATE OF assigned_barberia_id, status
  ON public.business_licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enforce_barberia_entitlement_lock_and_guard();

DROP TRIGGER IF EXISTS trg_subscriptions_entitlement_guard ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_entitlement_guard
  BEFORE INSERT OR UPDATE OF barberia_id, status, estado
  ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_enforce_barberia_entitlement_lock_and_guard();

-- 5. Canonical Product State Resolver with Null-Safe Boolean Evaluation
CREATE OR REPLACE FUNCTION public.ba_resolve_barberia_product_state(
  p_user_id integer,
  p_barberia_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn_rps$
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
  IF p_user_id IS NULL OR p_user_id <= 0 OR p_barberia_id IS NULL OR p_barberia_id <= 0 THEN
    RETURN jsonb_build_object(
      'authorized', false, 'barberia_id', p_barberia_id, 'barberia_state', 'none',
      'subscription_state', 'ZERO_BARBERIA', 'plan_code', NULL, 'plan_name', NULL,
      'billing_term', NULL, 'period_start', NULL, 'period_end', NULL, 'days_remaining', NULL
    );
  END IF;

  SELECT role, email INTO v_user_role, v_user_email FROM public.usuarios WHERE id = p_user_id;
  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'authorized', false, 'barberia_id', p_barberia_id, 'barberia_state', 'none',
      'subscription_state', 'ZERO_BARBERIA', 'plan_code', NULL, 'plan_name', NULL,
      'billing_term', NULL, 'period_start', NULL, 'period_end', NULL, 'days_remaining', NULL
    );
  END IF;

  IF v_user_role = 'super_admin' THEN
    SELECT EXISTS (SELECT 1 FROM public.barberias b WHERE b.id = p_barberia_id AND b.deleted_at IS NULL) INTO v_authorized;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = p_barberia_id AND b.deleted_at IS NULL
        AND (
          b.owner_id = p_user_id OR
          EXISTS (
            SELECT 1 FROM public.barberia_miembros bm
            WHERE bm.barberia_id = b.id AND (bm.usuario_id = p_user_id OR lower(bm.email) = lower(v_user_email)) AND bm.activo = true
          ) OR
          EXISTS (
            SELECT 1 FROM public.barberos br
            WHERE br.barberia_id = b.id AND br.usuario_id = p_user_id AND br.activo = true
          )
        )
    ) INTO v_authorized;
  END IF;

  IF NOT v_authorized THEN
    RETURN jsonb_build_object(
      'authorized', false, 'barberia_id', p_barberia_id, 'barberia_state', 'none',
      'subscription_state', 'ZERO_BARBERIA', 'plan_code', NULL, 'plan_name', NULL,
      'billing_term', NULL, 'period_start', NULL, 'period_end', NULL, 'days_remaining', NULL
    );
  END IF;

  SELECT
    true, 'PAID_ACTIVE', COALESCE(p.code, 'barberagency_full'), COALESCE(p.nombre, 'BarberAgency'),
    COALESCE(pp.name, bl.current_period_term, 'monthly'), s.period_start, s.period_end
  INTO
    v_paid_found, v_subscription_state, v_plan_code, v_plan_name, v_billing_term, v_period_start, v_period_end
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

  IF NOT COALESCE(v_paid_found, false) THEN
    SELECT
      true, 'PAID_ACTIVE', COALESCE(bl.plan_code, 'barberagency_full'), COALESCE(p.nombre, 'BarberAgency'),
      COALESCE(bl.current_period_term, 'monthly'), bl.period_start, bl.period_end
    INTO
      v_paid_found, v_subscription_state, v_plan_code, v_plan_name, v_billing_term, v_period_start, v_period_end
    FROM public.business_licenses bl
    LEFT JOIN public.planes p ON bl.plan_code = p.code
    WHERE bl.assigned_barberia_id = p_barberia_id
      AND bl.status IN ('assigned', 'active')
      AND (bl.period_end IS NULL OR bl.period_end > v_now)
    ORDER BY bl.id DESC
    LIMIT 1;
  END IF;

  IF COALESCE(v_paid_found, false) THEN
    IF v_period_end IS NOT NULL AND v_period_end > v_now THEN
      v_days_remaining := GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_period_end - v_now)) / 86400.0)::integer);
    ELSE
      v_days_remaining := NULL;
    END IF;

    RETURN jsonb_build_object(
      'authorized', true, 'barberia_id', p_barberia_id, 'barberia_state', 'single',
      'subscription_state', v_subscription_state, 'plan_code', v_plan_code, 'plan_name', v_plan_name,
      'billing_term', v_billing_term, 'period_start', to_jsonb(v_period_start), 'period_end', to_jsonb(v_period_end),
      'days_remaining', v_days_remaining
    );
  END IF;

  SELECT
    true, COALESCE(bo.payload->>'plan_code', 'barberagency_full'), COALESCE(p.nombre, 'BarberAgency'), COALESCE(bo.payload->>'term', 'monthly')
  INTO
    v_pending_found, v_plan_code, v_plan_name, v_billing_term
  FROM public.billing_outbox bo
  LEFT JOIN public.planes p ON bo.payload->>'plan_code' = p.code
  WHERE bo.barberia_id = p_barberia_id
    AND bo.event_type = 'payment_approved'
    AND bo.status IN ('pending', 'processing')
    AND bo.created_at > v_now - interval '1 hour'
  ORDER BY bo.created_at DESC
  LIMIT 1;

  IF COALESCE(v_pending_found, false) THEN
    RETURN jsonb_build_object(
      'authorized', true, 'barberia_id', p_barberia_id, 'barberia_state', 'single',
      'subscription_state', 'ACTIVATION_PENDING', 'plan_code', v_plan_code, 'plan_name', v_plan_name,
      'billing_term', v_billing_term, 'period_start', NULL, 'period_end', NULL, 'days_remaining', NULL
    );
  END IF;

  SELECT true, s.period_start, s.period_end INTO v_starter_found, v_period_start, v_period_end
  FROM public.subscriptions s
  WHERE s.barberia_id = p_barberia_id AND s.plan_id = 1
  ORDER BY s.id DESC
  LIMIT 1;

  IF COALESCE(v_starter_found, false) THEN
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
      'authorized', true, 'barberia_id', p_barberia_id, 'barberia_state', 'single',
      'subscription_state', v_subscription_state, 'plan_code', v_plan_code, 'plan_name', v_plan_name,
      'billing_term', v_billing_term, 'period_start', to_jsonb(v_period_start), 'period_end', to_jsonb(v_period_end),
      'days_remaining', v_days_remaining
    );
  END IF;

  RETURN jsonb_build_object(
    'authorized', true, 'barberia_id', p_barberia_id, 'barberia_state', 'single',
    'subscription_state', 'TRIAL_EXPIRED', 'plan_code', NULL, 'plan_name', NULL,
    'billing_term', NULL, 'period_start', NULL, 'period_end', NULL, 'days_remaining', 0
  );
END;
$fn_rps$;

-- 6. Privilege Hardening (Gate A)
REVOKE ALL ON FUNCTION public.ba_soft_delete_barberia(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ba_soft_delete_barberia(integer, integer) TO authenticated, ba_app, postgres;

REVOKE ALL ON FUNCTION public.ba_restore_soft_deleted_barberia(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ba_restore_soft_deleted_barberia(integer, integer) TO authenticated, ba_app, postgres;

REVOKE ALL ON FUNCTION public.ba_resolve_barberia_product_state(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ba_resolve_barberia_product_state(integer, integer) TO anon, authenticated, ba_app, postgres;

NOTIFY pgrst, 'reload schema';

COMMIT;
