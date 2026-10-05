-- Migration: 20261001_1100_pos_canonical_pricing_and_walkin_snapshot.sql
-- Description: Enforce server-side canonical pricing in POS charging and dynamic off-peak snapshot resolution for walk-in sales.
-- Date: 2026-10-01

BEGIN;

-- 1. Actualizar fn_pos_registrar_pago_realizada para imponer citas.precio_final como autoridad soberana
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
  v_cita_precio_final NUMERIC;
  v_cita_precio_base NUMERIC;
  v_monto_efectivo NUMERIC;
  v_pago_id INT;
  v_metodo_normalizado TEXT;
  v_has_pago BOOLEAN;
BEGIN
  -- 1. Normalizar método de pago
  IF LOWER(COALESCE(p_metodo_pago, '')) LIKE '%efectivo%' THEN
    v_metodo_normalizado := 'efectivo';
  ELSE
    v_metodo_normalizado := 'digital';
  END IF;

  -- 2. Bloqueo pesimista FOR UPDATE de la cita
  SELECT estado, barberia_id, precio_final, precio_base
  INTO v_cita_estado, v_cita_barberia_id, v_cita_precio_final, v_cita_precio_base
  FROM public.citas
  WHERE id = p_cita_id
  FOR UPDATE;

  -- 3. Validar existencia de la cita
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_no_encontrada',
      'message', 'La cita especificada no existe.'
    );
  END IF;

  -- 4. Aislamiento multi-tenant por barberia_id
  IF v_cita_barberia_id <> p_barberia_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_ajena',
      'message', 'La cita no pertenece a esta barbería.'
    );
  END IF;

  -- 5. Verificar si ya existe pago para esta cita
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

  -- 6. Validar regla crítica: estado debe ser 'realizada'
  IF v_cita_estado <> 'realizada' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_no_realizada',
      'message', 'La cita debe estar en estado realizada para poder ser cobrada.'
    );
  END IF;

  -- 7. AUTORIDAD FINANCIERA SOBERANA DEL SERVIDOR
  -- El snapshot financiero inmutable de public.citas es la única fuente de verdad para el cobro.
  -- El cliente nunca puede sobreescribir ni alterar el precio canónico.
  IF v_cita_precio_final IS NOT NULL AND v_cita_precio_final > 0 THEN
    v_monto_efectivo := v_cita_precio_final;
  ELSIF v_cita_precio_base IS NOT NULL AND v_cita_precio_base > 0 THEN
    v_monto_efectivo := v_cita_precio_base;
  ELSE
    v_monto_efectivo := p_monto_total;
  END IF;

  -- 8. Validar monto efectivo no negativo
  IF v_monto_efectivo IS NULL OR v_monto_efectivo < 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'monto_negativo',
      'message', 'No se permiten montos negativos.'
    );
  END IF;

  -- 9. Insertar pago en public.pagos con el monto soberano canónico
  INSERT INTO public.pagos (cita_id, total, metodo, pagado_en, barberia_id)
  VALUES (p_cita_id, v_monto_efectivo, v_metodo_normalizado, NOW(), p_barberia_id)
  RETURNING id INTO v_pago_id;

  -- 10. Transición atómica de estado a 'pagada'
  UPDATE public.citas
  SET estado = 'pagada'
  WHERE id = p_cita_id AND barberia_id = p_barberia_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Cobro registrado correctamente',
    'pago_id', v_pago_id,
    'cita_id', p_cita_id,
    'total', v_monto_efectivo,
    'metodo', v_metodo_normalizado
  );
END;
$$;

-- 2. Actualizar fn_pos_registrar_venta_mostrador para resolver dinámicamente reglas de Tiempos Muertos
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
  v_cliente_id INT := NULL;
  v_metodo_normalizado TEXT;
  v_slot_min INT;
  v_duracion_min INT;
  v_precio_servicio NUMERIC;
  v_now_bogota TIMESTAMPTZ;
  v_current_date DATE;
  v_current_time TIME;
  v_hora_inicio TIME;
  v_hora_fin TIME;
  v_calc JSONB;
  v_precio_base NUMERIC;
  v_descuento_pct INT;
  v_descuento_val NUMERIC;
  v_precio_final NUMERIC;
  v_promo_id BIGINT;
  v_promo_snapshot JSONB;
