const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    
    console.log('--- Querying Barberia 198 Current DB Status ---');
    const barberia = await runSQL(`
      SELECT id, nombre, slug, owner_id, telefono, whatsapp, email_contacto, direccion, ciudad, politicas, deleted_at
      FROM public.barberias
      WHERE id = 198;
    `);
    console.log('Barberia 198:', JSON.stringify(barberia, null, 2));

    console.log('\n--- Querying Owner User of Barberia 198 ---');
    const ownerUser = await runSQL(`
      SELECT id, nombre, email, role
      FROM public.usuarios
      WHERE id = (SELECT owner_id FROM public.barberias WHERE id = 198);
    `);
    console.log('Owner User:', JSON.stringify(ownerUser, null, 2));

    console.log('\n--- Querying User calvis590@gmail.com ---');
    const calvisUser = await runSQL(`
      SELECT id, nombre, email, role
      FROM public.usuarios
      WHERE email = 'calvis590@gmail.com';
    `);
    console.log('calvis590 User:', JSON.stringify(calvisUser, null, 2));

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await cleanup();
  }
})();
