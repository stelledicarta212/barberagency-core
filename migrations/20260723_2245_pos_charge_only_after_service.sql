-- Migration: Additive function to enforce charging POS sales only after service is performed ('realizada')
-- Also updates fn_citas_set_y_validar trigger function to allow expanded business states:
-- ('pendiente', 'confirmada', 'en_servicio', 'realizada', 'pagada', 'cancelada', 'no_asistio')
-- Base branch: main
-- Date: 2026-07-23

-- 1. Actualizar función de trigger para permitir todos los estados de cita válidos
CREATE OR REPLACE FUNCTION public.fn_citas_set_y_validar()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_duracion_min INT;
  v_barbero_barberia INT;
  v_servicio_barberia INT;
  v_dia_semana INT;
  v_abre TIME;
  v_cierra TIME;
  v_slot_min INT;
BEGIN
  -- Estado por defecto
  IF NEW.estado IS NULL THEN
    NEW.estado := 'confirmada';
  END IF;

  IF NEW.estado NOT IN ('pendiente', 'confirmada', 'en_servicio', 'realizada', 'pagada', 'cancelada', 'no_asistio') THEN
    RAISE EXCEPTION 'Estado inválido: %', NEW.estado;
  END IF;

  -- Validar barbero si está especificado
  IF NEW.barbero_id IS NOT NULL THEN
    SELECT barberia_id
    INTO v_barbero_barberia
    FROM public.barberos
    WHERE id = NEW.barbero_id;

    IF v_barbero_barberia IS NULL THEN
      RAISE EXCEPTION 'Barbero_id % no existe', NEW.barbero_id;
    END IF;

    IF v_barbero_barberia <> NEW.barberia_id THEN
      RAISE EXCEPTION 'Barbero no pertenece a la barbería';
    END IF;
  END IF;

  -- Validar servicio y duración si está especificado
  IF NEW.servicio_id IS NOT NULL THEN
    SELECT barberia_id, duracion_min
    INTO v_servicio_barberia, v_duracion_min
    FROM public.servicios
    WHERE id = NEW.servicio_id;

    IF v_servicio_barberia IS NULL THEN
      RAISE EXCEPTION 'Servicio_id % no existe', NEW.servicio_id;
    END IF;

    IF v_servicio_barberia <> NEW.barberia_id THEN
      RAISE EXCEPTION 'Servicio no pertenece a la barbería';
    END IF;
  END IF;

  -- Obtener slot_min de la barbería
  SELECT slot_min
  INTO v_slot_min
  FROM public.barberias
  WHERE id = NEW.barberia_id;

  IF v_slot_min IS NULL THEN
    v_slot_min := 15;
  END IF;

  -- Validar malla dinámica si hora_inicio está presente
  IF NEW.hora_inicio IS NOT NULL AND (EXTRACT(MINUTE FROM NEW.hora_inicio)::INT % v_slot_min) <> 0 THEN
    RAISE EXCEPTION
      'hora_inicio % no alineada a malla de % minutos',
      NEW.hora_inicio, v_slot_min;
  END IF;

  -- Calcular hora_fin automáticamente si se tiene servicio y hora_inicio
  IF NEW.hora_inicio IS NOT NULL AND v_duracion_min IS NOT NULL THEN
    NEW.hora_fin := (NEW.hora_inicio + make_interval(mins => v_duracion_min))::time;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Crear o reemplazar función de cobro seguro POS
CREATE OR REPLACE FUNCTION public.fn_pos_registrar_pago_realizada(
  p_barberia_id INT,
  p_cita_id INT,
  p_monto_total NUMERIC,
  p_metodo_pago TEXT
) RETURNS JSONB AS $$
DECLARE
  v_cita_estado TEXT;
  v_cita_barberia_id INT;
  v_pago_id INT;
  v_metodo_normalizado TEXT;
  v_has_pago BOOLEAN;
BEGIN
  -- 1. Validar que el monto no sea negativo
  IF p_monto_total IS NULL OR p_monto_total < 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'monto_negativo',
      'message', 'No se permiten montos negativos.'
    );
  END IF;

  -- 2. Normalizar método de pago
  IF LOWER(COALESCE(p_metodo_pago, '')) LIKE '%efectivo%' THEN
    v_metodo_normalizado := 'efectivo';
  ELSE
    v_metodo_normalizado := 'digital';
  END IF;

  -- 3. Bloqueo pesimista FOR UPDATE de la cita
  SELECT estado, barberia_id INTO v_cita_estado, v_cita_barberia_id
  FROM public.citas
  WHERE id = p_cita_id
  FOR UPDATE;

  -- 4. Validar existencia de la cita
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_no_encontrada',
      'message', 'La cita especificada no existe.'
    );
  END IF;

  -- 5. Aislamiento multi-tenant por barberia_id
  IF v_cita_barberia_id <> p_barberia_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_ajena',
      'message', 'La cita no pertenece a esta barbería.'
    );
  END IF;

  -- 6. Verificar si ya existe pago para esta cita
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

  -- 7. Validar regla crítica: estado debe ser 'realizada'
  IF v_cita_estado <> 'realizada' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'cita_no_realizada',
      'message', 'La cita debe estar en estado realizada para poder ser cobrada.'
    );
  END IF;

  -- 8. Insertar pago en public.pagos (sin ON CONFLICT DO UPDATE)
  INSERT INTO public.pagos (cita_id, total, metodo, pagado_en, barberia_id)
  VALUES (p_cita_id, p_monto_total, v_metodo_normalizado, NOW(), p_barberia_id)
  RETURNING id INTO v_pago_id;

  -- 9. Transición atómica de estado a 'pagada'
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
