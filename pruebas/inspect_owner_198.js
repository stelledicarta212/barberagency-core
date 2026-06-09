const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('--- Inspecting Barberia 198 Owner ---');
    const barberia = await runSQL(`SELECT id, owner_id, nombre, slug FROM public.barberias WHERE id = 198;`);
    console.log('Barberia:', barberia);

    if (barberia.length > 0) {
      const ownerId = barberia[0].owner_id;
      const ownerUser = await runSQL(`SELECT id, email, nombre, role FROM public.usuarios WHERE id = $1;`, [ownerId]);
      console.log('Owner User:', ownerUser);
    }

    console.log('\n--- Barberos of Barberia 198 and their users ---');
    const barberos = await runSQL(`SELECT id, nombre, usuario_id FROM public.barberos WHERE barberia_id = 198;`);
    console.log('Barberos:', barberos);

    const userIds = barberos.map(b => b.usuario_id).filter(Boolean);
    if (userIds.length > 0) {
      const users = await runSQL(`SELECT id, email, nombre, role FROM public.usuarios WHERE id IN (${userIds.join(',')});`);
      console.log('Barber Users:', users);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
