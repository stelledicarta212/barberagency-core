const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    
    console.log('\n--- USUARIOS ---');
    const users = await runSQL('SELECT id, email, nombre FROM public.usuarios ORDER BY id ASC LIMIT 10;');
    console.log(JSON.stringify(users, null, 2));

    console.log('\n--- BARBERIAS ---');
    const barberias = await runSQL('SELECT id, owner_id, slug, nombre FROM public.barberias WHERE deleted_at IS NULL ORDER BY id ASC LIMIT 10;');
    console.log(JSON.stringify(barberias, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
