const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('--- Current Procedure Definition ---');
    const procInfo = await runSQL(`
      SELECT p.proname, p.prosecdef, pg_get_function_arguments(p.oid) as arguments, pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'ba_publicar_barberia' AND n.nspname = 'public';
    `);
    console.log(JSON.stringify(procInfo, null, 2));

    console.log('--- Current Privileges ---');
    const privs = await runSQL(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_schema = 'public' AND routine_name = 'ba_publicar_barberia';
    `);
    console.log(JSON.stringify(privs, null, 2));
  } catch (e) {
    console.error('Error fetching evidence:', e);
  } finally {
    await cleanup();
  }
})();