BEGIN
  -- 1. Validar parámetros requeridos
  IF p_barberia_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'barberia_invalida',
      'message', 'barberia_id es obligatorio.'
    );
  END IF;

  IF p_servicio_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'servicio_invalido',
      'message', 'servicio_id es obligatorio.'
    );
  END IF;

  -- 2. Validar que el servicio pertenezca al tenant y obtener precio canónico base
  SELECT s.precio, s.duracion_min
  INTO v_precio_servicio, v_duracion_min
  FROM public.servicios s
  WHERE s.id = p_servicio_id AND s.barberia_id = p_barberia_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'servicio_ajeno',
      'message', 'El servicio no pertenece a esta barbería o no existe.'
    );
  END IF;

  -- 3. Validar barbero si fue especificado
  IF p_barbero_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.barberos b
      WHERE b.id = p_barbero_id AND b.barberia_id = p_barberia_id
    ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'barbero_ajeno',
        'message', 'El barbero no pertenece a esta barbería o no existe.'
      );
    END IF;
  END IF;

  -- 4. Normalizar método de pago
  IF LOWER(COALESCE(p_metodo_pago, '')) LIKE '%efectivo%' THEN
    v_metodo_normalizado := 'efectivo';
  ELSE
    v_metodo_normalizado := 'digital';
  END IF;

  -- 5. Obtener fecha y hora actual en la zona horaria canónica de BarberAgency ('America/Bogota')
  v_now_bogota := timezone('America/Bogota', now());
  v_current_date := v_now_bogota::date;
  v_current_time := v_now_bogota::time;

  -- 6. Resolver dinámicamente el precio y reglas off-peak ("Tiempos Muertos") vigentes
  v_calc := public.ba_calcular_precio_cita(
    p_barberia_id,
    p_servicio_id,
    p_barbero_id,
    v_current_date,
    v_current_time
  );

  v_precio_base := COALESCE((v_calc->>'precio_base')::numeric, v_precio_servicio);
  v_descuento_pct := COALESCE((v_calc->>'descuento_porcentaje')::int, 0);
  v_descuento_val := COALESCE((v_calc->>'descuento_valor')::numeric, 0);
  v_precio_final := COALESCE((v_calc->>'precio_final')::numeric, v_precio_base);
  v_promo_id := (v_calc->>'promocion_id')::bigint;
  v_promo_snapshot := v_calc->'promocion_snapshot';

  -- Validar que el precio final no sea negativo
  IF v_precio_final IS NULL OR v_precio_final < 0 THEN
    v_precio_final := v_precio_base;
  END IF;

  -- 7. Calcular slot_min y horas de la cita
  SELECT slot_min INTO v_slot_min
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

  IF v_duracion_min IS NULL OR v_duracion_min < 1 THEN
    v_duracion_min := 30;
  END IF;

  v_hora_fin := (v_hora_inicio + make_interval(mins => v_duracion_min))::time;

  -- 8. Asociar o registrar cliente_id si se especificó teléfono
  IF p_cliente_tel IS NOT NULL AND TRIM(p_cliente_tel) <> '' THEN
    SELECT cf.id INTO v_cliente_id
    FROM public.clientes_finales cf
    WHERE cf.barberia_id = p_barberia_id
      AND cf.telefono = TRIM(p_cliente_tel)
    LIMIT 1;

    IF v_cliente_id IS NULL AND p_cliente_nombre IS NOT NULL AND TRIM(p_cliente_nombre) <> '' THEN
      INSERT INTO public.clientes_finales (barberia_id, nombre, telefono)
      VALUES (p_barberia_id, TRIM(p_cliente_nombre), TRIM(p_cliente_tel))
      ON CONFLICT DO NOTHING
      RETURNING id INTO v_cliente_id;

      IF v_cliente_id IS NULL THEN
        SELECT cf.id INTO v_cliente_id
        FROM public.clientes_finales cf
        WHERE cf.barberia_id = p_barberia_id
          AND cf.telefono = TRIM(p_cliente_tel)
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  -- 9. Insertar cita con snapshot financiero inmutable congelado
  INSERT INTO public.citas (
    barberia_id,
    barbero_id,
    servicio_id,
    fecha,
    hora_inicio,
    hora_fin,
    cliente_nombre,
    cliente_tel,
    cliente_id,
    estado,
    precio_base,
    descuento_porcentaje,
    descuento_valor,
    precio_final,
    promocion_id,
    promocion_snapshot
  ) VALUES (
    p_barberia_id,
    p_barbero_id,
    p_servicio_id,
    v_current_date,
    v_hora_inicio,
    v_hora_fin,
    COALESCE(NULLIF(TRIM(p_cliente_nombre), ''), 'Cliente Mostrador'),
    p_cliente_tel,
    v_cliente_id,
    'confirmada',
    v_precio_base,
    v_descuento_pct,
    v_descuento_val,
    v_precio_final,
    v_promo_id,
    v_promo_snapshot
  )
  RETURNING id INTO v_cita_id;

  -- 10. Transiciones obligatorias hacia 'realizada'
  UPDATE public.citas
  SET estado = 'en_servicio'
  WHERE id = v_cita_id
    AND barberia_id = p_barberia_id;

  UPDATE public.citas
  SET estado = 'realizada'
  WHERE id = v_cita_id
    AND barberia_id = p_barberia_id;

  -- 11. Insertar pago con el precio final canónico congelado
  INSERT INTO public.pagos (
    cita_id,
    total,
    metodo,
    pagado_en,
    barberia_id
  ) VALUES (
    v_cita_id,
    v_precio_final,
    v_metodo_normalizado,
    NOW(),
    p_barberia_id
  )
  RETURNING id INTO v_pago_id;

  -- 12. Transición final a 'pagada'
  UPDATE public.citas
  SET estado = 'pagada'
  WHERE id = v_cita_id
    AND barberia_id = p_barberia_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Venta de mostrador registrada correctamente',
    'cita_id', v_cita_id,
    'pago_id', v_pago_id,
    'total', v_precio_final,
    'metodo', v_metodo_normalizado,
    'precio_base', v_precio_base,
    'descuento_porcentaje', v_descuento_pct,
    'descuento_valor', v_descuento_val,
    'promocion_id', v_promo_id
  );
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.fn_pos_registrar_pago_realizada(INT, INT, NUMERIC, TEXT) TO authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.fn_pos_registrar_venta_mostrador(INT, INT, INT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role, postgres;

COMMIT;
