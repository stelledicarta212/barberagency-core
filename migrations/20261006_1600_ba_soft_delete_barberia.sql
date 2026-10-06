-- ==============================================================================
-- MIGRATION: 20261006_1600_ba_soft_delete_barberia.sql
-- DESCRIPTION: Safe multi-tenant soft-delete RPC for barberias.
--              Ensures:
--              1. Strict ownership authentication (owner_id or super_admin).
--              2. Active entitlement protection (blocks PAID_ACTIVE, TRIAL_ACTIVE,
--                 TRIAL_EXPIRING, ACTIVATION_PENDING).
--              3. Atomic soft delete setting deleted_at = clock_timestamp().
--              4. Historical preservation (citas, pagos, loyalty, billing untouched).
--              5. Idempotent behavior on already-deleted barberias.
--              6. Fail closed on invalid inputs, missing barberia, or unauthorized users.
-- ==============================================================================

BEGIN;

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
  v_user_role text := NULL;
  v_barberia_exists boolean := false;
  v_current_deleted_at timestamptz := NULL;
  v_owner_id integer := NULL;
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

  -- 2. Validate authenticated user exists
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

  -- 3. Check target barberia existence and deleted status
  SELECT true, b.deleted_at, b.owner_id
  INTO v_barberia_exists, v_current_deleted_at, v_owner_id
  FROM public.barberias b
  WHERE b.id = p_barberia_id;

  IF NOT COALESCE(v_barberia_exists, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'barberia_not_found',
      'message', 'La barbería no existe.'
    );
  END IF;

  -- 4. Idempotency: if already soft-deleted, return success without mutating
  IF v_current_deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'already_deleted',
      'message', 'La barbería ya se encuentra eliminada.',
      'barberia_id', p_barberia_id,
      'deleted_at', to_jsonb(v_current_deleted_at)
    );
  END IF;

  -- 5. Ownership verification
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

  -- 6. Active subscription & entitlement protection
  -- Call authoritative product state resolver
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

  -- 7. Execute atomic soft delete (NO physical delete, NO cascade delete)
  UPDATE public.barberias
  SET deleted_at = v_now,
      publicada = false,
      estado = 'inactiva'
  WHERE id = p_barberia_id
    AND deleted_at IS NULL;

  -- Disable active QR links
  UPDATE public.qr_links
  SET active = false
  WHERE barberia_id = p_barberia_id
    AND active = true;

  -- Disable public landing
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

REVOKE ALL ON FUNCTION public.ba_soft_delete_barberia(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ba_soft_delete_barberia(integer, integer) TO anon, authenticated, ba_app, postgres;

NOTIFY pgrst, 'reload schema';

COMMIT;
