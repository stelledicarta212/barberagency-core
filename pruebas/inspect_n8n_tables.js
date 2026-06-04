const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('Listing n8n tables...');
    const tables = await runSQL("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%execution%' OR table_name LIKE '%workflow%';");
    console.log(JSON.stringify(tables, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
