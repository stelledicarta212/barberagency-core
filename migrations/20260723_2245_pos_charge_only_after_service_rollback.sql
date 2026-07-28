-- Rollback Migration for POS Charge Only After Service
-- Restores original fn_citas_set_y_validar, drops POS functions and restores ACL permissions
-- Base branch: main

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

  IF NEW.estado NOT IN ('confirmada','pendiente','cancelada') THEN
    RAISE EXCEPTION 'Estado inválido: %', NEW.estado;
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

  IF v_abre IS NULL THEN
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

-- Restaurar owner y permisos originales de fn_citas_set_y_validar
ALTER FUNCTION public.fn_citas_set_y_validar() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.fn_citas_set_y_validar() TO PUBLIC;

-- Eliminar funciones POS adicionadas
DROP FUNCTION IF EXISTS public.fn_pos_registrar_pago_realizada(integer, integer, numeric, text);
DROP FUNCTION IF EXISTS public.fn_pos_registrar_venta_mostrador(integer, integer, integer, numeric, text, text, text);
