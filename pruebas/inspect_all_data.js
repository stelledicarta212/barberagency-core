const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('--- USER TABLE ---');
    const users = await runSQL(`SELECT id, email, nombre, role, password_hash IS NOT NULL as has_password FROM public.usuarios;`);
    console.log(users);

    console.log('\n--- BARBERIAS TABLE ---');
    const barberias = await runSQL(`SELECT id, owner_id, nombre, slug, email_contacto, deleted_at FROM public.barberias WHERE id = 198 OR slug = 'barberia-prueba-4';`);
    console.log(barberias);

    console.log('\n--- BARBEROS OF BARBERIA 198 ---');
    const barberos = await runSQL(`SELECT id, nombre, usuario_id, activo FROM public.barberos WHERE barberia_id = 198;`);
    console.log(barberos);

    console.log('\n--- CHECK LOGIN CRITERIA FOR ALL ADMINS ---');
    const query = `
      SELECT 
        u.id as user_id, 
        u.email as user_email, 
        u.role as user_role,
        b.id as barberia_id,
        b.owner_id as barberia_owner_id,
        b.email_contacto as barberia_email_contacto,
        (b.owner_id = u.id) as is_owner,
        (lower(COALESCE(b.email_contacto, '')) = lower(u.email)) as email_match,
        CASE
          WHEN (b.owner_id = u.id OR lower(COALESCE(b.email_contacto, '')) = lower(u.email)) THEN 'ALLOWED'
          ELSE 'FORBIDDEN'
        END as status
      FROM public.usuarios u
      CROSS JOIN public.barberias b
      WHERE b.id = 198;
    `;
    const check = await runSQL(query);
    console.log(check);

  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
