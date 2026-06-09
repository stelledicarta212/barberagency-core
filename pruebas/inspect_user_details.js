const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    
    console.log('--- Querying Barberia 198 details ---');
    const barberia = await runSQL(`
      SELECT id, owner_id, slug, deleted_at, estado, email_contacto 
      FROM public.barberias 
      WHERE id = 198;
    `);
    console.log('Barberia 198:', barberia);

    console.log('\n--- Querying User calvis590@gmail.com details ---');
    const user = await runSQL(`
      SELECT id, email, role, nombre 
      FROM public.usuarios 
      WHERE email = 'calvis590@gmail.com';
    `);
    console.log('User:', user);

    console.log('\n--- Querying User pildorasdeautomatizacion@gmail.com details ---');
    const user2 = await runSQL(`
      SELECT id, email, role, nombre 
      FROM public.usuarios 
      WHERE email = 'pildorasdeautomatizacion@gmail.com';
    `);
    console.log('User pildoras:', user2);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await cleanup();
  }
})();
