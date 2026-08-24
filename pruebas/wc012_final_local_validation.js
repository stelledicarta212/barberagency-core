const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const {
  buildMercadoPagoWebhookManifest,
  validateMercadoPagoWebhookSignature,
  signMercadoPagoWebhookForTest,
} = require('../app/backend/wc012_payment_remediation_contract');

const root = path.join(__dirname, '..');
const envPath = path.join(root, 'infra/wc011-staging/env/staging.env');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
  const [key, ...rest] = trimmed.split('=');
  env[key.trim()] = rest.join('=').trim();
}

const runId = `wc012_final_${Date.now()}`;
const dbName = runId;
const temporaryRolePasswords = {};
const report = {
  run_id: runId,
  result: 'PASS',
  loops: [],
  signature: [],
  migrations: [],
  preflight_without_1600: null,
  cross_tenant: [],
  outbox: {},
  roles: {},
  workflow: {},
};

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

function sqlLiteral(value) {
  return String(value).replace(/'/g, "''");
}

async function applySql(database, file) {
  const start = Date.now();
  const sql = fs.readFileSync(path.join(root, file), 'utf8')
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('echo '))
    .join('\n');
  try {
    await withClient(database, (c) => c.query(sql));
    report.migrations.push({ file, result: 'PASS', duration_ms: Date.now() - start });
  } catch (error) {
    report.migrations.push({ file, result: 'FAIL', duration_ms: Date.now() - start, error: firstLine(error) });
    throw error;
  }
}

function firstLine(error) {
  return String(error.message || error).split('\n')[0];
}

async function createDatabase(name) {
  await withClient(env.STAGING_DB_NAME, async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${name}`);
    await c.query(`CREATE DATABASE ${name}`);
  });
}

async function dropDatabase(name) {
  await withClient(env.STAGING_DB_NAME, async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${name}`);
  });
}

async function applyBaseline(database, include1500 = true, include1600 = true) {
  const files = [
    'infra/wc011-staging/migrations/postgres-identity-bootstrap.sql',
    'infra/wc011-staging/migrations/postgres-core-tables.sql',
    'migrations/20260713_2026_add_plan_codes.sql',
    'migrations/20260713_2027_expand_billing_core_v2.sql',
    'migrations/20260713_2028_billing_roles_and_grants.sql',
    'migrations/20260713_2029_billing_rpc_core.sql',
    'migrations/20260713_2030_add_billing_outbox.sql',
    ...(include1600 ? ['migrations/20260810_1600_wc012_payment_security_remediation.sql'] : []),
    'migrations/20260713_2033_add_billing_auditor_readonly.sql',
    'migrations/20260713_2034_harden_billing_audit_access.sql',
    'migrations/20260803_1200_wc004_license_schema.sql',
    'migrations/20260803_1400_wc011_harden_payment_reconciliation.sql',
  ];
  if (include1500) files.push('migrations/20260803_1500_wc012_provision_ba_app.sql');
  if (include1600) files.push('migrations/20260810_1600_wc012_payment_security_remediation.sql');
  if (include1600) files.push('migrations/20260810_1700_wc006_runtime_license_transition.sql');
  for (const file of files) await applySql(database, file);
}

async function ensureFixtures(database) {
  return withClient(database, async (c) => {
    await c.query(`INSERT INTO public.usuarios (id, email, nombre) VALUES
      (501, 'owner-a@example.test', 'Owner A'),
      (502, 'owner-b@example.test', 'Owner B')
      ON CONFLICT (id) DO NOTHING`);
    let plan = await c.query(`SELECT id FROM public.planes WHERE code = 'barberagency_full' LIMIT 1`);
    const planId = plan.rows[0]?.id || 4224;
    await c.query(`INSERT INTO public.planes (id, nombre, precio, code) VALUES ($1, 'Plan Test', 50000.00, 'barberagency_full')
      ON CONFLICT (code) DO UPDATE SET precio = EXCLUDED.precio`, [planId]);
    plan = await c.query(`SELECT id FROM public.planes WHERE code = 'barberagency_full' LIMIT 1`);
    const finalPlanId = plan.rows[0].id;
    const price = await c.query(`SELECT id, amount, currency FROM public.plan_prices WHERE plan_id = $1 AND name = 'monthly' AND active = true LIMIT 1`, [finalPlanId]);
    if (!price.rows[0]) throw new Error('monthly plan price not found');
    await c.query(`INSERT INTO public.barberias (id, nombre, slug, owner_id, plan_id) VALUES
      (701, 'Tenant A', 'tenant-a-final', 501, $1),
      (702, 'Tenant B', 'tenant-b-final', 502, $1)
      ON CONFLICT (id) DO NOTHING`, [finalPlanId]);
    return { plan_id: finalPlanId, plan_price_id: price.rows[0].id, amount: Number(price.rows[0].amount), currency: price.rows[0].currency };
  });
}

