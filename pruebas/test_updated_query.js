const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  console.log('=== RUNNING SECURITY ASSERTION TEST ===');
  let exitCode = 0;
  try {
    await setup();

    // Test Case 1: email_contacto must not grant permissions
    console.log('\n[TEST 1] Verifying that email_contacto does NOT grant permissions...');
    const testEmail = 'email-contacto-security-test@barberagency.com';
    
    // Temporarily change email_contacto of barberia 198 to testEmail
    await runSQL(`UPDATE public.barberias SET email_contacto = $1 WHERE id = 198;`, [testEmail]);
    
    // Create a temp user with testEmail who is NOT owner (owner_id = 7) and NOT in barberia_miembros
    await runSQL(`DELETE FROM public.usuarios WHERE lower(email) = $1;`, [testEmail]);
    const insertRes = await runSQL(`
      INSERT INTO public.usuarios (nombre, email, password_hash, role)
      VALUES ('Security Temp User', $1, crypt('pass12345', gen_salt('bf', 8)), 'admin')
      RETURNING id;
    `, [testEmail]);
    const tempUserId = insertRes[0].id;

    // Run the active dashboard state authorization query in SQL
    const authCheckQuery = `
      WITH target_barberia AS (
        SELECT id, slug, owner_id, email_contacto FROM public.barberias
        WHERE id = 198 AND deleted_at IS NULL
      ),
      auth_check AS (
        SELECT id, role, email FROM public.usuarios WHERE id = $1 LIMIT 1
      ),
      barberia_check AS (
        SELECT tb.id FROM target_barberia tb
        LEFT JOIN auth_check ac ON true
        WHERE (
          tb.owner_id = $1 OR
          EXISTS (
            SELECT 1 FROM public.barberia_miembros m 
            WHERE m.barberia_id = tb.id 
              AND (m.usuario_id = $1 OR lower(m.email) = lower(ac.email)) 
              AND m.activo = true
          ) OR
          EXISTS (SELECT 1 FROM public.barberos WHERE usuario_id = $1 AND barberia_id = tb.id)
        )
        LIMIT 1
      )
      SELECT EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok;
    `;

    const authRes = await runSQL(authCheckQuery, [tempUserId]);
    const hasAccess = authRes[0].barberia_ok;

    // Clean up DB before assertions
    await runSQL(`UPDATE public.barberias SET email_contacto = 'pildorasdeautomatizacion@gmail.com' WHERE id = 198;`);
    await runSQL(`DELETE FROM public.usuarios WHERE id = $1;`, [tempUserId]);

    if (hasAccess) {
      console.error('❌ FAIL: email_contacto granted access! Authorization leak detected.');
      exitCode = 1;
    } else {
      console.log('✅ PASS: email_contacto does not grant access.');
    }

    // Test Case 2: role null must not default to admin (should not gain admin permissions)
    console.log('\n[TEST 2] Verifying that NULL role does not default to admin...');
    const nullRoleUserRes = await runSQL(`
      INSERT INTO public.usuarios (nombre, email, password_hash, role)
      VALUES ('Null Role User', 'null-role-test@barberagency.com', crypt('pass12345', gen_salt('bf', 8)), NULL)
      RETURNING id;
    `);
    const nullRoleUserId = nullRoleUserRes[0].id;
    
    // Add user as a member in barberia_miembros with rol = NULL or 'guest'
    await runSQL(`
      INSERT INTO public.barberia_miembros (barberia_id, usuario_id, email, rol, activo, created_at, updated_at)
      VALUES (198, $1, 'null-role-test@barberagency.com', 'guest', true, NOW(), NOW());
    `, [nullRoleUserId]);

    // Check if login workflow queries resolve them to allowed_admin
    const loginRoleCheckQuery = `
      WITH target_barberia AS (
        SELECT id, owner_id FROM public.barberias WHERE id = 198
      ),
      auth_user AS (
        SELECT id, role, email FROM public.usuarios WHERE id = $1
      ),
      resolved AS (
        SELECT
          CASE
            WHEN COALESCE(NULLIF(u.role, ''), 'guest') IN ('admin', 'owner', 'super_admin')
              AND (
                tb.owner_id = u.id OR 
                EXISTS (
                  SELECT 1 FROM public.barberia_miembros m 
                  WHERE m.barberia_id = tb.id 
                    AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) 
                    AND m.rol IN ('owner', 'admin', 'super_admin')
                    AND m.activo = true
                )
              )
              THEN 'allowed_admin'
            ELSE 'forbidden'
          END AS access_status
        FROM target_barberia tb
        CROSS JOIN auth_user u
      )
      SELECT access_status FROM resolved;
    `;

    const loginRes = await runSQL(loginRoleCheckQuery, [nullRoleUserId]);
    const accessStatus = loginRes[0]?.access_status;

    // Clean up
    await runSQL(`DELETE FROM public.barberia_miembros WHERE usuario_id = $1;`, [nullRoleUserId]);
    await runSQL(`DELETE FROM public.usuarios WHERE id = $1;`, [nullRoleUserId]);

    if (accessStatus === 'allowed_admin') {
      console.error('❌ FAIL: User with NULL role was promoted to admin! Security leak.');
      exitCode = 1;
    } else {
      console.log('✅ PASS: User with NULL role defaulted to guest/forbidden.');
    }

  } catch (err) {
    console.error('Error in test execution:', err);
    exitCode = 1;
  } finally {
    await cleanup();
    process.exit(exitCode);
  }
})();
