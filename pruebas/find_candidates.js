const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('--- CANDIDATE ADMIN ACCESSES ---');
    const candidates = await runSQL(`
      SELECT b.id as barberia_id, b.nombre as barberia_nombre, b.owner_id, u.email as owner_email, b.email_contacto 
      FROM public.barberias b
      JOIN public.usuarios u ON b.owner_id = u.id
      WHERE b.deleted_at IS NULL 
        AND b.email_contacto IS NOT NULL 
        AND trim(b.email_contacto) != ''
        AND lower(trim(b.email_contacto)) != lower(trim(u.email));
    `);
    console.log(JSON.stringify(candidates, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
