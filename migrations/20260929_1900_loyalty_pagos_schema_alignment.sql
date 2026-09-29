-- =============================================================================
-- BARBERAGENCY — LOYALTY SCHEMA ALIGNMENT (PAGOS CANONICAL COLUMNS)
-- Migration: 20260929_1900_loyalty_pagos_schema_alignment.sql
-- Description:
-- Fixes runtime mismatch in ba_loyalty_acumular_pago and ba_loyalty_reconciliar_pagos.
-- In production PostgreSQL, public.pagos columns are:
-- (id, cita_id, barberia_id, total, metodo, pagado_en, mp_status)
-- Previous RPC versions referenced non-existent columns: (monto, estado, created_at).
-- This migration aligns the RPC column references with the canonical schema.
-- =============================================================================

BEGIN;

-- 1. ACCRUAL RPC: public.ba_loyalty_acumular_pago (Aligned with pagos canonical columns)
CREATE OR REPLACE FUNCTION public.ba_loyalty_acumular_pago(
  p_pago_id INT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid INT;
  v_is_authorized BOOLEAN := false;
  v_pago RECORD;
  v_cita RECORD;
  v_cliente RECORD;
  v_config RECORD;
  v_existing_ledger_id BIGINT;
  v_new_ledger_id BIGINT;
BEGIN
  v_caller_uid := public.jwt_user_id();

  -- 1. Cargar pago canónico usando columnas reales de public.pagos (total, metodo, pagado_en)
  SELECT p.id, p.barberia_id, p.cita_id, p.total, p.metodo, p.pagado_en
  INTO v_pago
  FROM public.pagos p
  WHERE p.id = p_pago_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'payment_not_found',
      'pago_id', p_pago_id,
      'message', 'Pago no encontrado en fuentes canónicas'
    );
  END IF;

  -- 2. Autorización por tenant (evitar ataque cross-tenant)
  IF v_pago.barberia_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'invalid_payment_tenant',
      'pago_id', p_pago_id,
      'message', 'Pago sin barberia canonica'
    );
  END IF;

  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = v_pago.barberia_id
        AND b.owner_id = v_caller_uid
        AND b.deleted_at IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.barberia_miembros bm
      WHERE bm.barberia_id = v_pago.barberia_id
        AND bm.usuario_id = v_caller_uid
        AND bm.activo = true
        AND bm.rol IN ('owner', 'admin', 'cajero')
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'unauthorized',
        'pago_id', p_pago_id,
        'message', 'Usuario no autorizado para procesar fidelización en este tenant'
      );
    END IF;
  END IF;

  -- 3. Cargar cita vinculada
  IF v_pago.cita_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'not_eligible_no_appointment',
      'pago_id', p_pago_id,
      'message', 'Pago sin cita asociada'
    );
  END IF;

  SELECT c.id, c.barberia_id, c.cliente_id, c.estado
  INTO v_cita
  FROM public.citas c
  WHERE c.id = v_pago.cita_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'appointment_not_found',
      'pago_id', p_pago_id,
      'message', 'Cita asociada no existe'
    );
  END IF;

  -- 4. Validar consistencia de tenant pago vs cita
  IF v_cita.barberia_id IS DISTINCT FROM v_pago.barberia_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'tenant_mismatch',
      'pago_id', p_pago_id,
      'message', 'Discrepancia de tenant entre cita y pago'
    );
  END IF;

  -- 5. Validar estado de la cita canónica
  IF v_cita.estado <> 'pagada' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'appointment_not_paid',
      'pago_id', p_pago_id,
      'cita_id', v_cita.id,
      'cita_estado', v_cita.estado,
      'message', 'La cita no se encuentra en estado pagada'
    );
  END IF;

  -- 6. Validar cliente final
  IF v_cita.cliente_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'anonymous_customer',
      'pago_id', p_pago_id,
      'cita_id', v_cita.id,
      'message', 'Cita no tiene un cliente final identificado'
    );
  END IF;

  SELECT cf.id, cf.barberia_id
  INTO v_cliente
  FROM public.clientes_finales cf
  WHERE cf.id = v_cita.cliente_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'customer_not_found',
      'pago_id', p_pago_id,
      'cliente_id', v_cita.cliente_id,
      'message', 'Cliente final no existe en fuentes canónicas'
    );
  END IF;

  IF v_cliente.barberia_id <> v_pago.barberia_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'customer_tenant_mismatch',
      'pago_id', p_pago_id,
      'message', 'El cliente no pertenece al tenant del pago'
    );
  END IF;

  -- 7. Validar configuración de fidelización y frontera temporal de activación
  SELECT cfg.activo, cfg.accrual_start_at
  INTO v_config
  FROM public.barberia_loyalty_config cfg
  WHERE cfg.barberia_id = v_pago.barberia_id;

  IF NOT FOUND OR v_config.activo = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'program_disabled',
      'pago_id', p_pago_id,
      'barberia_id', v_pago.barberia_id,
      'message', 'El programa de fidelización se encuentra desactivado para esta barbería'
    );
  END IF;

  IF COALESCE(v_pago.pagado_en, now()) < v_config.accrual_start_at THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'created_before_program_start',
      'pago_id', p_pago_id,
      'barberia_id', v_pago.barberia_id,
      'message', 'Pago registrado antes de la activación del programa de fidelización'
    );
  END IF;

  -- 8. Advisory lock específico por pago para serializar concurrencia exacta
  PERFORM pg_advisory_xact_lock(hashtext('loyalty_pago:' || v_pago.barberia_id::text || ':' || v_pago.id::text));

  -- 9. Verificar idempotencia previa
  SELECT l.id INTO v_existing_ledger_id
  FROM public.loyalty_ledger l
  WHERE l.barberia_id = v_pago.barberia_id
    AND l.source_type = 'pago'
    AND l.source_id = v_pago.id
    AND l.tipo_movimiento = 'acumulacion';

  IF v_existing_ledger_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_credited',
      'ledger_id', v_existing_ledger_id,
      'cliente_id', v_cita.cliente_id,
      'barberia_id', v_pago.barberia_id,
      'pago_id', v_pago.id,
      'message', 'El pago ya se encuentra acreditado previamente en el ledger'
    );
  END IF;

  -- 10. Inserción atómica en ledger inmutable (respaldada físicamente por UNIQUE)
  INSERT INTO public.loyalty_ledger (
    barberia_id,
    cliente_id,
    delta,
    tipo_movimiento,
    source_type,
    source_id,
    operador_usuario_id,
    notas
  ) VALUES (
    v_pago.barberia_id,
    v_cita.cliente_id,
    1,
    'acumulacion',
    'pago',
    v_pago.id,
    v_caller_uid,
    'Acumulación automática por pago #' || v_pago.id
  )
  ON CONFLICT (barberia_id, source_type, source_id, tipo_movimiento)
    WHERE source_id IS NOT NULL AND source_type IS NOT NULL
    DO NOTHING
  RETURNING id INTO v_new_ledger_id;

  IF v_new_ledger_id IS NULL THEN
    SELECT l.id INTO v_existing_ledger_id
    FROM public.loyalty_ledger l
    WHERE l.barberia_id = v_pago.barberia_id
      AND l.source_type = 'pago'
      AND l.source_id = v_pago.id
      AND l.tipo_movimiento = 'acumulacion';

    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_credited',
      'ledger_id', v_existing_ledger_id,
      'cliente_id', v_cita.cliente_id,
      'barberia_id', v_pago.barberia_id,
      'pago_id', v_pago.id,
      'message', 'El pago fue acreditado concurrentemente'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'credited',
    'ledger_id', v_new_ledger_id,
    'cliente_id', v_cita.cliente_id,
    'barberia_id', v_pago.barberia_id,
    'pago_id', v_pago.id,
    'message', 'Sello acreditado exitosamente'
  );
