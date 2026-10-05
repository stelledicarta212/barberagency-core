-- Rollback Migration: 20261001_1100_pos_canonical_pricing_and_walkin_snapshot_rollback.sql
-- Restores fn_pos_registrar_pago_realizada and fn_pos_registrar_venta_mostrador to baseline 20260723_2245.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_pos_registrar_pago_realizada(
  p_barberia_id INT,
  p_cita_id INT,
  p_monto_total NUMERIC,
  p_metodo_pago TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_cita_estado TEXT;
  v_cita_barberia_id INT;
  v_pago_id INT;
  v_metodo_normalizado TEXT;
  v_has_pago BOOLEAN;
BEGIN
  IF p_monto_total IS NULL OR p_monto_total < 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'monto_negativo',
      'message', 'No se permiten montos negativos.'
    );
  END IF;

  IF LOWER(COALESCE(p_metodo_pago, '')) LIKE '%efectivo%' THEN
    v_metodo_normalizado := 'efectivo';
  ELSE
    v_metodo_normalizado := 'digital';
  END IF;

  SELECT estado, barberia_id INTO v_cita_estado, v_cita_barberia_id
  FROM public.citas
  WHERE id = p_cita_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_no_encontrada',
      'message', 'La cita especificada no existe.'
    );
  END IF;

  IF v_cita_barberia_id <> p_barberia_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_ajena',
      'message', 'La cita no pertenece a esta barbería.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.pagos WHERE cita_id = p_cita_id
  ) INTO v_has_pago;

  IF v_cita_estado = 'pagada' OR v_has_pago THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_ya_pagada',
      'message', 'La cita ya cuenta con un pago registrado.'
    );
  END IF;

  IF v_cita_estado <> 'realizada' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_no_realizada',
      'message', 'La cita debe estar en estado realizada para poder ser cobrada.'
    );
  END IF;

  INSERT INTO public.pagos (cita_id, total, metodo, pagado_en, barberia_id)
  VALUES (p_cita_id, p_monto_total, v_metodo_normalizado, NOW(), p_barberia_id)
  RETURNING id INTO v_pago_id;

  UPDATE public.citas
  SET estado = 'pagada'
  WHERE id = p_cita_id AND barberia_id = p_barberia_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Cobro registrado correctamente',
    'pago_id', v_pago_id,
    'cita_id', p_cita_id,
    'total', p_monto_total,
    'metodo', v_metodo_normalizado
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_pos_registrar_venta_mostrador(
  p_barberia_id INT,
  p_barbero_id INT,
  p_servicio_id INT,
  p_monto_total NUMERIC,
  p_metodo_pago TEXT,
  p_cliente_nombre TEXT DEFAULT 'Cliente Mostrador',
  p_cliente_tel TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_cita_id INT;
  v_pago_id INT;
  v_metodo_normalizado TEXT;
  v_slot_min INT;
  v_current_time TIME := CURRENT_TIME;
  v_hora_inicio TIME;
BEGIN
  IF p_monto_total IS NULL OR p_monto_total < 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'monto_negativo',
      'message', 'No se permiten montos negativos.'
    );
  END IF;

  IF LOWER(COALESCE(p_metodo_pago, '')) LIKE '%efectivo%' THEN
    v_metodo_normalizado := 'efectivo';
  ELSE
    v_metodo_normalizado := 'digital';
  END IF;

  SELECT slot_min
  INTO v_slot_min
  FROM public.barberias
  WHERE id = p_barberia_id;

  IF v_slot_min IS NULL OR v_slot_min < 1 OR v_slot_min > 60 THEN
    v_slot_min := 15;
  END IF;

  v_hora_inicio := make_time(
    EXTRACT(HOUR FROM v_current_time)::INT,
    (EXTRACT(MINUTE FROM v_current_time)::INT / v_slot_min) * v_slot_min,
    0
  );

  INSERT INTO public.citas (
    barberia_id,
    barbero_id,
    servicio_id,
    fecha,
    hora_inicio,
    cliente_nombre,
    cliente_tel,
    estado
  ) VALUES (
    p_barberia_id,
    p_barbero_id,
    p_servicio_id,
    CURRENT_DATE,
    v_hora_inicio,
    COALESCE(p_cliente_nombre, 'Cliente Mostrador'),
    p_cliente_tel,
    'confirmada'
  )
  RETURNING id INTO v_cita_id;

  UPDATE public.citas
  SET estado = 'en_servicio'
  WHERE id = v_cita_id
    AND barberia_id = p_barberia_id;

  UPDATE public.citas
  SET estado = 'realizada'
  WHERE id = v_cita_id
    AND barberia_id = p_barberia_id;

  INSERT INTO public.pagos (
    cita_id,
    total,
    metodo,
    pagado_en,
    barberia_id
  ) VALUES (
    v_cita_id,
    p_monto_total,
    v_metodo_normalizado,
    NOW(),
    p_barberia_id
  )
  RETURNING id INTO v_pago_id;

  UPDATE public.citas
  SET estado = 'pagada'
  WHERE id = v_cita_id
    AND barberia_id = p_barberia_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Venta de mostrador registrada correctamente',
    'cita_id', v_cita_id,
    'pago_id', v_pago_id,
    'total', p_monto_total,
    'metodo', v_metodo_normalizado
  );
END;
$$;

COMMIT;
