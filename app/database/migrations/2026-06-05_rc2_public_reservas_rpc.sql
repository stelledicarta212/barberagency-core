-- RC-2 public reservations hardening
-- PostgreSQL becomes the authority for public slots and reservation creation.

BEGIN;

CREATE OR REPLACE FUNCTION public.ba_public_reserva_error(
  p_code text,
  p_message text,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $ba_rpc$
  SELECT jsonb_build_object(
    'ok', false,
    'code', p_code,
    'message', p_message,
    'data', COALESCE(p_data, '{}'::jsonb)
  );
$ba_rpc$;

CREATE OR REPLACE FUNCTION public.ba_reservas_public_slots(
  p_barberia_id int DEFAULT NULL,
  p_slug text DEFAULT NULL,
  p_servicio_id int DEFAULT NULL,
  p_barbero_id int DEFAULT NULL,
  p_fecha date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ba_rpc$
DECLARE
  v_barberia public.barberias%ROWTYPE;
  v_servicio public.servicios%ROWTYPE;
  v_barbero public.barberos%ROWTYPE;
  v_dia_semana int;
  v_abre time;
  v_cierra time;
  v_slots jsonb;
BEGIN
  IF (p_barberia_id IS NULL AND NULLIF(trim(COALESCE(p_slug, '')), '') IS NULL)
     OR p_servicio_id IS NULL
     OR p_barbero_id IS NULL
     OR p_fecha IS NULL THEN
    RETURN public.ba_public_reserva_error(
      'datos_invalidos',
      'Faltan barberia_id o slug, servicio_id, barbero_id y fecha.'
    );
  END IF;

  SELECT br.*
  INTO v_barberia
  FROM public.barberias br
  WHERE br.deleted_at IS NULL
    AND (p_barberia_id IS NULL OR br.id = p_barberia_id)
    AND (NULLIF(trim(COALESCE(p_slug, '')), '') IS NULL OR br.slug = trim(p_slug))
  LIMIT 1;

  IF v_barberia.id IS NULL THEN
    RETURN public.ba_public_reserva_error('barberia_no_encontrada', 'La barberia no existe o no esta activa.');
  END IF;

  IF COALESCE(v_barberia.estado, 'activa') <> 'activa' THEN
    RETURN public.ba_public_reserva_error('barberia_no_encontrada', 'La barberia no esta activa.');
  END IF;

  SELECT s.*
  INTO v_servicio
  FROM public.servicios s
  WHERE s.id = p_servicio_id
  LIMIT 1;

  IF v_servicio.id IS NULL OR v_servicio.barberia_id <> v_barberia.id THEN
    RETURN public.ba_public_reserva_error('servicio_no_pertenece', 'El servicio no pertenece a la barberia.');
  END IF;

  IF COALESCE(v_servicio.activo, true) <> true THEN
    RETURN public.ba_public_reserva_error('servicio_inactivo', 'El servicio no esta activo.');
  END IF;

  SELECT b.*
  INTO v_barbero
  FROM public.barberos b
  WHERE b.id = p_barbero_id
  LIMIT 1;

  IF v_barbero.id IS NULL OR v_barbero.barberia_id <> v_barberia.id THEN
    RETURN public.ba_public_reserva_error('barbero_no_pertenece', 'El barbero no pertenece a la barberia.');
  END IF;

  IF COALESCE(v_barbero.activo, true) <> true THEN
    RETURN public.ba_public_reserva_error('barbero_inactivo', 'El barbero no esta activo.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.barberos_descansos d
    WHERE d.barberia_id = v_barberia.id
      AND d.barbero_id = v_barbero.id
      AND d.fecha = p_fecha
  ) THEN
    RETURN public.ba_public_reserva_error('descanso_barbero', 'El barbero esta en descanso ese dia.');
  END IF;

  v_dia_semana := EXTRACT(DOW FROM p_fecha)::int;

  SELECT h.hora_abre, h.hora_cierra
  INTO v_abre, v_cierra
  FROM public.horarios h
  WHERE h.barberia_id = v_barberia.id
    AND h.dia_semana = v_dia_semana
    AND h.activo = true
  LIMIT 1;

  IF v_abre IS NULL OR v_cierra IS NULL THEN
    RETURN public.ba_public_reserva_error('fuera_de_horario', 'No hay horario laboral activo para ese dia.');
  END IF;

  WITH candidatos AS (
    SELECT
      (v_abre + (n * make_interval(mins => v_barberia.slot_min)))::time AS hora_inicio,
      (v_abre + (n * make_interval(mins => v_barberia.slot_min)) + make_interval(mins => v_servicio.duracion_min))::time AS hora_fin
    FROM generate_series(
      0,
      GREATEST(
        FLOOR(EXTRACT(EPOCH FROM ((v_cierra - v_abre) - make_interval(mins => v_servicio.duracion_min))) / (v_barberia.slot_min * 60))::int,
        -1
      )
    ) n
  ),
  disponibles AS (
    SELECT c.hora_inicio, c.hora_fin
    FROM candidatos c
    WHERE c.hora_inicio >= v_abre
      AND c.hora_fin <= v_cierra
      AND (
        p_fecha > (now() AT TIME ZONE 'America/Bogota')::date
        OR c.hora_inicio > (now() AT TIME ZONE 'America/Bogota')::time
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.citas ci
        WHERE ci.barberia_id = v_barberia.id
          AND ci.barbero_id = v_barbero.id
          AND ci.fecha = p_fecha
          AND ci.estado IN ('confirmada', 'pendiente')
          AND tsrange((ci.fecha + ci.hora_inicio), (ci.fecha + ci.hora_fin), '[)')
              && tsrange((p_fecha + c.hora_inicio), (p_fecha + c.hora_fin), '[)')
      )
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'barberia_id', v_barberia.id,
        'barbero_id', v_barbero.id,
        'servicio_id', v_servicio.id,
        'fecha', p_fecha,
        'hora_inicio', to_char(hora_inicio, 'HH24:MI'),
        'hora_fin', to_char(hora_fin, 'HH24:MI')
      )
      ORDER BY hora_inicio
    ),
    '[]'::jsonb
  )
  INTO v_slots
  FROM disponibles;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'slots_disponibles',
    'message', 'Slots disponibles consultados correctamente.',
    'data', jsonb_build_object(
      'barberia_id', v_barberia.id,
      'slug', v_barberia.slug,
      'servicio_id', v_servicio.id,
      'barbero_id', v_barbero.id,
      'fecha', p_fecha,
      'slot_min', v_barberia.slot_min,
      'duracion_min', v_servicio.duracion_min,
      'count', jsonb_array_length(v_slots),
      'slots', v_slots
    )
  );
