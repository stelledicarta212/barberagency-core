const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('--- FUNCTION definition: ba_publicar_barberia ---');
    const func = await runSQL(
      `SELECT prosrc FROM pg_proc WHERE proname = 'ba_publicar_barberia';`
    );
    if (func.length > 0) {
      console.log(func[0].prosrc);
    } else {
      console.log('Function not found.');
    }

  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
