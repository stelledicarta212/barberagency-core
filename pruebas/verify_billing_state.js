const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    
    console.log('=== VERIFYING PLAN CODES AND NEW PLAN ===');
    const plans = await runSQL('SELECT id, nombre, code, precio FROM public.planes ORDER BY id;');
    console.log(JSON.stringify(plans, null, 2));

    console.log('\n=== VERIFYING PLAN PRICES SEED ===');
    const prices = await runSQL('SELECT * FROM public.plan_prices;');
    console.log(JSON.stringify(prices, null, 2));

    console.log('\n=== VERIFYING ROLES AND TABLE SECURITY ===');
    const outboxTable = await runSQL("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'billing_outbox';");
    console.log(JSON.stringify(outboxTable, null, 2));

    console.log('\n=== VERIFYING NEW FUNCTIONS / RPCS ===');
    const functions = await runSQL(`
      SELECT routine_name, routine_type, security_type
      FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name LIKE 'billing_%'
      ORDER BY routine_name;
    `);
    console.log(JSON.stringify(functions, null, 2));

  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
