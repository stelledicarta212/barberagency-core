const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();

    const oldQuery = `
      WITH target_barberia AS (
        SELECT id, slug, owner_id FROM public.barberias
        WHERE (
          ($2::int > 0 AND id = $2::int) OR
          (($2::int IS NULL OR $2::int = 0) AND slug = $3::text)
        ) AND deleted_at IS NULL
      ),
      auth_check AS (
        SELECT id, role FROM public.usuarios WHERE id = $1 LIMIT 1
      ),
      barberia_check AS (
        SELECT id FROM target_barberia
        WHERE (
          owner_id = $1 OR
          EXISTS (SELECT 1 FROM public.barberos WHERE usuario_id = $1 AND barberia_id = target_barberia.id)
        )
        AND ($2::int IS NULL OR $2::int = 0 OR slug IS NULL OR $3::text IS NULL OR slug = $3::text)
        LIMIT 1
      )
      SELECT
        $4::boolean AS auth_ok_jwt,
        EXISTS (SELECT 1 FROM auth_check) AS auth_ok,
        EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,
        COALESCE(
          (SELECT role FROM auth_check) IN ('admin', 'owner', 'super_admin', 'barbero', 'cajero'),
          false
        ) AS role_ok,
        (SELECT id FROM target_barberia LIMIT 1) AS validated_barberia_id,
        (SELECT role FROM auth_check) AS user_role;
    `;

    const newQuery = `
      WITH target_barberia AS (
        SELECT id, slug, owner_id, email_contacto FROM public.barberias
        WHERE (
          ($2::int > 0 AND id = $2::int) OR
          (($2::int IS NULL OR $2::int = 0) AND slug = $3::text)
        ) AND deleted_at IS NULL
      ),
      auth_check AS (
        SELECT id, role, email FROM public.usuarios WHERE id = $1 LIMIT 1
      ),
      barberia_check AS (
        SELECT tb.id FROM target_barberia tb
        LEFT JOIN auth_check ac ON true
        WHERE (
          tb.owner_id = $1 OR
          lower(COALESCE(tb.email_contacto, '')) = lower(COALESCE(ac.email, '')) OR
          EXISTS (SELECT 1 FROM public.barberos WHERE usuario_id = $1 AND barberia_id = tb.id)
        )
        AND ($2::int IS NULL OR $2::int = 0 OR tb.slug IS NULL OR $3::text IS NULL OR tb.slug = $3::text)
        LIMIT 1
      )
      SELECT
        $4::boolean AS auth_ok_jwt,
        EXISTS (SELECT 1 FROM auth_check) AS auth_ok,
        EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,
        COALESCE(
          (SELECT role FROM auth_check) IN ('admin', 'owner', 'super_admin', 'barbero', 'cajero'),
          false
        ) AS role_ok,
        (SELECT id FROM target_barberia LIMIT 1) AS validated_barberia_id,
        (SELECT role FROM auth_check) AS user_role;
    `;

    console.log('--- RUNNING OLD QUERY ---');
    const oldRes = await runSQL(oldQuery, [8, 198, 'barberia-prueba-4', true]);
    console.log('Old Query Result:', oldRes);

    console.log('\n--- RUNNING NEW QUERY ---');
    const newRes = await runSQL(newQuery, [8, 198, 'barberia-prueba-4', true]);
    console.log('New Query Result:', newRes);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await cleanup();
  }
})();