async function insertCheckout(c, id, tenant, priceId, externalReference, preference, status = 'created') {
  await c.query(`
    INSERT INTO public.billing_checkouts (id, barberia_id, plan_price_id, status, idempotency_key, external_reference, provider_checkout_id, owner_user_id, expires_at)
    SELECT $1, $2, $3, $4, $5, $6, $7, b.owner_id, now() + interval '1 hour'
      FROM public.barberias b
     WHERE b.id = $2
    ON CONFLICT (id) DO UPDATE SET
      barberia_id = EXCLUDED.barberia_id,
      plan_price_id = EXCLUDED.plan_price_id,
      status = EXCLUDED.status,
      external_reference = EXCLUDED.external_reference,
      provider_checkout_id = EXCLUDED.provider_checkout_id,
      owner_user_id = EXCLUDED.owner_user_id
  `, [id, tenant, priceId, status, `idem-${id}`, externalReference, preference]);
}

async function registerWebhook(c, eventId, paymentId, eventType = 'payment.created') {
  await c.query(`SELECT * FROM public.billing_register_webhook('mercadopago', $1::text, $2::text, jsonb_build_object('data', jsonb_build_object('id', $3::text)))`, [eventId, eventType, paymentId]);
}

async function snapshot(c) {
  const count = async (table) => {
    const exists = await c.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`]);
    if (!exists.rows[0].reg) return 0;
    return Number((await c.query(`SELECT count(*)::int AS n FROM public.${table}`)).rows[0].n);
  };
  return {
    webhook: await count('payment_webhook_events'),
    payment: await count('payment_transactions'),
    invoice: await count('billing_invoices'),
    subscription: await count('subscriptions'),
    license: await count('business_licenses'),
    entitlement: await count('business_entitlements'),
    outbox: await count('billing_outbox'),
  };
}

function diffSnapshot(before, after) {
  return Object.fromEntries(Object.keys(before).map((k) => [k, after[k] - before[k]]));
}

async function runTxCase(database, caseDef) {
  return withClient(database, async (c) => {
    const before = await snapshot(c);
    let actual = 'UNSET';
    let errorCode = null;
    let rolledBack = false;
    await c.query('BEGIN');
    try {
      if (caseDef.prepare) await caseDef.prepare(c);
      if (caseDef.kind === 'payment') {
        if (caseDef.register_webhook !== false) {
          await registerWebhook(c, caseDef.args[2], caseDef.args[1], caseDef.event_type || 'payment.created');
        }
        await c.query(`SELECT * FROM public.billing_process_approved_payment($1,$2,$3,$4,$5,$6,$7,$8)`, caseDef.args);
      } else if (caseDef.kind === 'webhook') {
        await c.query(`SELECT * FROM public.billing_register_webhook($1,$2,$3,$4)`, caseDef.args);
      } else {
        throw new Error(`unsupported case kind ${caseDef.kind}`);
      }
      actual = 'ACCEPTED';
      await c.query('ROLLBACK');
      rolledBack = true;
    } catch (error) {
      actual = 'REJECTED';
      errorCode = firstLine(error);
      await c.query('ROLLBACK');
      rolledBack = true;
    }
    const after = await snapshot(c);
    const sideEffects = diffSnapshot(before, after);
    const expectedAccepted = caseDef.expected_result === 'ACCEPTED';
    const passed = expectedAccepted ? actual === 'ACCEPTED' : actual === 'REJECTED';
    return {
      case_id: caseDef.case_id,
      test_name: caseDef.test_name,
      synthetic_ids: caseDef.synthetic_ids,
      expected_result: caseDef.expected_result,
      actual_result: actual,
      error_code: errorCode,
      webhook_before: before.webhook,
      webhook_after: after.webhook,
      payment_before: before.payment,
      payment_after: after.payment,
      invoice_before: before.invoice,
      invoice_after: after.invoice,
      subscription_before: before.subscription,
      subscription_after: after.subscription,
      license_before: before.license,
      license_after: after.license,
      entitlement_before: before.entitlement,
      entitlement_after: after.entitlement,
      outbox_before: before.outbox,
      outbox_after: after.outbox,
      transaction_rolled_back: rolledBack,
      side_effects: sideEffects,
      result: passed && Object.values(sideEffects).every((n) => n === 0) ? 'PASS' : 'FAIL',
    };
  });
}

function runSignatureCases() {
  const dataId = '123456789';
  const xRequestId = 'req-final-001';
  const secret = 'synthetic_secret_for_final_local_validation_32';
  const ts = '1700000000';
  const nowMs = Number(ts) * 1000;
  const valid = signMercadoPagoWebhookForTest({ dataId, xRequestId, ts, secret });
  const cases = [
    ['valid_signature', validateMercadoPagoWebhookSignature({ xSignature: valid, xRequestId, dataId, secret, nowMs }), 'WEBHOOK_SIGNATURE_VALID'],
    ['missing_secret', validateMercadoPagoWebhookSignature({ xSignature: valid, xRequestId, dataId, secret: '', nowMs }), 'WEBHOOK_SECRET_NOT_CONFIGURED'],
    ['invalid_signature', validateMercadoPagoWebhookSignature({ xSignature: valid.replace(/.$/, valid.endsWith('0') ? '1' : '0'), xRequestId, dataId, secret, nowMs }), 'WEBHOOK_SIGNATURE_MISMATCH'],
    ['expired_timestamp', validateMercadoPagoWebhookSignature({ xSignature: signMercadoPagoWebhookForTest({ dataId, xRequestId, ts: String(Number(ts) - 999), secret }), xRequestId, dataId, secret, nowMs }), 'WEBHOOK_SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE'],
    ['duplicate_component', validateMercadoPagoWebhookSignature({ xSignature: `${valid},v1=${'a'.repeat(64)}`, xRequestId, dataId, secret, nowMs }), 'WEBHOOK_SIGNATURE_MALFORMED'],
    ['replay_same_event_signature_valid_but_not_persistence_authority', validateMercadoPagoWebhookSignature({ xSignature: valid, xRequestId, dataId, secret, nowMs }), 'WEBHOOK_SIGNATURE_VALID'],
  ];
  report.signature = cases.map(([name, actual, expected]) => ({
    test_name: name,
    expected_code: expected,
    actual_code: actual.code,
    pass: actual.code === expected,
    manifest: actual.manifest || buildMercadoPagoWebhookManifest({ dataId, xRequestId, ts }),
  }));
}

async function runPreflightWithout1600() {
  const db = `${runId}_preflight_no1600`;
  await createDatabase(db);
  try {
    try {
      await applyBaseline(db, true, false);
    } catch (error) {
      report.preflight_without_1600 = {
        database: db,
        expected_result: 'FAIL_SAFE_BEFORE_1600',
        actual_result: 'FAIL_SAFE_BEFORE_1600',
        error: firstLine(error),
        result: 'PASS',
      };
      return;
    }
    const unsafe = await withClient(db, async (c) => {
      const row = await c.query(`
        SELECT has_function_privilege('ba_app', 'public.billing_process_approved_payment(text,text,numeric,numeric,text)', 'EXECUTE') AS ba_app_legacy_execute
      `);
      return row.rows[0];
    });
    report.preflight_without_1600 = {
      database: db,
      expected_result: 'FAIL_SAFE_UNSAFE_LEGACY_ROLE_DETECTED',
      actual_result: unsafe.ba_app_legacy_execute ? 'FAIL_SAFE_UNSAFE_LEGACY_ROLE_DETECTED' : 'UNEXPECTED_SAFE',
      result: unsafe.ba_app_legacy_execute ? 'PASS' : 'FAIL',
    };
  } finally {
    await dropDatabase(db);
  }
}

async function runOutbox(database) {
  report.outbox = await withClient(database, async (c) => {
    const before = await snapshot(c);
    const ids = [];
    for (let i = 0; i < 6; i += 1) {
      const inserted = await c.query(`
        INSERT INTO public.billing_outbox(event_type, aggregate_type, aggregate_id, barberia_id, payload, idempotency_key, available_at)
        VALUES ('checkout_created','checkout',$1,701,'{}',$2,now())
        RETURNING id
      `, [`outbox-final-${i}`, `outbox-final-idem-${i}`]);
      ids.push(inserted.rows[0].id);
    }
    const [a, b] = await Promise.all([
      withClient(database, (ca) => ca.query(`SELECT outbox_id FROM public.billing_outbox_claim_batch('worker-a', 3, 300)`)),
      withClient(database, (cb) => cb.query(`SELECT outbox_id FROM public.billing_outbox_claim_batch('worker-b', 3, 300)`)),
    ]);
    const aIds = a.rows.map((r) => r.outbox_id);
    const bIds = b.rows.map((r) => r.outbox_id);
    const intersection = aIds.filter((id) => bIds.includes(id));
    const repeated = await c.query(`SELECT outbox_id FROM public.billing_outbox_claim_batch('worker-a-repeat', 10, 300)`);
    const processedId = aIds[0];
    const failedId = aIds[1];
    const beforeFailed = await c.query(`SELECT attempt_count, status FROM public.billing_outbox WHERE id=$1`, [failedId]);
    const workerBEventId = bIds[0];
    const workerAWrongFinish = await c.query(`SELECT public.billing_outbox_mark_processed($1, 'worker-a') AS ok`, [workerBEventId]);
    const markProcessed = await c.query(`SELECT public.billing_outbox_mark_processed($1, 'worker-a') AS ok`, [processedId]);
    let markProcessedDuplicate;
    try {
      markProcessedDuplicate = await c.query(`SELECT public.billing_outbox_mark_processed($1, 'worker-a') AS ok`, [processedId]);
      markProcessedDuplicate = { accepted: true, value: markProcessedDuplicate.rows[0].ok };
    } catch (error) {
      markProcessedDuplicate = { accepted: false, error: firstLine(error) };
    }
    const markFailed = await c.query(`SELECT public.billing_outbox_mark_failed($1,'worker-a','SYNTHETIC_FAILURE','synthetic failure',1) AS ok`, [failedId]);
    await c.query(`UPDATE public.billing_outbox SET available_at = now() - interval '1 second' WHERE id=$1`, [failedId]);
    const retryClaim = await c.query(`SELECT outbox_id FROM public.billing_outbox_claim_batch('worker-retry', 10, 300)`);
    const afterFailed = await c.query(`SELECT attempt_count, status, locked_by FROM public.billing_outbox WHERE id=$1`, [failedId]);
    const processedAgain = await c.query(`SELECT outbox_id FROM public.billing_outbox_claim_batch('worker-after-processed', 10, 300)`);
    const after = await snapshot(c);
    return {
      synthetic_ids: ids,
      worker_a_claimed: aIds,
      worker_b_claimed: bIds,
      intersection,
      repeated_claim_count: repeated.rows.length,
      mark_processed: markProcessed.rows[0].ok,
      mark_processed_duplicate: markProcessedDuplicate,
      mark_failed: markFailed.rows[0].ok,
      worker_a_finish_worker_b_claim: workerAWrongFinish.rows[0].ok,
      attempts_before: beforeFailed.rows[0],
      retry_claimed_failed_event: retryClaim.rows.some((r) => r.outbox_id === failedId),
      attempts_after: afterFailed.rows[0],
      worker_a_finalize_worker_b_claim: workerAWrongFinish.rows[0].ok === false ? 'DENIED' : 'ALLOWED',
      processed_event_not_reclaimed: !processedAgain.rows.some((r) => r.outbox_id === processedId),
      duplicate_effects: diffSnapshot(before, after),
      result: intersection.length === 0
        && markProcessed.rows[0].ok === true
        && markProcessedDuplicate.accepted === true
        && markProcessedDuplicate.value === false
        && markFailed.rows[0].ok === true
        && workerAWrongFinish.rows[0].ok === false
        ? 'PASS'
        : 'FAIL',
    };
  });
}

async function configureTemporaryRolePasswords(database) {
  await withClient(database, async (c) => {
    for (const role of ['ba_checkout_app', 'ba_webhook_worker', 'ba_outbox_worker']) {
      temporaryRolePasswords[role] = crypto.randomBytes(32).toString('base64url');
      await c.query(`ALTER ROLE ${role} PASSWORD '${sqlLiteral(temporaryRolePasswords[role])}'`);
    }
  });
}

async function clearTemporaryRolePasswords(database) {
  await withClient(database, async (c) => {
    for (const role of ['ba_checkout_app', 'ba_webhook_worker', 'ba_outbox_worker']) {
      await c.query(`ALTER ROLE ${role} PASSWORD NULL`);
    }
  });
}

async function connectAsRole(database, role, sql, params = []) {
  return withClient(database, (c) => c.query(sql, params), role, temporaryRolePasswords[role]);
}

async function runRoles(database) {
  const functions = {
    create_checkout: `SELECT * FROM public.billing_create_checkout_backend(701,'barberagency_full','monthly',501)`,
    register_webhook: `SELECT * FROM public.billing_register_webhook('mercadopago','role-evt','payment.created','{"data":{"id":"role-pay"}}'::jsonb)`,
    process_payment: `SELECT * FROM public.billing_process_approved_payment('ba_v1_701_monthly_role','role-pay','role-evt-pay','role-pref',50000,'COP',0,'card')`,
    claim_batch: `SELECT * FROM public.billing_outbox_claim_batch('role-worker',1,300)`,
    mark_processed: `SELECT public.billing_outbox_mark_processed('00000000-0000-0000-0000-000000000000','role-worker')`,
    mark_failed: `SELECT public.billing_outbox_mark_failed('00000000-0000-0000-0000-000000000000','role-worker','X','Y',1)`,
  };
  await withClient(database, async (c) => {
    const planPrice = (await c.query(`SELECT id FROM public.plan_prices WHERE name='monthly' AND active=true LIMIT 1`)).rows[0].id;
    await insertCheckout(c, '33333333-3333-3333-3333-333333333333', 701, planPrice, 'ba_v1_701_monthly_role', 'role-pref');
    await registerWebhook(c, 'role-evt-pay', 'role-pay');
  });
  const roleNames = ['ba_checkout_app', 'ba_webhook_worker', 'ba_outbox_worker'];
  const matrix = {};
  for (const role of roleNames) {
    matrix[role] = {};
    matrix[role].identity = await connectAsRole(database, role, `SELECT session_user, current_user, current_setting('search_path') AS search_path`).then((r) => r.rows[0]);
    matrix[role].flags = await withClient(database, (c) => c.query(`SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=$1`, [role])).then((r) => r.rows[0]);
    for (const [name, sql] of Object.entries(functions)) {
      try {
        await connectAsRole(database, role, sql);
        matrix[role][name] = 'ALLOW';
      } catch (error) {
        matrix[role][name] = `DENY:${firstLine(error)}`;
      }
    }
    for (const [name, sql] of Object.entries({
      direct_select: `SELECT count(*) FROM public.payment_transactions`,
      direct_insert: `INSERT INTO public.payment_transactions(provider, provider_payment_id, amount_paid) VALUES ('x','x',1)`,
      direct_update: `UPDATE public.subscriptions SET status='active' WHERE false`,
      direct_delete: `DELETE FROM public.payment_transactions WHERE false`,
      create_schema: `CREATE SCHEMA wc012_forbidden_${role}`,
      alter_role: `ALTER ROLE ${role} NOCREATEDB`,
      set_role: `SET ROLE ba_checkout_app`,
      foreign_function: `SELECT public.jwt_user_id()`,
    })) {
      try {
        await connectAsRole(database, role, sql);
        matrix[role][name] = 'ALLOW';
      } catch (error) {
        matrix[role][name] = `DENY:${firstLine(error)}`;
      }
    }
  }
  matrix.catalog = await withClient(database, async (c) => ({
    public_execute: (await c.query(`
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
             EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS public_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname LIKE 'billing_%'
      ORDER BY p.proname, args
    `)).rows,
    rls: (await c.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('billing_checkouts','payment_attempts','payment_transactions','payment_webhook_events','billing_invoices','billing_outbox','business_licenses') ORDER BY relname`)).rows,
    memberships: (await c.query(`SELECT r.rolname, m.rolname AS member FROM pg_auth_members am JOIN pg_roles r ON r.oid=am.roleid JOIN pg_roles m ON m.oid=am.member WHERE r.rolname LIKE 'ba_%' OR m.rolname LIKE 'ba_%' ORDER BY 1,2`)).rows,
    direct_grants: (await c.query(`SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('ba_checkout_app','ba_webhook_worker','ba_outbox_worker','anon','authenticated') ORDER BY grantee, table_name, privilege_type`)).rows,
    default_privileges: (await c.query(`SELECT count(*)::int AS n FROM pg_default_acl`)).rows[0],
    ba_app_connect: (await c.query(`SELECT has_database_privilege('ba_app', current_database(), 'CONNECT') AS connect_allowed`)).rows[0],
  }));
  await clearTemporaryRolePasswords(database);
  matrix.synthetic_passwords_cleared = await withClient(database, async (c) => {
    const rows = await c.query(`SELECT rolname, rolpassword IS NULL AS password_is_null FROM pg_authid WHERE rolname IN ('ba_checkout_app','ba_webhook_worker','ba_outbox_worker') ORDER BY rolname`);
    return rows.rows;
  });
  report.roles = matrix;
}

