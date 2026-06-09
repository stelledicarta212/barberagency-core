const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('--- TARGET USERS ---');
    const emails = [
      'pildorasdeautomatizacion@gmail.com',
      'carlosalbertoalvisrodriguez@gmail.com',
      'barberopruab4@gmail.com'
    ];
    const users = await runSQL(
      `SELECT id, email, nombre, role FROM public.usuarios WHERE lower(email) = ANY($1);`,
      [emails]
    );
    console.log(JSON.stringify(users, null, 2));

    console.log('\n--- TARGET BARBERIA ---');
    const barberia = await runSQL(
      `SELECT id, owner_id, nombre, slug, email_contacto FROM public.barberias WHERE id = 198;`
    );
    console.log(JSON.stringify(barberia, null, 2));

    console.log('\n--- TARGET BARBEROS ---');
    const barberos = await runSQL(
      `SELECT id, nombre, usuario_id, activo FROM public.barberos WHERE barberia_id = 198;`
    );
    console.log(JSON.stringify(barberos, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
