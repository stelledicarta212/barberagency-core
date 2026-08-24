const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const envPath = path.join(__dirname, '..', 'infra', 'wc011-staging', 'env', 'staging.env');

function loadEnv(filePath) {
  const parsed = {};
  if (!fs.existsSync(filePath)) return parsed;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=\s]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }
  return parsed;
}

const env = loadEnv(envPath);
assert.ok(env.STAGING_DB_PASSWORD, 'STAGING_DB_PASSWORD is required');

const connection = {
  host: '127.0.0.1',
  port: Number(env.STAGING_DB_PORT || 55432),
  database: env.STAGING_DB_NAME || 'barberagency_staging',
  user: env.STAGING_DB_USER || 'ba_staging_owner',
  password: env.STAGING_DB_PASSWORD,
};

const payment = {
  externalReference: 'ba_v1_990012_monthly_74ff6513_1991a1',
  paymentId: '175042424798',
  eventId: '175042424798',
  preferenceId: '175042424798',
  amount: '50000',
  currency: 'COP',
  fee: '0',
  method: 'master',
};

async function withClient(fn) {
  const client = new Client(connection);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function counts(client) {
  const result = await client.query(
    `
    SELECT
      (SELECT count(*)::int FROM public.payment_transactions WHERE provider='mercadopago' AND provider_payment_id=$1) AS payment_tx,
      (SELECT count(*)::int FROM public.billing_invoices WHERE metadata->>'provider_payment_id'=$1 AND status='paid') AS invoice_paid,
      (SELECT count(*)::int FROM public.subscriptions WHERE barberia_id=990012 AND status='active') AS subscription_active,
      (SELECT count(*)::int FROM public.business_licenses WHERE metadata->>'provider_payment_id'=$1) AS license_count,
      (SELECT count(*)::int FROM public.business_licenses WHERE metadata->>'provider_payment_id'=$1 AND status='available' AND assigned_barberia_id IS NULL) AS license_unassigned,
      (
        SELECT count(*)::int
        FROM public.business_license_events ble
        JOIN public.business_licenses bl ON bl.id=ble.license_id
        WHERE bl.metadata->>'provider_payment_id'=$1
          AND ble.event_type='license_available_created'
      ) AS license_events
    `,
    [payment.paymentId]
  );
  return result.rows[0];
}

async function processPayment(workerId) {
  return withClient(async (client) => {
    const result = await client.query(
      `
      SELECT *
      FROM public.billing_process_approved_payment($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        payment.externalReference,
        payment.paymentId,
        payment.eventId,
        payment.preferenceId,
        payment.amount,
        payment.currency,
        payment.fee,
        payment.method,
      ]
    );
    return { workerId, row: result.rows[0] };
  });
}

(async () => {
  const workers = 4;
  const before = await withClient(counts);
  const results = await Promise.all(Array.from({ length: workers }, (_, index) => processPayment(index + 1)));
  const after = await withClient(counts);

  for (const item of results) {
    assert.equal(item.row.success, true, `worker ${item.workerId} must return success`);
  }

  assert.equal(after.payment_tx, 1, 'payment transaction must remain idempotent');
  assert.equal(after.invoice_paid, 1, 'paid invoice must remain idempotent');
  assert.equal(after.subscription_active, 1, 'active subscription count must remain stable');
  assert.equal(after.license_count, 1, 'license count must remain idempotent');
  assert.equal(after.license_unassigned, 1, 'license must remain available and unassigned');
  assert.equal(after.license_events, 1, 'license audit event must remain idempotent');

  console.log(JSON.stringify({
    result: 'PASS',
    concurrent_workers: workers,
    before,
    after,
  }));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
