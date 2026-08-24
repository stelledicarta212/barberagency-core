const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const envPath = path.join(__dirname, '../infra/wc011-staging/env/staging.env');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const [key, ...rest] = trimmed.split('=');
  env[key.trim()] = rest.join('=').trim();
}

const dbName = `wc012_runtime_${Date.now()}`;
const applied = [];
const temporaryRolePasswords = {};

function client(database = env.STAGING_DB_NAME, user = env.STAGING_DB_USER, password = env.STAGING_DB_PASSWORD) {
  return new Client({
    host: '127.0.0.1',
    port: Number(env.STAGING_DB_PORT || 55432),
    database,
    user,
    password,
  });
}

async function withClient(database, fn, user, password) {
  const c = client(database, user, password);
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function applySql(database, file) {
  const sql = fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('echo '))
    .join('\n');
  const start = Date.now();
  try {
    await withClient(database, (c) => c.query(sql));
    applied.push({ file, result: 'PASS', durationMs: Date.now() - start });
  } catch (error) {
    applied.push({ file, result: 'FAIL', durationMs: Date.now() - start, error: error.message });
    throw error;
  }
}

async function expectReject(label, promise) {
  try {
    await promise;
  } catch (error) {
    return { label, result: 'PASS', error: error.message.split('\n')[0] };
  }
  throw new Error(`${label}: expected rejection`);
}

async function expectPass(label, promise) {
  const value = await promise;
  return { label, result: 'PASS', value };
}

async function asRole(database, role, sql, params = []) {
  return withClient(database, async (c) => {
    await c.query(`SET ROLE ${role}`);
    try {
      return await c.query(sql, params);
    } finally {
      await c.query('RESET ROLE');
    }
  });
}

function sqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

async function connectAsRole(database, role, sql, params = []) {
  return withClient(database, (c) => c.query(sql, params), role, temporaryRolePasswords[role]);
}

async function registerWebhook(c, eventId, paymentId, eventType = 'payment.created') {
  await c.query(`SELECT * FROM public.billing_register_webhook('mercadopago', $1::text, $2::text, jsonb_build_object('data', jsonb_build_object('id', $3::text)))`, [eventId, eventType, paymentId]);
}

async function configureTemporaryRolePasswords(database) {
  await withClient(database, async (c) => {
    for (const role of ['ba_checkout_app', 'ba_webhook_worker', 'ba_outbox_worker']) {
      temporaryRolePasswords[role] = crypto.randomBytes(32).toString('base64url');
      await c.query(`ALTER ROLE ${role} PASSWORD '${sqlLiteral(temporaryRolePasswords[role])}'`);
    }
  });
}

async function clearTemporaryRolePasswords() {
  await withClient(env.STAGING_DB_NAME, async (c) => {
    for (const role of ['ba_checkout_app', 'ba_webhook_worker', 'ba_outbox_worker']) {
      await c.query(`ALTER ROLE ${role} PASSWORD NULL`);
    }
  });
}

