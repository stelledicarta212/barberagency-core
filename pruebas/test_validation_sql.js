const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    
    const query = `
      WITH auth_check AS (
        SELECT id FROM public.usuarios WHERE id = $1 LIMIT 1
      ),
      barberia_check AS (
        SELECT id FROM public.barberias WHERE id = $2 AND owner_id = $1 AND deleted_at IS NULL LIMIT 1
      ),
      servicio_check AS (
        SELECT 1
        WHERE $3::text = 'add_servicio' OR EXISTS (
          SELECT 1 FROM public.servicios WHERE id = $4::int AND barberia_id = $2
        )
      )
      SELECT
        $5::boolean AS auth_ok_jwt,
        EXISTS (SELECT 1 FROM auth_check) AS auth_ok,
        EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,
        EXISTS (SELECT 1 FROM servicio_check) AS servicio_ok;
    `;

    console.log('Testing SQL with auth_ok = false, user_id = 0, action = add_servicio:');
    const res1 = await runSQL(query, [0, 1, 'add_servicio', 0, false]);
    console.log('Result:', JSON.stringify(res1, null, 2));

    console.log('\nTesting SQL with auth_ok = true, user_id = 1, action = update_servicio:');
    const res2 = await runSQL(query, [1, 1, 'update_servicio', 1, true]);
    console.log('Result:', JSON.stringify(res2, null, 2));

  } catch (e) {
    console.error('SQL Error:', e.message);
  } finally {
    await cleanup();
  }
})();