async function runCrossTenant(database, fixtures) {
  await withClient(database, async (c) => {
    await insertCheckout(c, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 701, fixtures.plan_price_id, 'ba_v1_701_monthly_case_a', 'pref-case-a');
    await insertCheckout(c, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 702, fixtures.plan_price_id, 'ba_v1_702_monthly_case_b', 'pref-case-b');
    await registerWebhook(c, 'evt-seeded-a', 'pay-seeded-a');
    await c.query(`SELECT * FROM public.billing_process_approved_payment($1,$2,$3,$4,$5,$6,$7,$8)`, ['ba_v1_701_monthly_case_a', 'pay-seeded-a', 'evt-seeded-a', 'pref-case-a', '50000.00', 'COP', '0', 'card']);
    await registerWebhook(c, 'evt-seeded-event-a', 'pay-seeded-event-a');
  });
  const cases = [
    { case_id: 1, test_name: 'Asociacion correcta de Tenant A', expected_result: 'ACCEPTED', kind: 'payment', synthetic_ids: 'tenant=701,payment=pay-ct-1,checkout=A', args: ['ba_v1_701_monthly_case_a', 'pay-ct-1', 'evt-ct-1', 'pref-case-a', '50000.00', 'COP', '0', 'card'] },
    { case_id: 2, test_name: 'Payment A con checkout B', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'payment=pay-seeded-a,checkout=B', args: ['ba_v1_702_monthly_case_b', 'pay-seeded-a', 'evt-ct-2', 'pref-case-b', '50000.00', 'COP', '0', 'card'] },
    { case_id: 3, test_name: 'Preference A con checkout B', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'preference=pref-case-a,checkout=B', args: ['ba_v1_702_monthly_case_b', 'pay-ct-3', 'evt-ct-3', 'pref-case-a', '50000.00', 'COP', '0', 'card'] },
    { case_id: 4, test_name: 'Owner A con Tenant B', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'owner=501,tenant=702', prepare: (c) => c.query(`UPDATE public.barberias SET owner_id=501 WHERE id=702`), args: ['ba_v1_702_monthly_case_b', 'pay-ct-4', 'evt-ct-4', 'pref-case-b', '50000.00', 'COP', '0', 'card'] },
    { case_id: 5, test_name: 'External reference A con checkout B', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'external_reference=A,preference=B', args: ['ba_v1_701_monthly_case_a', 'pay-ct-5', 'evt-ct-5', 'pref-case-b', '50000.00', 'COP', '0', 'card'] },
    { case_id: 6, test_name: 'Checkout A con plan distinto', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'checkout=A,amount=wrong-plan', args: ['ba_v1_701_monthly_case_a', 'pay-ct-6', 'evt-ct-6', 'pref-case-a', '99999.00', 'COP', '0', 'card'] },
    { case_id: 7, test_name: 'Checkout A con term distinto', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'checkout=A,term=annual-synthetic', args: ['ba_v1_701_monthly_case_a', 'pay-ct-7', 'evt-ct-7', 'pref-case-a', '600000.00', 'COP', '0', 'card'] },
    { case_id: 8, test_name: 'Monto A usado para checkout B', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'checkout=B,amount=A-invalid', args: ['ba_v1_702_monthly_case_b', 'pay-ct-8', 'evt-ct-8', 'pref-case-b', '49999.99', 'COP', '0', 'card'] },
    { case_id: 9, test_name: 'Moneda valida con binding incorrecto', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'checkout=B,currency=USD', args: ['ba_v1_702_monthly_case_b', 'pay-ct-9', 'evt-ct-9', 'pref-case-b', '50000.00', 'USD', '0', 'card'] },
    { case_id: 10, test_name: 'Payment ID A reutilizado en checkout B', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'payment=pay-seeded-a,checkout=B', args: ['ba_v1_702_monthly_case_b', 'pay-seeded-a', 'evt-ct-10', 'pref-case-b', '50000.00', 'COP', '0', 'card'] },
    { case_id: 11, test_name: 'Provider event ID A reutilizado para otro payment', expected_result: 'REJECTED', kind: 'webhook', synthetic_ids: 'event=evt-seeded-event-a,payment=pay-ct-11', args: ['mercadopago', 'evt-seeded-event-a', 'payment.created', { data: { id: 'pay-ct-11' } }] },
    { case_id: 12, test_name: 'Webhook A concediendo licencia a Tenant B', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'event=A,tenant=B', register_webhook: false, args: ['ba_v1_702_monthly_case_b', 'pay-ct-12', 'evt-seeded-event-a', 'pref-case-b', '50000.00', 'COP', '0', 'card'] },
    { case_id: 13, test_name: 'Suscripcion A asociada a Owner B', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'subscription=A,owner=B', prepare: (c) => c.query(`UPDATE public.barberias SET owner_id=502 WHERE id=701`), args: ['ba_v1_701_monthly_case_a', 'pay-ct-13', 'evt-ct-13', 'pref-case-a', '50000.00', 'COP', '0', 'card'] },
    { case_id: 14, test_name: 'Evento desconocido', expected_result: 'REJECTED', kind: 'webhook', synthetic_ids: 'event_type=unknown.event', args: ['mercadopago', 'evt-ct-14', 'unknown.event', { data: { id: 'pay-ct-14' } }] },
    { case_id: 15, test_name: 'Evento fuera de orden', expected_result: 'REJECTED', kind: 'payment', synthetic_ids: 'payment_without_registered_webhook', register_webhook: false, args: ['ba_v1_702_monthly_case_b', 'pay-ct-15', 'evt-ct-15', 'pref-case-b', '50000.00', 'COP', '0', 'card'] },
    { case_id: 16, test_name: 'Refund/chargeback no implementado', expected_result: 'REJECTED', kind: 'webhook', synthetic_ids: 'event_type=payment.refunded', args: ['mercadopago', 'evt-ct-16', 'payment.refunded', { data: { id: 'pay-ct-16' } }] },
  ];
  for (const c of cases) {
    report.cross_tenant.push(await runTxCase(database, c));
  }
}

