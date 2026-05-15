-- Hardening fuerte: onboarding + publicacion + horarios canonicos
-- Fecha: 2026-05-14
-- Objetivo:
-- 1) Evitar nombres/slugs invalidos (undefined/null/vacios) en barberias
-- 2) Blindar ba_publicar_barberia para no generar rutas rotas
-- 3) Sincronizar horarios canonicos via RPC con permisos controlados
-- 4) Dejar comportamiento consistente desde API, WP y Dashboard

BEGIN;

-- =========================================================
-- A) Helper: normalizar texto "sucio" de entrada
-- =========================================================
CREATE OR REPLACE FUNCTION public.ba_is_dirty_text(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_text IS NULL
    OR btrim(p_text) = ''
    OR lower(btrim(p_text)) IN ('undefined', 'null', 'nan');
$$;

-- =========================================================
-- B) Trigger de saneamiento fuerte sobre barberias
-- =========================================================
CREATE OR REPLACE FUNCTION public.ba_sanitize_barberia_row()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_base_name text;
BEGIN
  v_base_name := btrim(coalesce(NEW.nombre, ''));

  IF public.ba_is_dirty_text(v_base_name) THEN
    -- Si aun no existe id (BEFORE INSERT), se completa despues en trigger AFTER.
    IF NEW.id IS NOT NULL THEN
      NEW.nombre := 'Barberia ' || NEW.id::text;
    ELSE
      NEW.nombre := 'Barberia';
    END IF;
  ELSE
    NEW.nombre := v_base_name;
  END IF;

  -- Normaliza slug invalido/vacio
  IF public.ba_is_dirty_text(NEW.slug) OR lower(btrim(coalesce(NEW.slug, ''))) LIKE 'undefined-%' THEN
    IF NEW.id IS NOT NULL THEN
      NEW.slug := public.ba_generate_unique_slug(NEW.nombre, NEW.id);
    ELSE
      -- Valor temporal para INSERT sin id; AFTER trigger corrige definitivo.
      NEW.slug := regexp_replace(lower(translate(NEW.nombre, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')), '[^a-z0-9]+', '-', 'g');
      NEW.slug := trim(both '-' from NEW.slug);
      IF NEW.slug = '' THEN
        NEW.slug := 'barberia-temp';
      END IF;
    END IF;
  ELSE
    NEW.slug := btrim(NEW.slug);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ba_sanitize_barberia_row ON public.barberias;
CREATE TRIGGER trg_ba_sanitize_barberia_row
BEFORE INSERT OR UPDATE ON public.barberias
FOR EACH ROW
EXECUTE FUNCTION public.ba_sanitize_barberia_row();

-- Ajuste final post-insert cuando el id ya existe.
CREATE OR REPLACE FUNCTION public.ba_fix_barberia_post_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_new_name text;
  v_new_slug text;
BEGIN
  v_new_name := NEW.nombre;
  v_new_slug := NEW.slug;

  IF public.ba_is_dirty_text(v_new_name) OR v_new_name = 'Barberia' THEN
    v_new_name := 'Barberia ' || NEW.id::text;
  END IF;

  IF public.ba_is_dirty_text(v_new_slug) OR lower(v_new_slug) LIKE 'undefined-%' OR lower(v_new_slug) = 'barberia-temp' THEN
    v_new_slug := public.ba_generate_unique_slug(v_new_name, NEW.id);
  END IF;

  IF v_new_name IS DISTINCT FROM NEW.nombre OR v_new_slug IS DISTINCT FROM NEW.slug THEN
    UPDATE public.barberias
    SET nombre = v_new_name,
        slug = v_new_slug
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_ba_fix_barberia_post_insert ON public.barberias;
CREATE TRIGGER trg_ba_fix_barberia_post_insert
AFTER INSERT ON public.barberias
FOR EACH ROW
EXECUTE FUNCTION public.ba_fix_barberia_post_insert();

-- =========================================================
-- C) Publicacion blindada (slug robusto siempre)
-- =========================================================
CREATE OR REPLACE FUNCTION public.ba_publicar_barberia(p_barberia_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_barberia public.barberias%ROWTYPE;
  v_slug text;
  v_qr_code text;
  v_servicios_count int;
  v_barberos_count int;
  v_nombre_safe text;
BEGIN
  SELECT *
  INTO v_barberia
  FROM public.barberias
  WHERE id = p_barberia_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'barberia_no_encontrada');
  END IF;

  SELECT count(*)
  INTO v_servicios_count
  FROM public.servicios
  WHERE barberia_id = p_barberia_id
    AND activo = true;

  SELECT count(*)
  INTO v_barberos_count
  FROM public.barberos
  WHERE barberia_id = p_barberia_id
    AND activo = true;

  v_nombre_safe := btrim(coalesce(v_barberia.nombre, ''));
  IF public.ba_is_dirty_text(v_nombre_safe) THEN
    v_nombre_safe := 'Barberia ' || p_barberia_id::text;
    UPDATE public.barberias
    SET nombre = v_nombre_safe
    WHERE id = p_barberia_id;
    v_barberia.nombre := v_nombre_safe;
  END IF;

  IF v_servicios_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'faltan_servicios_activos');
  END IF;

  IF v_barberos_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'faltan_barberos_activos');
  END IF;

  IF public.ba_is_dirty_text(v_barberia.slug)
     OR lower(btrim(coalesce(v_barberia.slug, ''))) LIKE 'undefined-%'
  THEN
    v_slug := public.ba_generate_unique_slug(v_nombre_safe, p_barberia_id);
    UPDATE public.barberias
    SET slug = v_slug
    WHERE id = p_barberia_id;
  ELSE
    v_slug := btrim(v_barberia.slug);
  END IF;

  SELECT qr_code
  INTO v_qr_code
  FROM public.qr_links
  WHERE barberia_id = p_barberia_id
    AND active = true
  LIMIT 1;

  IF v_qr_code IS NULL THEN
    v_qr_code := public.ba_generate_qr_code();
    INSERT INTO public.qr_links (barberia_id, qr_code, active)
    VALUES (p_barberia_id, v_qr_code, true);
  END IF;

  UPDATE public.barberias
  SET publicada = true,
      published_at = COALESCE(published_at, now())
  WHERE id = p_barberia_id;

  RETURN jsonb_build_object(
    'ok', true,
    'barberia_id', p_barberia_id,
    'slug', v_slug,
    'qr_code', v_qr_code,
    'public_path', '/b/' || v_slug,
    'qr_path', '/q/' || v_qr_code
  );
