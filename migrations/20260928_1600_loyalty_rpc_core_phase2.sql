-- =============================================================================
-- BARBERAGENCY CORE SCHEMA CANONICALIZATION: LOYALTY MODULE (PHASE 2)
-- Migration: 20260928_1600_loyalty_rpc_core_phase2.sql
-- Description: Transactional RPC Core for Loyalty: Accrual, Redemption,
--              Reversal, and Reconciliation.
-- Features:
--   - ba_loyalty_acumular_pago(p_pago_id): Derives canonical data, enforces idempotency
--   - ba_loyalty_redeem(p_cliente_id, p_reward_id, p_cita_id, p_notas): Advisory locking, atomic debit
--   - ba_loyalty_reverse(p_ledger_id, p_motivo, p_allow_negative): Compensating movements
--   - ba_loyalty_reconciliar_pagos(p_barberia_id, p_limit): Safe batched recovery
-- Constraints: Zero modifications to public.pagos, public.citas, public.clientes_finales schemas.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ACTIVATION BOUNDARY EXTENSION ON LOYALTY CONFIG
-- -----------------------------------------------------------------------------
ALTER TABLE public.barberia_loyalty_config
  ADD COLUMN IF NOT EXISTS accrual_start_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Trigger to maintain accrual_start_at whenever program is activated
CREATE OR REPLACE FUNCTION public.fn_loyalty_config_accrual_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.accrual_start_at IS NULL THEN
      NEW.accrual_start_at = now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.activo = true AND OLD.activo = false THEN
      NEW.accrual_start_at = now();
    END IF;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loyalty_config_accrual_boundary ON public.barberia_loyalty_config;
CREATE TRIGGER trg_loyalty_config_accrual_boundary
BEFORE UPDATE OR INSERT ON public.barberia_loyalty_config
FOR EACH ROW EXECUTE FUNCTION public.fn_loyalty_config_accrual_boundary();