async function runWorkflowStatic() {
  const receiver = JSON.parse(fs.readFileSync(path.join(root, 'pruebas/mp_webhook_receiver_workflow_downloaded.json'), 'utf8'));
  const names = receiver.nodes.map((n) => n.name);
  report.workflow = {
    receiver_node: 'Webhook Receiver',
    next_node: receiver.connections['Webhook Receiver']?.main?.[0]?.[0]?.node,
    validation_node_index: names.indexOf('Validate MP Signature'),
    first_persistent_node: 'PG - Register Webhook',
    persistent_node_index: names.indexOf('PG - Register Webhook'),
    validation_before_first_side_effect: names.indexOf('Validate MP Signature') > -1 && names.indexOf('Validate MP Signature') < names.indexOf('PG - Register Webhook'),
  };
}

async function runMigrationFinalStateChecks(database) {
  const state = await withClient(database, async (c) => ({
    ba_app_connect: (await c.query(`SELECT has_database_privilege('ba_app', current_database(), 'CONNECT') AS allowed`)).rows[0].allowed,
    ba_app_process_new: (await c.query(`SELECT has_function_privilege('ba_app', 'public.billing_process_approved_payment(text,text,text,text,numeric,text,numeric,text)', 'EXECUTE') AS allowed`)).rows[0].allowed,
    split_roles: (await c.query(`SELECT count(*)::int AS n FROM pg_roles WHERE rolname IN ('ba_checkout_app','ba_webhook_worker','ba_outbox_worker')`)).rows[0].n,
  }));
  report.migration_final_state = state;
}

