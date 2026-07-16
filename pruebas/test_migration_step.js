const { setup, cleanup, runSQL } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    console.log('Testing ALTER TABLE public.planes ADD COLUMN IF NOT EXISTS code TEXT;');
    const res = await runSQL('ALTER TABLE public.planes ADD COLUMN IF NOT EXISTS code TEXT;');
    console.log('Result:', JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await cleanup();
  }
})();