END;
$function$;

ALTER FUNCTION public.ba_publicar_barberia(integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ba_publicar_barberia(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ba_publicar_barberia(integer) TO anon, authenticated;

-- =========================================================
-- D) RPC canónica para horarios (upsert por dia_semana)
-- =========================================================
CREATE OR REPLACE FUNCTION public.ba_sync_registro_horarios(
  p_barberia_id integer,
  p_horarios jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_row jsonb;
  v_dia_semana int;
  v_activo boolean;
  v_hora_abre time;
  v_hora_cierra time;
  v_count_upsert int := 0;
BEGIN
  IF p_barberia_id IS NULL OR p_barberia_id <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'barberia_id_invalido');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.barberias b WHERE b.id = p_barberia_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'barberia_no_encontrada');
  END IF;

  IF p_horarios IS NULL OR jsonb_typeof(p_horarios) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'horarios_payload_invalido');
  END IF;

  FOR v_row IN
    SELECT value FROM jsonb_array_elements(p_horarios)
  LOOP
    v_dia_semana := COALESCE((v_row->>'dia_semana')::int, -1);
    v_activo := COALESCE((v_row->>'activo')::boolean, false);

    -- Solo se sincronizan dias validos
    IF v_dia_semana < 0 OR v_dia_semana > 6 THEN
      CONTINUE;
    END IF;

    -- Si viene inactivo, se marca inactivo sin validar horas
    IF v_activo = false THEN
      INSERT INTO public.horarios (barberia_id, dia_semana, hora_abre, hora_cierra, activo)
      VALUES (p_barberia_id, v_dia_semana, '09:00'::time, '18:00'::time, false)
      ON CONFLICT (barberia_id, dia_semana)
      DO UPDATE SET activo = false;
      v_count_upsert := v_count_upsert + 1;
      CONTINUE;
    END IF;

    v_hora_abre := COALESCE(NULLIF(v_row->>'hora_abre', '')::time, '09:00'::time);
    v_hora_cierra := COALESCE(NULLIF(v_row->>'hora_cierra', '')::time, '18:00'::time);

    IF v_hora_cierra <= v_hora_abre THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'horario_invalido',
        'dia_semana', v_dia_semana
      );
    END IF;

    INSERT INTO public.horarios (barberia_id, dia_semana, hora_abre, hora_cierra, activo)
    VALUES (p_barberia_id, v_dia_semana, v_hora_abre, v_hora_cierra, true)
    ON CONFLICT (barberia_id, dia_semana)
    DO UPDATE SET
      hora_abre = EXCLUDED.hora_abre,
      hora_cierra = EXCLUDED.hora_cierra,
      activo = EXCLUDED.activo;

    v_count_upsert := v_count_upsert + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'barberia_id', p_barberia_id,
    'horarios_upsertados', v_count_upsert
  );
END;
$function$;

ALTER FUNCTION public.ba_sync_registro_horarios(integer, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.ba_sync_registro_horarios(integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ba_sync_registro_horarios(integer, jsonb) TO anon, authenticated;

-- =========================================================
-- E) Backfill: arreglar slugs/nombres legacy undefined-*
-- =========================================================
DO $$
DECLARE
  r record;
  v_name text;
  v_slug text;
BEGIN
  FOR r IN
    SELECT id, nombre, slug
    FROM public.barberias
    WHERE public.ba_is_dirty_text(nombre)
       OR public.ba_is_dirty_text(slug)
       OR lower(btrim(coalesce(slug, ''))) LIKE 'undefined-%'
  LOOP
    v_name := btrim(coalesce(r.nombre, ''));
    IF public.ba_is_dirty_text(v_name) THEN
      v_name := 'Barberia ' || r.id::text;
    END IF;

    v_slug := public.ba_generate_unique_slug(v_name, r.id);

    UPDATE public.barberias
    SET nombre = v_name,
        slug = v_slug
    WHERE id = r.id;
  END LOOP;
END $$;

COMMIT;

-- =========================================================
-- Verificaciones recomendadas (ejecutar manualmente)
-- =========================================================
-- SELECT id, nombre, slug FROM public.barberias WHERE id IN (128,127,126,125);
-- SELECT public.ba_publicar_barberia(128);
-- SELECT public.ba_sync_registro_horarios(128, '[{"dia_semana":1,"activo":true,"hora_abre":"09:00","hora_cierra":"18:00"}]'::jsonb);
-- SELECT barberia_id, dia_semana, hora_abre, hora_cierra, activo FROM public.horarios WHERE barberia_id = 128 ORDER BY dia_semana;