END;
$ba_rpc$;

CREATE OR REPLACE FUNCTION public.ba_reservas_public_create(
  p_barberia_id int DEFAULT NULL,
  p_slug text DEFAULT NULL,
  p_servicio_id int DEFAULT NULL,
  p_barbero_id int DEFAULT NULL,
  p_fecha date DEFAULT NULL,
  p_hora time DEFAULT NULL,
  p_cliente_nombre text DEFAULT NULL,
  p_cliente_tel text DEFAULT NULL,
  p_cliente_email text DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $ba_rpc$
DECLARE
  v_barberia public.barberias%ROWTYPE;
  v_servicio public.servicios%ROWTYPE;
  v_barbero public.barberos%ROWTYPE;
  v_dia_semana int;
  v_abre time;
  v_cierra time;
  v_hora_fin time;
  v_cliente_id int;
  v_cita_id int;
  v_nombre text := NULLIF(trim(COALESCE(p_cliente_nombre, '')), '');
  v_tel text := NULLIF(trim(COALESCE(p_cliente_tel, '')), '');
BEGIN
  IF (p_barberia_id IS NULL AND NULLIF(trim(COALESCE(p_slug, '')), '') IS NULL)
     OR p_servicio_id IS NULL
     OR p_barbero_id IS NULL
     OR p_fecha IS NULL
     OR p_hora IS NULL
     OR v_nombre IS NULL
     OR v_tel IS NULL THEN
    RETURN public.ba_public_reserva_error('datos_invalidos', 'Faltan datos obligatorios para crear la reserva.');
  END IF;

  SELECT br.*
  INTO v_barberia
  FROM public.barberias br
  WHERE br.deleted_at IS NULL
    AND (p_barberia_id IS NULL OR br.id = p_barberia_id)
    AND (NULLIF(trim(COALESCE(p_slug, '')), '') IS NULL OR br.slug = trim(p_slug))
  LIMIT 1;

  IF v_barberia.id IS NULL OR COALESCE(v_barberia.estado, 'activa') <> 'activa' THEN
    RETURN public.ba_public_reserva_error('barberia_no_encontrada', 'La barberia no existe o no esta activa.');
  END IF;

  SELECT s.*
  INTO v_servicio
  FROM public.servicios s
  WHERE s.id = p_servicio_id
  LIMIT 1;

  IF v_servicio.id IS NULL OR v_servicio.barberia_id <> v_barberia.id THEN
    RETURN public.ba_public_reserva_error('servicio_no_pertenece', 'El servicio no pertenece a la barberia.');
  END IF;

  IF COALESCE(v_servicio.activo, true) <> true THEN
    RETURN public.ba_public_reserva_error('servicio_inactivo', 'El servicio no esta activo.');
  END IF;

  SELECT b.*
  INTO v_barbero
  FROM public.barberos b
  WHERE b.id = p_barbero_id
  LIMIT 1;

  IF v_barbero.id IS NULL OR v_barbero.barberia_id <> v_barberia.id THEN
    RETURN public.ba_public_reserva_error('barbero_no_pertenece', 'El barbero no pertenece a la barberia.');
  END IF;

  IF COALESCE(v_barbero.activo, true) <> true THEN
    RETURN public.ba_public_reserva_error('barbero_inactivo', 'El barbero no esta activo.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.barberos_descansos d
    WHERE d.barberia_id = v_barberia.id
      AND d.barbero_id = v_barbero.id
      AND d.fecha = p_fecha
  ) THEN
    RETURN public.ba_public_reserva_error('descanso_barbero', 'El barbero esta en descanso ese dia.');
  END IF;

  IF ((EXTRACT(HOUR FROM p_hora)::int * 60 + EXTRACT(MINUTE FROM p_hora)::int) % v_barberia.slot_min) <> 0 THEN
    RETURN public.ba_public_reserva_error('slot_invalido', 'La hora no esta alineada al slot_min de la barberia.');
  END IF;

  v_hora_fin := (p_hora + make_interval(mins => v_servicio.duracion_min))::time;
  v_dia_semana := EXTRACT(DOW FROM p_fecha)::int;

  SELECT h.hora_abre, h.hora_cierra
  INTO v_abre, v_cierra
  FROM public.horarios h
  WHERE h.barberia_id = v_barberia.id
    AND h.dia_semana = v_dia_semana
    AND h.activo = true
  LIMIT 1;

  IF v_abre IS NULL OR v_cierra IS NULL OR p_hora < v_abre OR v_hora_fin > v_cierra THEN
    RETURN public.ba_public_reserva_error('fuera_de_horario', 'La reserva esta fuera del horario laboral.');
  END IF;

  IF p_fecha < (now() AT TIME ZONE 'America/Bogota')::date
     OR (
       p_fecha = (now() AT TIME ZONE 'America/Bogota')::date
       AND p_hora <= (now() AT TIME ZONE 'America/Bogota')::time
     ) THEN
    RETURN public.ba_public_reserva_error('slot_invalido', 'No se puede reservar un slot pasado.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.citas ci
    WHERE ci.barberia_id = v_barberia.id
      AND ci.barbero_id = v_barbero.id
      AND ci.fecha = p_fecha
      AND ci.estado IN ('confirmada', 'pendiente')
      AND tsrange((ci.fecha + ci.hora_inicio), (ci.fecha + ci.hora_fin), '[)')
          && tsrange((p_fecha + p_hora), (p_fecha + v_hora_fin), '[)')
  ) THEN
    RETURN public.ba_public_reserva_error('slot_ocupado', 'El slot seleccionado ya esta ocupado.');
  END IF;

  INSERT INTO public.clientes_finales (barberia_id, nombre, telefono)
  VALUES (v_barberia.id, v_nombre, v_tel)
  ON CONFLICT (barberia_id, telefono)
  DO UPDATE SET
    nombre = EXCLUDED.nombre
  RETURNING id INTO v_cliente_id;

  BEGIN
    INSERT INTO public.citas (
      barberia_id,
      barbero_id,
      servicio_id,
      cliente_id,
      fecha,
      hora_inicio,
      hora_fin,
      cliente_nombre,
      cliente_tel,
      estado
    )
    VALUES (
      v_barberia.id,
      v_barbero.id,
      v_servicio.id,
      v_cliente_id,
      p_fecha,
      p_hora,
      v_hora_fin,
      v_nombre,
      v_tel,
      'confirmada'
    )
    RETURNING id INTO v_cita_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RETURN public.ba_public_reserva_error('slot_ocupado', 'El slot seleccionado ya esta ocupado.');
    WHEN OTHERS THEN
      RETURN public.ba_public_reserva_error(
        'datos_invalidos',
        'PostgreSQL rechazo la reserva.',
        jsonb_build_object('sqlstate', SQLSTATE, 'detail', SQLERRM)
      );
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'reserva_creada',
    'message', 'Reserva creada correctamente.',
    'data', jsonb_build_object(
      'cita_id', v_cita_id,
      'cliente_id', v_cliente_id,
      'barberia_id', v_barberia.id,
      'slug', v_barberia.slug,
      'barbero_id', v_barbero.id,
      'servicio_id', v_servicio.id,
      'fecha', p_fecha,
      'hora_inicio', to_char(p_hora, 'HH24:MI'),
      'hora_fin', to_char(v_hora_fin, 'HH24:MI'),
      'estado', 'confirmada'
    )
  );
END;
$ba_rpc$;

REVOKE ALL ON FUNCTION public.ba_public_reserva_error(text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ba_reservas_public_slots(int, text, int, int, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ba_reservas_public_create(int, text, int, int, date, time, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ba_reservas_public_slots(int, text, int, int, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ba_reservas_public_create(int, text, int, int, date, time, text, text, text, text) TO anon, authenticated;

COMMIT;