END;
$$;

-- 2. RECONCILIATION RPC: public.ba_loyalty_reconciliar_pagos (Aligned with pagos canonical columns)
CREATE OR REPLACE FUNCTION public.ba_loyalty_reconciliar_pagos(
  p_barberia_id INT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid INT;
  v_auth_role TEXT;
  v_is_authorized BOOLEAN := false;
  r_pago RECORD;
  v_res jsonb;
  v_processed INT := 0;
  v_credited INT := 0;
  v_already_credited INT := 0;
  v_skipped INT := 0;
  v_failed INT := 0;
  v_details jsonb := '[]'::jsonb;
  v_effective_limit INT;
BEGIN
  v_caller_uid := public.jwt_user_id();
  v_auth_role := NULLIF(current_setting('request.jwt.claim.role', true), '');
  IF v_auth_role IS NULL THEN
    v_auth_role := NULLIF(current_setting('role', true), '');
  END IF;

  v_effective_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);

  -- 1. Seguridad: Si el caller es un usuario autenticado normal (no service_role ni postgres)
  IF v_caller_uid IS NOT NULL AND v_auth_role NOT IN ('service_role', 'supabase_admin', 'postgres') THEN
    IF p_barberia_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'barberia_id_required',
        'message', 'p_barberia_id es obligatorio para usuarios autenticados'
      );
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = p_barberia_id
        AND b.owner_id = v_caller_uid
        AND b.deleted_at IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.barberia_miembros bm
      WHERE bm.barberia_id = p_barberia_id
        AND bm.usuario_id = v_caller_uid
        AND bm.activo = true
        AND bm.rol IN ('owner', 'admin')
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'unauthorized',
        'message', 'No autorizado para reconciliar fidelización en esta barbería'
      );
    END IF;
  ELSIF p_barberia_id IS NULL AND v_auth_role NOT IN ('service_role', 'supabase_admin', 'postgres') AND v_caller_uid IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'unauthorized',
      'message', 'Reconciliación global reservada exclusivamente para rol de servicio'
    );
  END IF;

  -- 2. Identificar candidatos canónicos elegibles usando p.pagado_en
  FOR r_pago IN
    SELECT p.id AS pago_id, p.barberia_id
    FROM public.pagos p
    JOIN public.citas c ON c.id = p.cita_id
    JOIN public.barberia_loyalty_config cfg ON cfg.barberia_id = p.barberia_id
    WHERE c.estado = 'pagada'
      AND c.cliente_id IS NOT NULL
      AND p.barberia_id = c.barberia_id
      AND cfg.activo = true
      AND COALESCE(p.pagado_en, now()) >= cfg.accrual_start_at
      AND (p_barberia_id IS NULL OR p.barberia_id = p_barberia_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.loyalty_ledger l
        WHERE l.barberia_id = p.barberia_id
          AND l.source_type = 'pago'
          AND l.source_id = p.id
          AND l.tipo_movimiento = 'acumulacion'
      )
    ORDER BY p.id ASC
    LIMIT v_effective_limit
  LOOP
    v_processed := v_processed + 1;

    BEGIN
      v_res := public.ba_loyalty_acumular_pago(r_pago.pago_id);

      IF (v_res->>'status') = 'credited' THEN
        v_credited := v_credited + 1;
      ELSIF (v_res->>'status') = 'already_credited' THEN
        v_already_credited := v_already_credited + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;

      v_details := v_details || jsonb_build_array(v_res);
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_details := v_details || jsonb_build_array(jsonb_build_object(
        'pago_id', r_pago.pago_id,
        'status', 'error',
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'reconciliation_completed',
    'barberia_id', p_barberia_id,
    'processed', v_processed,
    'credited', v_credited,
    'already_credited', v_already_credited,
    'skipped', v_skipped,
    'failed', v_failed,
    'details', v_details
  );
END;
$$;

-- 3. PERMISOS Y ROLES
GRANT EXECUTE ON FUNCTION public.ba_loyalty_acumular_pago(INT) TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.ba_loyalty_acumular_pago(INT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.ba_loyalty_reconciliar_pagos(INT, INT) TO service_role;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
