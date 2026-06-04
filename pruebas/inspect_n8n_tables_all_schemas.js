const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('Querying all schemas for execution/workflow tables...');
    const tables = await runSQL("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%execution%' OR table_name LIKE '%workflow%' OR table_name LIKE '%entity%';");
    console.log(JSON.stringify(tables, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
