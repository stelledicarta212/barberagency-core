BEGIN;

CREATE OR REPLACE FUNCTION public.ba_complete_onboarding_atomic(
  p_auth_ok boolean,
  p_auth_user_id integer,
  p_barberia_id integer,
  p_draft jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_draft jsonb := COALESCE(p_draft, '{}'::jsonb);
  v_barberia jsonb := COALESCE(v_draft->'barberia', '{}'::jsonb);
  v_admin jsonb := COALESCE(v_draft->'accesos'->'admin', v_draft->'admin', '{}'::jsonb);
  v_admin_email text := NULLIF(lower(trim(COALESCE(v_admin->>'email', ''))), '');
  v_admin_name text := NULLIF(trim(COALESCE(v_admin->>'nombre', '')), '');
  v_admin_password text := NULLIF(trim(COALESCE(v_admin->>'password', '')), '');
  v_requested_slug text;
  v_final_slug text;
  v_barberia_id integer;
  v_owner_email text;
  v_duplicate_barber_email text;
  v_services_count integer := 0;
  v_barbers_count integer := 0;
  v_hours_count integer := 0;
BEGIN
  IF NOT COALESCE(p_auth_ok, false) OR COALESCE(p_auth_user_id, 0) <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Sesion no valida';
  END IF;

  SELECT lower(trim(u.email)) INTO v_owner_email
  FROM public.usuarios u
  WHERE u.id = p_auth_user_id
  LIMIT 1;

  IF v_owner_email IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'Usuario de sesion no encontrado';
  END IF;

  v_admin_email := COALESCE(v_admin_email, v_owner_email);
  v_requested_slug := COALESCE(
    NULLIF(regexp_replace(lower(trim(COALESCE(v_barberia->>'slug', ''))), '[^a-z0-9]+', '-', 'g'), ''),
    NULLIF(regexp_replace(lower(trim(COALESCE(v_barberia->>'nombre', ''))), '[^a-z0-9]+', '-', 'g'), ''),
    'barberia'
  );

  SELECT normalized.email INTO v_duplicate_barber_email
  FROM (
    SELECT NULLIF(lower(trim(item->>'email')), '') AS email, count(*) AS total
    FROM jsonb_array_elements(COALESCE(v_draft->'accesos'->'barberos', '[]'::jsonb)) item
    GROUP BY NULLIF(lower(trim(item->>'email')), '')
  ) normalized
  WHERE normalized.email IS NOT NULL AND normalized.total > 1
  LIMIT 1;

  IF v_duplicate_barber_email IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Dos barberos diferentes no pueden compartir el mismo correo';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_auth_user_id::text || ':' || v_requested_slug));

  IF COALESCE(p_barberia_id, 0) > 0 THEN
    SELECT b.id, b.slug INTO v_barberia_id, v_final_slug
    FROM public.barberias b
    WHERE b.id = p_barberia_id
      AND b.owner_id = p_auth_user_id
      AND b.deleted_at IS NULL
    LIMIT 1;

    IF v_barberia_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'La barberia no pertenece al usuario de sesion';
    END IF;
  ELSE
    SELECT b.id, b.slug INTO v_barberia_id, v_final_slug
    FROM public.barberias b
    WHERE b.owner_id = p_auth_user_id
      AND b.slug = v_requested_slug
      AND b.deleted_at IS NULL
    ORDER BY b.id
    LIMIT 1;

    IF v_barberia_id IS NULL THEN
      v_final_slug := CASE
        WHEN EXISTS (SELECT 1 FROM public.barberias b WHERE b.slug = v_requested_slug)
          THEN v_requested_slug || '-' || substring(md5(p_auth_user_id::text || ':' || v_requested_slug), 1, 6)
        ELSE v_requested_slug
      END;

      SELECT b.id INTO v_barberia_id
      FROM public.barberias b
      WHERE b.owner_id = p_auth_user_id
        AND b.slug = v_final_slug
        AND b.deleted_at IS NULL
      ORDER BY b.id
      LIMIT 1;
    END IF;
  END IF;

  IF v_barberia_id IS NULL THEN
    INSERT INTO public.barberias
      (nombre, slug, email_contacto, telefono, direccion, ciudad, slot_min, estado, owner_id, created_at)
    VALUES (
      COALESCE(NULLIF(trim(v_barberia->>'nombre'), ''), 'Barberia'),
      v_final_slug,
      v_admin_email,
      COALESCE(NULLIF(trim(v_barberia->>'telefono'), ''), ''),
      NULLIF(trim(v_barberia->>'direccion'), ''),
      NULLIF(trim(v_barberia->>'ciudad'), ''),
      GREATEST(5, COALESCE(NULLIF(v_barberia->>'slot_min', '')::integer, 15)),
      'activa',
      p_auth_user_id,
      now()
    )
    RETURNING id INTO v_barberia_id;
  ELSE
    UPDATE public.barberias
    SET nombre = COALESCE(NULLIF(trim(v_barberia->>'nombre'), ''), nombre),
        email_contacto = COALESCE(v_admin_email, email_contacto),
        telefono = COALESCE(NULLIF(trim(v_barberia->>'telefono'), ''), telefono, ''),
        direccion = COALESCE(NULLIF(trim(v_barberia->>'direccion'), ''), direccion),
        ciudad = COALESCE(NULLIF(trim(v_barberia->>'ciudad'), ''), ciudad),
        slot_min = GREATEST(5, COALESCE(NULLIF(v_barberia->>'slot_min', '')::integer, slot_min, 15))
    WHERE id = v_barberia_id;
  END IF;

  -- Provision Starter subscription if no subscription exists for this barberia
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE barberia_id = v_barberia_id) THEN
    INSERT INTO public.subscriptions (
      barberia_id,
      plan_id,
      status,
      estado,
      period_start,
      period_end,
      provider,
      provider_ref,
      created_at,
      updated_at
    ) VALUES (
      v_barberia_id,
      1, -- Starter Plan ID
      'active',
      'activa',
      now(),
      now() + interval '30 days',
      'system',
      'onboarding_starter',
      now(),
      now()
    );

    UPDATE public.barberias
    SET plan_id = 1
    WHERE id = v_barberia_id;
  END IF;

  WITH barber_access AS (
    SELECT
      ordinality AS rn,
      NULLIF(trim(COALESCE(item->>'nombre', item->>'name', '')), '') AS nombre,
      NULLIF(lower(trim(COALESCE(item->>'email', ''))), '') AS email,
      NULLIF(trim(COALESCE(item->>'password', '')), '') AS password
    FROM jsonb_array_elements(COALESCE(v_draft->'accesos'->'barberos', '[]'::jsonb))
      WITH ORDINALITY AS rows(item, ordinality)
  ),
  user_candidates AS (
    SELECT 0::bigint AS priority, v_admin_name AS nombre, v_admin_email AS email,
           v_admin_password AS password, 'admin'::text AS requested_role
    UNION ALL
    SELECT rn, nombre, email, password, 'barbero'::text
    FROM barber_access
    WHERE email IS NOT NULL AND email <> v_admin_email
  ),
  unique_candidates AS (
    SELECT DISTINCT ON (email) nombre, email, password, requested_role
    FROM user_candidates
    WHERE email IS NOT NULL
    ORDER BY email, priority
  )
  INSERT INTO public.usuarios (nombre, email, role, password_hash)
  SELECT COALESCE(nombre, CASE WHEN requested_role = 'admin' THEN 'Administrador' ELSE 'Barbero' END),
         email,
         requested_role,
         CASE WHEN password IS NULL THEN NULL ELSE public.fn_password_hash(password) END
  FROM unique_candidates
  ON CONFLICT (email) DO UPDATE
  SET nombre = COALESCE(NULLIF(EXCLUDED.nombre, ''), public.usuarios.nombre),
      role = CASE
        WHEN public.usuarios.role IN ('admin', 'owner', 'super_admin') THEN public.usuarios.role
        WHEN EXCLUDED.role = 'admin' THEN 'admin'
        ELSE EXCLUDED.role
      END,
      password_hash = COALESCE(EXCLUDED.password_hash, public.usuarios.password_hash);

  DELETE FROM public.servicios s
  WHERE s.barberia_id = v_barberia_id
    AND NOT EXISTS (SELECT 1 FROM public.citas c WHERE c.barberia_id = v_barberia_id);

  INSERT INTO public.servicios (barberia_id, nombre, duracion_min, precio, activo, imagen_url)
  SELECT v_barberia_id,
         NULLIF(trim(item->>'nombre'), ''),
         COALESCE(NULLIF(item->>'duracion_min', '')::integer, 30),
         COALESCE(NULLIF(item->>'precio', '')::numeric, 0),
         true,
         NULLIF(trim(COALESCE(item->>'imagen_url', item->>'image_url', item->>'foto', '')), '')
  FROM jsonb_array_elements(COALESCE(v_draft->'servicios', '[]'::jsonb)) item
  WHERE NULLIF(trim(item->>'nombre'), '') IS NOT NULL;
  GET DIAGNOSTICS v_services_count = ROW_COUNT;

  INSERT INTO public.horarios (barberia_id, dia_semana, activo, hora_abre, hora_cierra)
  SELECT v_barberia_id,
         COALESCE(
           NULLIF(item->>'dia_semana', '')::integer,
           CASE lower(trim(COALESCE(item->>'dia', item->>'day', '')))
             WHEN 'domingo' THEN 0 WHEN 'dom' THEN 0 WHEN 'sunday' THEN 0
             WHEN 'lunes' THEN 1 WHEN 'lun' THEN 1 WHEN 'monday' THEN 1
             WHEN 'martes' THEN 2 WHEN 'mar' THEN 2 WHEN 'tuesday' THEN 2
             WHEN 'miercoles' THEN 3 WHEN 'miércoles' THEN 3 WHEN 'mie' THEN 3 WHEN 'mié' THEN 3 WHEN 'wednesday' THEN 3
             WHEN 'jueves' THEN 4 WHEN 'jue' THEN 4 WHEN 'thursday' THEN 4
             WHEN 'viernes' THEN 5 WHEN 'vie' THEN 5 WHEN 'friday' THEN 5
             WHEN 'sabado' THEN 6 WHEN 'sábado' THEN 6 WHEN 'sab' THEN 6 WHEN 'sáb' THEN 6 WHEN 'saturday' THEN 6
             ELSE NULL
           END
         ),
         COALESCE((item->>'activo')::boolean, true),
         NULLIF(trim(item->>'hora_abre'), '')::time,
         NULLIF(trim(item->>'hora_cierra'), '')::time
  FROM jsonb_array_elements(COALESCE(v_draft->'horarios', '[]'::jsonb)) item
  WHERE COALESCE(
          NULLIF(item->>'dia_semana', '')::integer,
          CASE lower(trim(COALESCE(item->>'dia', item->>'day', '')))
            WHEN 'domingo' THEN 0 WHEN 'dom' THEN 0 WHEN 'sunday' THEN 0
            WHEN 'lunes' THEN 1 WHEN 'lun' THEN 1 WHEN 'monday' THEN 1
            WHEN 'martes' THEN 2 WHEN 'mar' THEN 2 WHEN 'tuesday' THEN 2
            WHEN 'miercoles' THEN 3 WHEN 'miércoles' THEN 3 WHEN 'mie' THEN 3 WHEN 'mié' THEN 3 WHEN 'wednesday' THEN 3
            WHEN 'jueves' THEN 4 WHEN 'jue' THEN 4 WHEN 'thursday' THEN 4
            WHEN 'viernes' THEN 5 WHEN 'vie' THEN 5 WHEN 'friday' THEN 5
            WHEN 'sabado' THEN 6 WHEN 'sábado' THEN 6 WHEN 'sab' THEN 6 WHEN 'sáb' THEN 6 WHEN 'saturday' THEN 6
            ELSE NULL
          END
        ) BETWEEN 0 AND 6
  ON CONFLICT (barberia_id, dia_semana) DO UPDATE
  SET activo = EXCLUDED.activo,
      hora_abre = EXCLUDED.hora_abre,
      hora_cierra = EXCLUDED.hora_cierra;
  GET DIAGNOSTICS v_hours_count = ROW_COUNT;

  DELETE FROM public.barberos b
  WHERE b.barberia_id = v_barberia_id
    AND NOT EXISTS (SELECT 1 FROM public.citas c WHERE c.barberia_id = v_barberia_id);

  UPDATE public.barberos b
  SET usuario_id = NULL
  WHERE b.barberia_id <> v_barberia_id
    AND b.usuario_id IN (
      SELECT u.id
      FROM public.usuarios u
      JOIN jsonb_array_elements(COALESCE(v_draft->'accesos'->'barberos', '[]'::jsonb)) item
        ON lower(trim(u.email)) = NULLIF(lower(trim(COALESCE(item->>'email', ''))), '')
    );

  INSERT INTO public.barberos (barberia_id, nombre, activo, foto_url, usuario_id)
  SELECT v_barberia_id,
         NULLIF(trim(COALESCE(item->>'nombre', item->>'name', '')), ''),
         COALESCE((item->>'activo')::boolean, true),
         NULLIF(trim(COALESCE(item->>'foto_url', item->>'foto', item->>'avatar_url', '')), ''),
         u.id
  FROM jsonb_array_elements(COALESCE(v_draft->'accesos'->'barberos', '[]'::jsonb)) item
  LEFT JOIN public.usuarios u
    ON lower(trim(u.email)) = NULLIF(lower(trim(COALESCE(item->>'email', ''))), '')
  WHERE NULLIF(trim(COALESCE(item->>'nombre', item->>'name', '')), '') IS NOT NULL;
  GET DIAGNOSTICS v_barbers_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'barberia_id', v_barberia_id,
    'slug', v_final_slug,
    'servicios_insertados', v_services_count,
    'horarios_insertados', v_hours_count,
    'barberos_insertados', v_barbers_count,
    'admin_tambien_barbero', EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(v_draft->'accesos'->'barberos', '[]'::jsonb)) item
      WHERE NULLIF(lower(trim(item->>'email')), '') = v_admin_email
    ),
    'message', 'Onboarding completado atomicamente'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ba_complete_onboarding_atomic(boolean, integer, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ba_complete_onboarding_atomic(boolean, integer, integer, jsonb) TO ba_app;
-- Also grant execute to postgres/owner roles
GRANT EXECUTE ON FUNCTION public.ba_complete_onboarding_atomic(boolean, integer, integer, jsonb) TO ba_staging_owner;

COMMIT;
