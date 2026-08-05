const fs = require('fs');
const path = require('path');
const { setup, cleanup, runSQL } = require('./run_postgres_query');

const migrations = [
  {
    step: 1,
    name: '20260713_2026_add_plan_codes.sql',
    path: '../migrations/20260713_2026_add_plan_codes.sql',
    postcheck: `
      SELECT id, nombre, code, precio 
      FROM public.planes 
      ORDER BY id ASC;
    `
  },
  {
    step: 2,
    name: '20260713_2027_expand_billing_core_v2.sql',
    path: '../migrations/20260713_2027_expand_billing_core_v2.sql',
    postcheck: `
      SELECT pp.id, p.nombre AS plan_name, pp.name AS tier_name, pp.amount, pp.currency, pp.active
      FROM public.plan_prices pp
      JOIN public.planes p ON pp.plan_id = p.id
      ORDER BY p.id, pp.amount ASC;
    `
  },
  {
    step: 3,
    name: '20260713_2028_billing_roles_and_grants.sql',
    path: '../migrations/20260713_2028_billing_roles_and_grants.sql',
    postcheck: `
      SELECT table_name, privilege_type, grantee 
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'public' 
        AND table_name IN ('plan_prices', 'billing_invoices')
      ORDER BY table_name, privilege_type ASC;
    `
  },
  {
    step: 4,
    name: '20260713_2029_billing_rpc_core.sql',
    path: '../migrations/20260713_2029_billing_rpc_core.sql',
    postcheck: `
      SELECT routine_name, routine_type, security_type
      FROM information_schema.routines
      WHERE routine_schema = 'public' 
        AND routine_name IN ('billing_create_checkout', 'billing_register_webhook', 'billing_process_approved_payment')
      ORDER BY routine_name ASC;
    `
  },
  {
    step: 5,
    name: '20260713_2030_add_billing_outbox.sql',
    path: '../migrations/20260713_2030_add_billing_outbox.sql',
    postcheck: `
      SELECT table_name, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'billing_outbox';
    `
  }
];

(async () => {
  try {
    await setup();
    console.log('\n========================================');
    console.log('STARTING STAGING MIGRATION PIPELINE');
    console.log('========================================\n');

    for (const m of migrations) {
      console.log(`\n>>> [STEP ${m.step}] Applying ${m.name}...`);
      
      const filePath = path.resolve(__dirname, m.path);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${filePath}`);
      }
      
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      
      // Execute the migration SQL
      const result = await runSQL(sqlContent);
      
      // If result contains errors from n8n Postgres node
      if (result && result.error) {
        throw new Error(`Migration failed at step ${m.step} (${m.name}): ${JSON.stringify(result.error)}`);
      }
      
      console.log(`>>> [STEP ${m.step}] Success. Running postchecks...`);
      
      // Execute the postcheck verification query
      const checkResult = await runSQL(m.postcheck);
      console.log('Verification query results:');
      console.log(JSON.stringify(checkResult, null, 2));
    }

    console.log('\n========================================');
    console.log('ALL STAGING MIGRATIONS APPLIED SUCCESSFULLY');
    console.log('========================================\n');

  } catch (err) {
    console.error('\n!!! MIGRATION PIPELINE ABORTED DUE TO ERROR !!!');
    console.error(err.message || err);
  } finally {
    await cleanup();
  }
})();
