const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('--- TABLES WITH ROW SECURITY ---');
    const tables = await runSQL(
      `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
    );
    console.log(JSON.stringify(tables, null, 2));

    console.log('\n--- EXISTING POLICIES ---');
    const policies = await runSQL(
      `SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies;`
    );
    console.log(JSON.stringify(policies, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