-- -----------------------------------------------------------------------------
-- 2. ACCRUAL RPC: public.ba_loyalty_acumular_pago
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ba_loyalty_acumular_pago(
  p_pago_id INT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 1. Cargar pago canónico
  SELECT p.id, p.barberia_id, p.cita_id, p.monto, p.estado, p.created_at
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
  IF v_cita.barberia_id <> v_pago.barberia_id THEN
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

  IF v_pago.created_at < v_config.accrual_start_at THEN
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

-- -----------------------------------------------------------------------------
-- 3. REDEMPTION RPC: public.ba_loyalty_redeem
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ba_loyalty_redeem(
  p_cliente_id INT,
  p_reward_id INT,
  p_cita_id INT DEFAULT NULL,
  p_notas TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid INT;
  v_is_authorized BOOLEAN := false;
  v_cliente RECORD;
  v_reward RECORD;
  v_config RECORD;
  v_current_balance BIGINT;
  v_redemption_id BIGINT;
  v_ledger_id BIGINT;
BEGIN
  v_caller_uid := public.jwt_user_id();

  -- 1. Validar cliente
  SELECT cf.id, cf.barberia_id
  INTO v_cliente
  FROM public.clientes_finales cf
  WHERE cf.id = p_cliente_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'customer_not_found',
      'message', 'Cliente no encontrado'
    );
  END IF;

  -- 2. Autorización por rol operativo (owner, admin, cajero del tenant)
  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = v_cliente.barberia_id
        AND b.owner_id = v_caller_uid
        AND b.deleted_at IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.barberia_miembros bm
      WHERE bm.barberia_id = v_cliente.barberia_id
        AND bm.usuario_id = v_caller_uid
        AND bm.activo = true
        AND bm.rol IN ('owner', 'admin', 'cajero')
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'unauthorized',
        'message', 'Usuario no autorizado para redimir en este tenant'
      );
    END IF;
  END IF;

  -- 3. Validar recompensa
  SELECT r.id, r.barberia_id, r.nombre, r.costo_en_sellos, r.activo
  INTO v_reward
  FROM public.loyalty_rewards r
  WHERE r.id = p_reward_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'reward_not_found',
      'message', 'Recompensa no encontrada'
    );
  END IF;

  IF v_reward.barberia_id <> v_cliente.barberia_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'cross_tenant_reward',
      'message', 'La recompensa pertenece a otra barbería'
    );
  END IF;

  IF v_reward.activo = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'reward_inactive',
      'message', 'La recompensa no se encuentra activa'
    );
  END IF;

  -- 4. Validar programa activo
  SELECT cfg.activo
  INTO v_config
  FROM public.barberia_loyalty_config cfg
  WHERE cfg.barberia_id = v_cliente.barberia_id;

  IF NOT FOUND OR v_config.activo = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'program_disabled',
      'message', 'El programa de lealtad no está activo'
    );
  END IF;

  -- 5. LOCK CONCURRENTE ATÓMICO: Serializar canjes para este cliente específico
  PERFORM pg_advisory_xact_lock(v_cliente.barberia_id, p_cliente_id);

  -- 6. Recalcular saldo canónico real bajo bloqueo transaccional
  SELECT COALESCE(SUM(l.delta), 0)
  INTO v_current_balance
  FROM public.loyalty_ledger l
  WHERE l.barberia_id = v_cliente.barberia_id
    AND l.cliente_id = p_cliente_id;

  IF v_current_balance < v_reward.costo_en_sellos THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'insufficient_balance',
      'saldo_actual', v_current_balance,
      'costo_requerido', v_reward.costo_en_sellos,
      'message', 'Saldo insuficiente para canjear la recompensa'
    );
  END IF;

  -- 7. Crear registro de canje
  INSERT INTO public.loyalty_redemptions (
    barberia_id,
    cliente_id,
    reward_id,
    costo_sellos_snapshot,
    operador_usuario_id,
    cita_id,
    notas
  ) VALUES (
    v_cliente.barberia_id,
    p_cliente_id,
    p_reward_id,
    v_reward.costo_en_sellos,
    v_caller_uid,
    p_cita_id,
    p_notas
  ) RETURNING id INTO v_redemption_id;

  -- 8. Asentar débito en ledger inmutable vinculado 1:1 a la redención
  INSERT INTO public.loyalty_ledger (
    barberia_id,
    cliente_id,
    delta,
    tipo_movimiento,
    source_type,
    source_id,
    redemption_id,
    operador_usuario_id,
    notas
  ) VALUES (
    v_cliente.barberia_id,
    p_cliente_id,
    -v_reward.costo_en_sellos,
    'canje',
    'redemption',
    v_redemption_id,
    v_redemption_id,
    v_caller_uid,
    COALESCE(p_notas, 'Canje de recompensa: ' || v_reward.nombre)
  ) RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'redeemed',
    'redemption_id', v_redemption_id,
    'ledger_id', v_ledger_id,
    'cliente_id', p_cliente_id,
    'barberia_id', v_cliente.barberia_id,
    'reward_nombre', v_reward.nombre,
    'costo_sellos', v_reward.costo_en_sellos,
    'saldo_restante', v_current_balance - v_reward.costo_en_sellos,
    'message', 'Canje completado exitosamente'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. REVERSAL RPC: public.ba_loyalty_reverse
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ba_loyalty_reverse(
  p_ledger_id BIGINT,
  p_motivo TEXT DEFAULT NULL,
  p_allow_negative BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid INT;
  v_is_authorized BOOLEAN := false;
  v_orig RECORD;
  v_existing_rev_id BIGINT;
  v_rev_delta INT;
  v_current_balance BIGINT;
  v_new_rev_id BIGINT;
BEGIN
  v_caller_uid := public.jwt_user_id();

  -- 1. Cargar movimiento original
  SELECT l.id, l.barberia_id, l.cliente_id, l.delta, l.tipo_movimiento
  INTO v_orig
  FROM public.loyalty_ledger l
  WHERE l.id = p_ledger_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'movement_not_found',
      'ledger_id', p_ledger_id,
      'message', 'Movimiento de ledger original no existe'
    );
  END IF;

  -- 2. Autorización restrictiva (solo owner o admin de la barbería)
  IF v_caller_uid IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = v_orig.barberia_id
        AND b.owner_id = v_caller_uid
        AND b.deleted_at IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.barberia_miembros bm
      WHERE bm.barberia_id = v_orig.barberia_id
        AND bm.usuario_id = v_caller_uid
        AND bm.activo = true
        AND bm.rol IN ('owner', 'admin')
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'unauthorized',
        'message', 'Solo el owner o administrador del tenant puede revertir movimientos'
      );
    END IF;
  END IF;

  -- 3. No permitir revertir una reversión previa
  IF v_orig.tipo_movimiento = 'reversion' THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'cannot_reverse_a_reversal',
      'message', 'No es permitido revertir un movimiento de tipo reversión'
    );
  END IF;

  -- 4. Bloquear estado de fidelización del cliente
  PERFORM pg_advisory_xact_lock(v_orig.barberia_id, v_orig.cliente_id);

  -- 5. Idempotencia de reversión
  SELECT l.id INTO v_existing_rev_id
  FROM public.loyalty_ledger l
  WHERE l.barberia_id = v_orig.barberia_id
    AND l.source_type = 'reversion'
    AND l.source_id = p_ledger_id
    AND l.tipo_movimiento = 'reversion';

  IF v_existing_rev_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_reversed',
      'reversal_ledger_id', v_existing_rev_id,
      'original_ledger_id', p_ledger_id,
      'message', 'El movimiento ya fue revertido previamente'
    );
  END IF;

  -- 6. Política contra saldo negativo (si revierte acumulación previa y el cliente ya gastó los sellos)
  v_rev_delta := -v_orig.delta;

  IF v_rev_delta < 0 THEN
    SELECT COALESCE(SUM(l.delta), 0)
    INTO v_current_balance
    FROM public.loyalty_ledger l
    WHERE l.barberia_id = v_orig.barberia_id
      AND l.cliente_id = v_orig.cliente_id;

    IF (v_current_balance + v_rev_delta) < 0 AND NOT p_allow_negative THEN
      RETURN jsonb_build_object(
        'success', false,
        'status', 'insufficient_balance_for_reversal',
        'saldo_actual', v_current_balance,
        'delta_requerido', v_rev_delta,
        'message', 'El saldo actual no cubre la reversión. Se requiere autorización explícita para saldo negativo.'
      );
    END IF;
  END IF;

  -- 7. Registrar movimiento compensatorio en ledger
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
    v_orig.barberia_id,
    v_orig.cliente_id,
    v_rev_delta,
    'reversion',
    'reversion',
    p_ledger_id,
    v_caller_uid,
    COALESCE(p_motivo, 'Reversión compensatoria de movimiento #' || p_ledger_id)
  )
  ON CONFLICT (barberia_id, source_type, source_id, tipo_movimiento)
    WHERE source_id IS NOT NULL AND source_type IS NOT NULL
    DO NOTHING
  RETURNING id INTO v_new_rev_id;

  IF v_new_rev_id IS NULL THEN
    SELECT l.id INTO v_existing_rev_id
    FROM public.loyalty_ledger l
    WHERE l.barberia_id = v_orig.barberia_id
      AND l.source_type = 'reversion'
      AND l.source_id = p_ledger_id
      AND l.tipo_movimiento = 'reversion';

    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_reversed',
      'reversal_ledger_id', v_existing_rev_id,
      'original_ledger_id', p_ledger_id,
      'message', 'Reversión ejecutada concurrentemente'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'reversed',
    'reversal_ledger_id', v_new_rev_id,
    'original_ledger_id', p_ledger_id,
    'delta', v_rev_delta,
    'message', 'Reversión compensatoria registrada exitosamente'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. RECONCILIATION RPC: public.ba_loyalty_reconciliar_pagos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ba_loyalty_reconciliar_pagos(
  p_barberia_id INT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_uid INT;
  v_is_authorized BOOLEAN := false;
  r_pago RECORD;
  v_res jsonb;
  v_processed INT := 0;
  v_credited INT := 0;
  v_already_credited INT := 0;
  v_skipped INT := 0;
  v_failed INT := 0;
  v_details jsonb := '[]'::jsonb;
BEGIN
  v_caller_uid := public.jwt_user_id();

  -- 1. Autorización: si se especifica tenant, debe ser owner o admin
  IF v_caller_uid IS NOT NULL AND p_barberia_id IS NOT NULL THEN
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
  END IF;

  -- 2. Identificar candidatos canónicos elegibles que aún no tengan acumulación en el ledger
  FOR r_pago IN
    SELECT p.id AS pago_id, p.barberia_id
    FROM public.pagos p
    JOIN public.citas c ON c.id = p.cita_id
    JOIN public.barberia_loyalty_config cfg ON cfg.barberia_id = p.barberia_id
    WHERE c.estado = 'pagada'
      AND c.cliente_id IS NOT NULL
      AND p.barberia_id = c.barberia_id
      AND cfg.activo = true
      AND p.created_at >= cfg.accrual_start_at
      AND (p_barberia_id IS NULL OR p.barberia_id = p_barberia_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.loyalty_ledger l
        WHERE l.barberia_id = p.barberia_id
          AND l.source_type = 'pago'
          AND l.source_id = p.id
          AND l.tipo_movimiento = 'acumulacion'
      )
    ORDER BY p.id ASC
    LIMIT p_limit
  LOOP
    v_processed := v_processed + 1;

    -- Aislamiento de fallas por subtransacción para que un pago anómalo no aborte el lote
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

-- -----------------------------------------------------------------------------
-- 6. PERMISSIONS & ROLE GRANTS ON RPCs
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.ba_loyalty_acumular_pago(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ba_loyalty_redeem(INT, INT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ba_loyalty_reverse(BIGINT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ba_loyalty_reconciliar_pagos(INT, INT) TO authenticated;

COMMIT;
