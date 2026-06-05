const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('--- Inspecting public.usuarios ---');
    const users = await runSQL(`SELECT id, email, role FROM public.usuarios LIMIT 5;`);
    console.log(users);

    console.log('\n--- Inspecting Columns of public.barberos ---');
    const cols = await runSQL(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'barberos' AND table_schema = 'public';
    `);
    console.log(cols);

    console.log('\n--- Inspecting Sample Barber ---');
    const barbers = await runSQL(`SELECT id, barberia_id, nombre, usuario_id FROM public.barberos LIMIT 3;`);
    console.log(barbers);
  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
