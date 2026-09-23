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

    const email1 = process.env.TEST_USER_EMAIL_1 || 'user1@example.com';
    const email2 = process.env.TEST_USER_EMAIL_2 || 'user2@example.com';

    console.log(`\n--- Querying User ${email1} details ---`);
    const user = await runSQL(`
      SELECT id, email, role, nombre 
      FROM public.usuarios 
      WHERE email = $1;
    `, [email1]);
    console.log('User 1:', user);

    console.log(`\n--- Querying User ${email2} details ---`);
    const user2 = await runSQL(`
      SELECT id, email, role, nombre 
      FROM public.usuarios 
      WHERE email = $1;
    `, [email2]);
    console.log('User 2:', user2);

  } catch (e) {
    console.error('Error:', e);
  } finally {
    await cleanup();
  }
})();
