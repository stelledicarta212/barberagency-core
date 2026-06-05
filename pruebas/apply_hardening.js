const { setup, cleanup, runSQL } = require('./run_postgres_query');

const ddl = `
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
  v_auth_user_id int;
BEGIN
  -- 1. Obtener y validar el usuario autenticado
  v_auth_user_id := public.jwt_user_id();
  IF v_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado_anonimo');
  END IF;

  -- 2. Buscar la barbería objetivo
  SELECT *
  INTO v_barberia
  FROM public.barberias
  WHERE id = p_barberia_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'barberia_no_encontrada');
  END IF;

  -- 3. Validar si está eliminada
  IF v_barberia.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'barberia_eliminada');
  END IF;

  -- 4. Validar pertenencia del dueño
  IF v_barberia.owner_id IS NULL OR v_barberia.owner_id <> v_auth_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_autorizado_barberia_ajena');
  END IF;

  -- 5. Validar servicios activos
  SELECT count(*)
  INTO v_servicios_count
  FROM public.servicios
  WHERE barberia_id = p_barberia_id
    AND activo = true;

  -- 6. Validar barberos activos
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

  -- 7. Generar / validar slug
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

  -- 8. Generar / validar QR
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

  -- 9. Actualizar estado publicada
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
`;

(async () => {
  try {
    await setup();
    console.log('Applying ba_publicar_barberia hardening DDL...');
    await runSQL(ddl);
    
    console.log('Revoking EXECUTE from anon...');
    await runSQL('REVOKE EXECUTE ON FUNCTION public.ba_publicar_barberia(integer) FROM anon;');
    
    console.log('Granting EXECUTE to authenticated...');
    await runSQL('GRANT EXECUTE ON FUNCTION public.ba_publicar_barberia(integer) TO authenticated;');
    
    console.log('Migration successful.');
  } catch (e) {
    console.error('Migration failed:', e);
  } finally {
    await cleanup();
  }
})();
