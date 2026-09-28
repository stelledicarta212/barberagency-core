-- =============================================================================
-- BARBERAGENCY — LOYALTY PHASE 3 ROLLBACK
-- File: migrations/20260928_1700_loyalty_reconciliation_security_hardening_rollback.sql
-- Description: Restores Phase 2 baseline for ba_loyalty_reconciliar_pagos.
-- =============================================================================

BEGIN;

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

GRANT EXECUTE ON FUNCTION public.ba_loyalty_reconciliar_pagos(INT, INT) TO authenticated;

COMMIT;