async function main() {
  const root = path.join(__dirname, '..');
  const migrationFiles = [
    'infra/wc011-staging/migrations/postgres-identity-bootstrap.sql',
    'infra/wc011-staging/migrations/postgres-core-tables.sql',
    'migrations/20260713_2026_add_plan_codes.sql',
    'migrations/20260713_2027_expand_billing_core_v2.sql',
    'migrations/20260713_2028_billing_roles_and_grants.sql',
    'migrations/20260713_2029_billing_rpc_core.sql',
    'migrations/20260713_2030_add_billing_outbox.sql',
    'migrations/20260810_1600_wc012_payment_security_remediation.sql',
    'migrations/20260713_2033_add_billing_auditor_readonly.sql',
    'migrations/20260713_2034_harden_billing_audit_access.sql',
    'migrations/20260803_1200_wc004_license_schema.sql',
    'migrations/20260803_1400_wc011_harden_payment_reconciliation.sql',
    'migrations/20260803_1500_wc012_provision_ba_app.sql',
    'migrations/20260810_1600_wc012_payment_security_remediation.sql',
    'migrations/20260810_1700_wc006_runtime_license_transition.sql',
  ].map((f) => path.join(root, f));

  await withClient(env.STAGING_DB_NAME, async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await c.query(`CREATE DATABASE ${dbName}`);
  });

  try {
    const remediationFile = path.join(root, 'migrations/20260810_1600_wc012_payment_security_remediation.sql');
    for (const file of migrationFiles) {
      await applySql(dbName, file);
    }
    await applySql(dbName, remediationFile);
    await configureTemporaryRolePasswords(dbName);

    const fixtures = await withClient(dbName, async (c) => {
      await c.query(`INSERT INTO public.usuarios (id, email, nombre) VALUES (501, 'owner-a@example.test', 'Owner A'), (502, 'owner-b@example.test', 'Owner B') ON CONFLICT (id) DO NOTHING`);
      const plan = await c.query(`SELECT id FROM public.planes WHERE code = 'barberagency_full' LIMIT 1`);
      const planId = plan.rows[0]?.id || 4224;
      await c.query(`INSERT INTO public.planes (id, nombre, precio, code) VALUES ($1, 'Plan Test', 50000.00, 'barberagency_full') ON CONFLICT (code) DO UPDATE SET precio = EXCLUDED.precio`, [planId]);
      const monthlyPrice = await c.query(`SELECT id FROM public.plan_prices WHERE plan_id = $1 AND name = 'monthly' AND currency = 'COP' AND active = true LIMIT 1`, [planId]);
      if (monthlyPrice.rows.length === 0) {
        throw new Error('monthly plan price not found after baseline migrations');
      }
      const monthlyPlanPriceId = monthlyPrice.rows[0].id;
      await c.query(`INSERT INTO public.barberias (id, nombre, slug, owner_id, plan_id) VALUES (701, 'Tenant A', 'tenant-a-runtime', 501, $1), (702, 'Tenant B', 'tenant-b-runtime', 502, $1) ON CONFLICT (id) DO NOTHING`, [planId]);
      await c.query(`INSERT INTO public.billing_checkouts (id, barberia_id, plan_price_id, status, idempotency_key, external_reference, provider_checkout_id, expires_at) VALUES ('11111111-1111-1111-1111-111111111111', 701, $1, 'created', 'idem-a', 'ba_v1_701_monthly_runtime_a', 'pref-a', now() + interval '1 hour'), ('22222222-2222-2222-2222-222222222222', 702, $1, 'created', 'idem-b', 'ba_v1_702_monthly_runtime_b', 'pref-b', now() + interval '1 hour') ON CONFLICT (id) DO NOTHING`, [monthlyPlanPriceId]);
      for (const [eventId, paymentId] of [
        ['evt-a-001', 'pay-a-001'],
        ['evt-b-low', 'pay-b-low'],
        ['evt-b-high', 'pay-b-high'],
        ['evt-b-null', 'pay-b-null'],
        ['evt-b-neg', 'pay-b-neg'],
        ['evt-b-usd', 'pay-b-usd'],
        ['evt-b-cnull', 'pay-b-cnull'],
        ['evt-b-lowercop', 'pay-b-lowercop'],
        ['evt-b-pref', 'pay-b-pref'],
        ['evt-missing', 'pay-missing'],
        ['evt-reuse', 'pay-a-001'],
        ['evt-b-direct-ok', 'pay-b-direct-ok'],
        ['evt-role-1', 'pay-role-1'],
        ['evt-role-2', 'pay-role-2'],
        ['evt-role-3', 'pay-role-3'],
        ['evt-role-4', 'pay-role-4'],
      ]) {
        await registerWebhook(c, eventId, paymentId);
      }
      return { tenants: 2, monthlyPlanPriceId };
    });

    const validSql = `SELECT * FROM public.billing_process_approved_payment($1,$2,$3,$4,$5,$6,$7,$8)`;
    const amountCurrency = [];
    amountCurrency.push(await expectPass('amount_exact_currency_cop', withClient(dbName, (c) => c.query(validSql, ['ba_v1_701_monthly_runtime_a', 'pay-a-001', 'evt-a-001', 'pref-a', '50000.00', 'COP', '0', 'card']))));
    amountCurrency.push(await expectReject('amount_lower', withClient(dbName, (c) => c.query(validSql, ['ba_v1_702_monthly_runtime_b', 'pay-b-low', 'evt-b-low', 'pref-b', '49999.99', 'COP', '0', 'card']))));
    amountCurrency.push(await expectReject('amount_higher', withClient(dbName, (c) => c.query(validSql, ['ba_v1_702_monthly_runtime_b', 'pay-b-high', 'evt-b-high', 'pref-b', '50000.01', 'COP', '0', 'card']))));
    amountCurrency.push(await expectReject('amount_null', withClient(dbName, (c) => c.query(validSql, ['ba_v1_702_monthly_runtime_b', 'pay-b-null', 'evt-b-null', 'pref-b', null, 'COP', '0', 'card']))));
    amountCurrency.push(await expectReject('amount_negative', withClient(dbName, (c) => c.query(validSql, ['ba_v1_702_monthly_runtime_b', 'pay-b-neg', 'evt-b-neg', 'pref-b', '-1.00', 'COP', '0', 'card']))));
    amountCurrency.push(await expectReject('currency_usd', withClient(dbName, (c) => c.query(validSql, ['ba_v1_702_monthly_runtime_b', 'pay-b-usd', 'evt-b-usd', 'pref-b', '50000.00', 'USD', '0', 'card']))));
    amountCurrency.push(await expectReject('currency_null', withClient(dbName, (c) => c.query(validSql, ['ba_v1_702_monthly_runtime_b', 'pay-b-cnull', 'evt-b-cnull', 'pref-b', '50000.00', null, '0', 'card']))));
    amountCurrency.push(await expectReject('currency_lowercase', withClient(dbName, (c) => c.query(validSql, ['ba_v1_702_monthly_runtime_b', 'pay-b-lowercop', 'evt-b-lowercop', 'pref-b', '50000.00', 'cop', '0', 'card']))));

    const binding = [];
    binding.push(await expectReject('preference_mismatch', withClient(dbName, (c) => c.query(validSql, ['ba_v1_702_monthly_runtime_b', 'pay-b-pref', 'evt-b-pref', 'pref-a', '50000.00', 'COP', '0', 'card']))));
    binding.push(await expectReject('external_reference_missing', withClient(dbName, (c) => c.query(validSql, ['ba_v1_missing', 'pay-missing', 'evt-missing', 'pref-a', '50000.00', 'COP', '0', 'card']))));
    binding.push(await expectPass('duplicate_payment_id_idempotent', withClient(dbName, (c) => c.query(validSql, ['ba_v1_701_monthly_runtime_a', 'pay-a-001', 'evt-a-001', 'pref-a', '50000.00', 'COP', '0', 'card']))));
    binding.push(await expectReject('payment_id_reused_other_checkout', withClient(dbName, (c) => c.query(validSql, ['ba_v1_702_monthly_runtime_b', 'pay-a-001', 'evt-reuse', 'pref-b', '50000.00', 'COP', '0', 'card']))));

    const counts = await withClient(dbName, async (c) => ({
      transactions: (await c.query(`SELECT count(*)::int AS n FROM public.payment_transactions`)).rows[0].n,
      invoices: (await c.query(`SELECT count(*)::int AS n FROM public.billing_invoices`)).rows[0].n,
      subscriptions: (await c.query(`SELECT count(*)::int AS n FROM public.subscriptions`)).rows[0].n,
      outbox: (await c.query(`SELECT count(*)::int AS n FROM public.billing_outbox WHERE event_type='payment_approved'`)).rows[0].n,
    }));

    const security = await withClient(dbName, async (c) => {
      const roles = await c.query(`SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolinherit FROM pg_roles WHERE rolname IN ('ba_checkout_app','ba_webhook_worker','ba_outbox_worker') ORDER BY rolname`);
      const publicExec = await c.query(`
        SELECT p.proname,
               pg_get_function_identity_arguments(p.oid) AS args,
               EXISTS (
                 SELECT 1
                 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
                 WHERE acl.grantee = 0
                   AND acl.privilege_type = 'EXECUTE'
               ) AS public_execute
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public'
          AND p.proname IN ('billing_create_checkout_backend','billing_register_webhook','billing_process_approved_payment','billing_outbox_claim_batch','billing_outbox_mark_processed','billing_outbox_mark_failed')
        ORDER BY p.proname,args`);
      const rls = await c.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('billing_checkouts','payment_attempts','payment_transactions','payment_webhook_events','billing_invoices','billing_outbox') ORDER BY relname`);
      return { roles: roles.rows, publicExec: publicExec.rows, rls: rls.rows };
    });

    const roleTests = [];
    roleTests.push(await expectPass('checkout_role_direct_connection_identity', connectAsRole(dbName, 'ba_checkout_app', `SELECT current_user, session_user, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = current_user`)));
    roleTests.push(await expectPass('webhook_worker_direct_connection_identity', connectAsRole(dbName, 'ba_webhook_worker', `SELECT current_user, session_user, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = current_user`)));
    roleTests.push(await expectPass('outbox_worker_direct_connection_identity', connectAsRole(dbName, 'ba_outbox_worker', `SELECT current_user, session_user, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole, rolreplication FROM pg_roles WHERE rolname = current_user`)));
    roleTests.push(await expectPass('checkout_role_can_create_checkout', connectAsRole(dbName, 'ba_checkout_app', `SELECT * FROM public.billing_create_checkout_backend(701,'barberagency_full','monthly',501)`)));
    roleTests.push(await expectPass('webhook_worker_can_register_webhook', connectAsRole(dbName, 'ba_webhook_worker', `SELECT * FROM public.billing_register_webhook('mercadopago','evt-direct-role','payment.created','{"data":{"id":"pay-direct-role"}}'::jsonb)`)));
    roleTests.push(await expectPass('webhook_worker_can_process_payment', connectAsRole(dbName, 'ba_webhook_worker', validSql, ['ba_v1_702_monthly_runtime_b', 'pay-b-direct-ok', 'evt-b-direct-ok', 'pref-b', '50000.00', 'COP', '0', 'card'])));
    const outboxForDirectRole = await withClient(dbName, async (c) => {
      const inserted = await c.query(`
        INSERT INTO public.billing_outbox(event_type, aggregate_type, aggregate_id, barberia_id, payload, idempotency_key)
        VALUES ('checkout_created','checkout','runtime-direct-outbox',701,'{}','runtime-direct-outbox-idem')
        ON CONFLICT (idempotency_key) DO UPDATE SET status = 'pending', locked_by = NULL, locked_at = NULL
        RETURNING id
      `);
      return inserted.rows[0].id;
    });
    roleTests.push(await expectPass('outbox_worker_can_claim_batch', connectAsRole(dbName, 'ba_outbox_worker', `SELECT * FROM public.billing_outbox_claim_batch('direct-worker', 10, 300)`)));
    roleTests.push(await expectPass('outbox_worker_can_mark_processed', connectAsRole(dbName, 'ba_outbox_worker', `SELECT public.billing_outbox_mark_processed($1, 'direct-worker')`, [outboxForDirectRole])));
    roleTests.push(await expectReject('checkout_role_cannot_process_payment', asRole(dbName, 'ba_checkout_app', validSql, ['ba_v1_702_monthly_runtime_b', 'pay-role-1', 'evt-role-1', 'pref-b', '50000.00', 'COP', '0', 'card'])));
    roleTests.push(await expectReject('webhook_worker_cannot_create_checkout', asRole(dbName, 'ba_webhook_worker', `SELECT * FROM public.billing_create_checkout_backend(701,'barberagency_full','monthly',501)`)));
    roleTests.push(await expectReject('outbox_worker_cannot_process_payment', asRole(dbName, 'ba_outbox_worker', validSql, ['ba_v1_702_monthly_runtime_b', 'pay-role-2', 'evt-role-2', 'pref-b', '50000.00', 'COP', '0', 'card'])));
    roleTests.push(await expectReject('checkout_role_direct_cannot_read_payment_transactions', connectAsRole(dbName, 'ba_checkout_app', `SELECT count(*) FROM public.payment_transactions`)));
    roleTests.push(await expectReject('webhook_worker_direct_cannot_read_billing_outbox', connectAsRole(dbName, 'ba_webhook_worker', `SELECT count(*) FROM public.billing_outbox`)));
    roleTests.push(await expectReject('outbox_worker_direct_cannot_update_subscriptions', connectAsRole(dbName, 'ba_outbox_worker', `UPDATE public.subscriptions SET status='active' WHERE false`)));
    roleTests.push(await expectReject('checkout_role_direct_cannot_create_schema', connectAsRole(dbName, 'ba_checkout_app', `CREATE SCHEMA wc012_forbidden_schema`)));
    roleTests.push(await expectReject('webhook_worker_direct_cannot_alter_role', connectAsRole(dbName, 'ba_webhook_worker', `ALTER ROLE ba_checkout_app NOCREATEDB`)));
    roleTests.push(await expectReject('outbox_worker_direct_cannot_disable_rls', connectAsRole(dbName, 'ba_outbox_worker', `ALTER TABLE public.billing_outbox DISABLE ROW LEVEL SECURITY`)));
    roleTests.push(await expectReject('anon_cannot_process_payment', asRole(dbName, 'anon', validSql, ['ba_v1_702_monthly_runtime_b', 'pay-role-3', 'evt-role-3', 'pref-b', '50000.00', 'COP', '0', 'card'])));
    roleTests.push(await expectReject('authenticated_cannot_process_payment', asRole(dbName, 'authenticated', validSql, ['ba_v1_702_monthly_runtime_b', 'pay-role-4', 'evt-role-4', 'pref-b', '50000.00', 'COP', '0', 'card'])));

    const outbox = await withClient(dbName, async (c) => {
      const inserted = await c.query(`
        INSERT INTO public.billing_outbox(event_type, aggregate_type, aggregate_id, barberia_id, payload, idempotency_key)
        VALUES ('checkout_created','checkout','runtime-outbox',701,'{}','runtime-outbox-idem')
        ON CONFLICT (idempotency_key) DO UPDATE SET status = 'pending', locked_by = NULL, locked_at = NULL
        RETURNING id
      `);
      const targetId = inserted.rows[0].id;
      const claim1 = await c.query(`SELECT outbox_id FROM public.billing_outbox_claim_batch('w1', 10, 300)`);
      const claim2 = await c.query(`SELECT outbox_id FROM public.billing_outbox_claim_batch('w2', 10, 300)`);
      const targetFirstClaimed = claim1.rows.some((row) => row.outbox_id === targetId);
      const targetSecondClaimed = claim2.rows.some((row) => row.outbox_id === targetId);
      if (!targetFirstClaimed || targetSecondClaimed) {
        throw new Error(`outbox concurrency failure targetFirstClaimed=${targetFirstClaimed} targetSecondClaimed=${targetSecondClaimed}`);
      }
      return { targetFirstClaimed, targetSecondClaimed, firstBatch: claim1.rows.length, secondBatch: claim2.rows.length };
    });

    const rollbackFile = path.join(root, 'migrations/20260810_1600_wc012_payment_security_remediation_rollback.sql');
    const wc006RollbackFile = path.join(root, 'migrations/20260810_1700_wc006_runtime_license_transition_rollback.sql');
    await applySql(dbName, wc006RollbackFile);
    await applySql(dbName, rollbackFile);
    await applySql(dbName, path.join(root, 'migrations/20260810_1600_wc012_payment_security_remediation.sql'));
    await applySql(dbName, path.join(root, 'migrations/20260810_1700_wc006_runtime_license_transition.sql'));

    console.log(JSON.stringify({
      database: dbName,
      migrations: applied,
      fixtures,
      amountCurrency,
      binding,
      counts,
      security,
      roleTests,
      outbox,
      result: 'PASS'
    }, null, 2));
  } finally {
    try {
      await clearTemporaryRolePasswords();
    } catch (_) {
      // La base desechable puede haber fallado antes de crear roles; no imprimir detalles sensibles.
    }
    await withClient(env.STAGING_DB_NAME, async (c) => {
      await c.query(`DROP DATABASE IF EXISTS ${dbName}`);
    });
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ result: 'FAIL', database: dbName, applied, error: error.message }, null, 2));
  process.exit(1);
});
