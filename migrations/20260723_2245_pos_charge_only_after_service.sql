-- Migration: Additive function to enforce charging POS sales only after service is performed ('realizada')
-- Hardened SECURITY DEFINER with search_path = pg_catalog, public
-- Enforces fn_citas_set_y_validar state transitions & strictly verifies public.pagos existence for 'pagada' state
-- Base branch: main
-- Date: 2026-07-24

-- 1. Actualizar función de trigger fn_citas_set_y_validar con todas las validaciones originales y matriz estricta de transiciones
CREATE OR REPLACE FUNCTION public.fn_citas_set_y_validar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_duracion_min INT;
  v_barbero_barberia INT;
  v_servicio_barberia INT;
  v_dia_semana INT;
  v_abre TIME;
  v_cierra TIME;
  v_slot_min INT;
  v_has_pago BOOLEAN;
BEGIN
  -- Estado por defecto en inserción
  IF NEW.estado IS NULL THEN
    NEW.estado := 'confirmada';
  END IF;

  -- Protección de estado 'pagada': Requiere obligatoriamente un registro existente en public.pagos
  IF NEW.estado = 'pagada' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pagos WHERE cita_id = NEW.id
    ) INTO v_has_pago;

    IF NOT v_has_pago THEN
      RAISE EXCEPTION 'No se permite establecer el estado pagada sin un registro de pago asociado en public.pagos';
    END IF;
  END IF;

  -- Validar transiciones estrictas de estado
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado NOT IN ('pendiente', 'confirmada') THEN
      RAISE EXCEPTION 'Estado inicial inválido para cita: %', NEW.estado;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
      IF OLD.estado = 'pendiente' AND NEW.estado NOT IN ('confirmada', 'cancelada') THEN
        RAISE EXCEPTION 'Transición de estado inválida: % -> %', OLD.estado, NEW.estado;
      ELSIF OLD.estado = 'confirmada' AND NEW.estado NOT IN ('en_servicio', 'cancelada', 'no_asistio') THEN
        RAISE EXCEPTION 'Transición de estado inválida: % -> %', OLD.estado, NEW.estado;
      ELSIF OLD.estado = 'en_servicio' AND NEW.estado NOT IN ('realizada') THEN
        RAISE EXCEPTION 'Transición de estado inválida: % -> %', OLD.estado, NEW.estado;
      ELSIF OLD.estado = 'realizada' AND NEW.estado NOT IN ('pagada') THEN
        RAISE EXCEPTION 'Transición de estado inválida: % -> %', OLD.estado, NEW.estado;
      ELSIF OLD.estado IN ('pagada', 'cancelada', 'no_asistio') THEN
        RAISE EXCEPTION 'No se permite cambiar el estado de una cita en estado final: %', OLD.estado;
      END IF;
    END IF;
  END IF;

  -- Validar que la barbería no esté desactivada (soft delete)
  IF EXISTS (
    SELECT 1 FROM public.barberias br
    WHERE br.id = NEW.barberia_id AND br.deleted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Barbería % desactivada', NEW.barberia_id;
  END IF;

  -- Validar barbero
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

  -- Validar servicio y duración
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

  -- Obtener slot_min de la barbería
  SELECT slot_min
  INTO v_slot_min
  FROM public.barberias
  WHERE id = NEW.barberia_id;

  IF v_slot_min IS NULL THEN
    v_slot_min := 15;
  END IF;

  -- Validar malla dinámica
  IF (EXTRACT(MINUTE FROM NEW.hora_inicio)::INT % v_slot_min) <> 0 THEN
    RAISE EXCEPTION
      'hora_inicio % no alineada a malla de % minutos',
      NEW.hora_inicio, v_slot_min;
  END IF;

  -- Calcular hora_fin automáticamente
  NEW.hora_fin :=
    (NEW.hora_inicio + make_interval(mins => v_duracion_min))::time;

  -- Validar horario del día
  v_dia_semana := EXTRACT(DOW FROM NEW.fecha)::INT;

  SELECT hora_abre, hora_cierra
  INTO v_abre, v_cierra
  FROM public.horarios
  WHERE barberia_id = NEW.barberia_id
    AND dia_semana = v_dia_semana
    AND activo = true;

  IF v_abre IS NULL OR v_cierra IS NULL THEN
    RAISE EXCEPTION
      'No hay horario activo para barbería % día %',
      NEW.barberia_id, v_dia_semana;
  END IF;

  IF NEW.hora_inicio < v_abre OR NEW.hora_fin > v_cierra THEN
    RAISE EXCEPTION
      'Cita fuera de horario (% - %)',
      v_abre, v_cierra;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Crear o reemplazar función de cobro seguro POS para cita agendada (SECURITY DEFINER Blindado)
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

  -- 8. Insertar pago en public.pagos PRIMERO (para satisfacer la restricción del trigger al actualizar estado)
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
$$;

-- 3. Crear función dedicada para venta de mostrador directa (sin cita agendada previa)
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
  v_hora_inicio TIME := CURRENT_TIME;
BEGIN
  -- 1. Validar monto no negativo
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

  -- 3. Crear cita en estado inicial 'confirmada'
  INSERT INTO public.citas (
    barberia_id, barbero_id, servicio_id, fecha, hora_inicio, cliente_nombre, cliente_tel, estado
  ) VALUES (
    p_barberia_id, p_barbero_id, p_servicio_id, CURRENT_DATE, v_hora_inicio, COALESCE(p_cliente_nombre, 'Cliente Mostrador'), p_cliente_tel, 'confirmada'
  ) RETURNING id INTO v_cita_id;

  -- 4. Transicionar a 'en_servicio' y luego 'realizada' respetando el ciclo de vida
  UPDATE public.citas SET estado = 'en_servicio' WHERE id = v_cita_id AND barberia_id = p_barberia_id;
  UPDATE public.citas SET estado = 'realizada' WHERE id = v_cita_id AND barberia_id = p_barberia_id;

  -- 5. Insertar pago en public.pagos
  INSERT INTO public.pagos (cita_id, total, metodo, pagado_en, barberia_id)
  VALUES (v_cita_id, p_monto_total, v_metodo_normalizado, NOW(), p_barberia_id)
  RETURNING id INTO v_pago_id;

  -- 6. Transicionar estado a 'pagada'
  UPDATE public.citas
  SET estado = 'pagada'
  WHERE id = v_cita_id AND barberia_id = p_barberia_id;

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

-- 4. Permisos mínimos y explícitos (REVOKE FROM PUBLIC, GRANT TO ROL OPERATIVO POS / POSTGRES)
REVOKE ALL ON FUNCTION public.fn_pos_registrar_pago_realizada(integer, integer, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_pos_registrar_venta_mostrador(integer, integer, integer, numeric, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fn_pos_registrar_pago_realizada(integer, integer, numeric, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.fn_pos_registrar_venta_mostrador(integer, integer, integer, numeric, text, text, text) TO postgres;
