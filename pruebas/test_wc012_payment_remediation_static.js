const assert = require('assert');
const fs = require('fs');

const migration = fs.readFileSync('migrations/20260810_1600_wc012_payment_security_remediation.sql', 'utf8');
const rollback = fs.readFileSync('migrations/20260810_1600_wc012_payment_security_remediation_rollback.sql', 'utf8');
const observability = fs.readFileSync('pruebas/wc012_observability_queries.sql', 'utf8');

function mustContain(text, needle, label) {
  assert(text.includes(needle), `${label}: missing ${needle}`);
}

function mustNotContain(text, needle, label) {
  assert(!text.includes(needle), `${label}: forbidden ${needle}`);
}

function mustNotContainExecutable(text, statement, label) {
  const executableLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('--'));
  assert(!executableLines.some((line) => line.toUpperCase().startsWith(statement)), `${label}: forbidden executable ${statement}`);
}

mustContain(migration, 'CREATE ROLE ba_checkout_app', 'separated checkout role');
mustContain(migration, 'CREATE ROLE ba_webhook_worker', 'separated webhook role');
mustContain(migration, 'CREATE ROLE ba_outbox_worker', 'separated outbox role');
mustContain(migration, 'p_currency_id TEXT', 'currency reaches PostgreSQL');
mustContain(migration, 'p_provider_checkout_id TEXT', 'preference reaches PostgreSQL');
mustContain(migration, 'p_amount <> v_plan.expected_amount', 'exact amount equality');
mustContain(migration, 'p_currency_id <> v_plan.expected_currency', 'explicit currency equality');
mustContain(migration, 'PREFERENCE_MISMATCH', 'preference binding');
mustContain(migration, 'EXTERNAL_REFERENCE_MISMATCH', 'external reference binding');
mustContain(migration, 'uq_payment_transactions_provider_payment', 'payment id uniqueness');
mustContain(migration, 'uq_payment_attempt_provider_event', 'provider event uniqueness');
mustContain(migration, 'REVOKE EXECUTE ON FUNCTION public.billing_process_approved_payment', 'public execute hardening');
mustContain(migration, 'GRANT EXECUTE ON FUNCTION public.billing_process_approved_payment', 'exact grant');
mustContain(migration, 'TO ba_webhook_worker', 'webhook worker grant');
mustContain(migration, 'TO ba_outbox_worker', 'outbox worker grant');
mustContain(migration, 'ALTER FUNCTION public.billing_outbox_claim_batch(TEXT, INT, INT)', 'outbox claim hardened');
mustContain(migration, 'ALTER FUNCTION public.billing_outbox_mark_processed(UUID)', 'outbox mark processed hardened');
mustContain(migration, 'SECURITY DEFINER', 'security definer functions');
mustContain(migration, 'SET search_path = public, pg_temp', 'fixed search path');
mustNotContain(migration, 'PASSWORD', 'no password in migration');
mustNotContain(migration, ['postgres', '://'].join(''), 'no connection string in migration');

mustContain(rollback, 'No usar DROP OWNED', 'safe rollback');
mustContain(rollback, 'REVOKE EXECUTE ON FUNCTION', 'rollback revokes first');
mustNotContainExecutable(rollback, 'DROP OWNED', 'no destructive drop owned');
mustNotContainExecutable(rollback, 'REASSIGN OWNED', 'no reassignment');

mustContain(observability, ':provider_payment_id', 'parameterized payment');
mustContain(observability, ':provider_event_id', 'parameterized event');
mustContain(observability, 'expected_amount', 'amount observation');
mustContain(observability, 'provider_currency_id', 'currency observation');
mustContain(observability, 'subscription_id', 'subscription correlation');
mustContain(observability, 'license_id', 'license correlation');

const workflows = [
  ['pruebas/mp_create_checkout_workflow_downloaded.json', 'BA_POSTGRES_CHECKOUT_APP_PLACEHOLDER'],
  ['pruebas/mp_webhook_receiver_workflow_downloaded.json', 'BA_POSTGRES_WEBHOOK_WORKER_PLACEHOLDER'],
  ['pruebas/mp_webhook_processor_workflow_downloaded.json', 'BA_POSTGRES_WEBHOOK_WORKER_PLACEHOLDER'],
  ['pruebas/billing_outbox_processor_workflow_downloaded.json', 'BA_POSTGRES_OUTBOX_WORKER_PLACEHOLDER'],
];

for (const [file, expectedCredential] of workflows) {
  const raw = fs.readFileSync(file, 'utf8');
  JSON.parse(raw);
  mustContain(raw, expectedCredential, file);
  mustNotContain(raw, 'Postgres account', file);
  mustNotContain(raw, ['SOV6o', 'SyuHI9cxgLF'].join(''), file);
  mustNotContain(raw, ['CGRko', 'VsQuGre5o37'].join(''), file);
}

const receiver = fs.readFileSync('pruebas/mp_webhook_receiver_workflow_downloaded.json', 'utf8');
const receiverJson = JSON.parse(receiver);
const receiverNodeNames = receiverJson.nodes.map((node) => node.name);
const validateIndex = receiverNodeNames.indexOf('Validate MP Signature');
const registerIndex = receiverNodeNames.indexOf('PG - Register Webhook');
assert(validateIndex !== -1, 'receiver validates Mercado Pago signature');
assert(registerIndex !== -1, 'receiver has register webhook node');
assert(validateIndex < registerIndex, 'signature validation node appears before PostgreSQL side effect');
assert.strictEqual(receiverJson.connections['Webhook Receiver'].main[0][0].node, 'Validate MP Signature', 'webhook connects first to signature validation');
assert.strictEqual(receiverJson.connections['Validate MP Signature'].main[0][0].node, 'PG - Register Webhook', 'signature validation connects to first side effect');
mustContain(receiver, 'MP_WEBHOOK_SECRET', 'receiver uses injected webhook secret');
mustContain(receiver, 'WEBHOOK_SIGNATURE_MISSING', 'receiver fail-closed missing signature');
mustContain(receiver, 'WEBHOOK_REQUEST_ID_MISSING', 'receiver fail-closed missing request id');
mustContain(receiver, 'WEBHOOK_DATA_ID_MISSING', 'receiver fail-closed missing data id');
mustContain(receiver, 'WEBHOOK_SIGNATURE_MISMATCH', 'receiver fail-closed mismatch');
mustContain(receiver, 'crypto.timingSafeEqual', 'receiver timing-safe comparison');
mustContain(receiver, 'id:${String(dataId).trim()};request-id:${String(xRequestId).trim()};ts:${String(parts.ts).trim()};', 'receiver official Mercado Pago manifest');

const processor = fs.readFileSync('pruebas/mp_webhook_processor_workflow_downloaded.json', 'utf8');
mustContain(processor, '$json.currency_id', 'processor passes currency');
mustContain(processor, '$json.preference_id', 'processor passes preference');
mustContain(processor, 'billing_process_approved_payment', 'processor calls hardened RPC');

const manifest = fs.readFileSync('infra/wc011-staging/migrations/manifest.json', 'utf8');
mustContain(manifest, '20260810_1600_wc012_payment_security_remediation.sql', 'manifest includes WC-012 remediation');
mustContain(manifest, '"order": 6', 'manifest orders WC-012 after 1500');
mustContain(manifest, 'REQUIRED_DIRECT_SUPERSEDING', 'manifest classifies WC-012 as superseding');

console.log('WC-012 payment remediation static tests passed');