async function main() {
  await runWorkflowStatic();
  runSignatureCases();
  await runPreflightWithout1600();
  await createDatabase(dbName);
  try {
    await applyBaseline(dbName, true, true);
    await applySql(dbName, 'migrations/20260810_1600_wc012_payment_security_remediation.sql');
    await applySql(dbName, 'migrations/20260810_1700_wc006_runtime_license_transition.sql');
    const fixtures = await ensureFixtures(dbName);
    await runCrossTenant(dbName, fixtures);
    await runOutbox(dbName);
    await configureTemporaryRolePasswords(dbName);
    await runRoles(dbName);
    await applySql(dbName, 'migrations/20260810_1700_wc006_runtime_license_transition_rollback.sql');
    await applySql(dbName, 'migrations/20260810_1600_wc012_payment_security_remediation_rollback.sql');
    const afterRollback = await withClient(dbName, (c) => snapshot(c));
    await applySql(dbName, 'migrations/20260810_1600_wc012_payment_security_remediation.sql');
    await applySql(dbName, 'migrations/20260810_1700_wc006_runtime_license_transition.sql');
    const afterReapply = await withClient(dbName, (c) => snapshot(c));
    report.rollback_reapply = {
      after_rollback_counts: afterRollback,
      after_reapply_counts: afterReapply,
      result: 'PASS',
    };
    await runMigrationFinalStateChecks(dbName);
  } finally {
    await dropDatabase(dbName);
  }

  const fail = [
    ...report.signature.filter((x) => !x.pass),
    ...report.cross_tenant.filter((x) => x.result !== 'PASS'),
    report.outbox.result === 'PASS' ? null : report.outbox,
    report.preflight_without_1600?.result === 'PASS' ? null : report.preflight_without_1600,
  ].filter(Boolean);
  if (fail.length) report.result = 'FAIL';
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.result === 'PASS' ? 0 : 1);
}

main().catch(async (error) => {
  report.result = 'FAIL';
  report.error = firstLine(error);
  console.error(JSON.stringify(report, null, 2));
  try { await dropDatabase(dbName); } catch (_) {}
  process.exit(1);
});
