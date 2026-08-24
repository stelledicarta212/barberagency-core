const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(
  __dirname,
  '..',
  'migrations',
  '20260810_1700_wc006_runtime_license_transition.sql'
);

const sql = fs.readFileSync(migrationPath, 'utf8');

assert.match(
  sql,
  /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.wc006_apply_license_transition\s*\(\s*p_invoice_id\s+UUID\s*\)/i,
  'WC006 runtime transition function must exist'
);

assert.match(
  sql,
  /CREATE\s+TRIGGER\s+trg_wc006_apply_license_transition_on_paid_invoice/i,
  'paid invoice trigger must apply WC006 transition after payment processing'
);

assert.match(
  sql,
  /SELECT\s+public\.wc006_apply_license_transition\(id\)\s+FROM\s+paid_invoices/i,
  'migration must idempotently recover already-paid invoices'
);

assert.match(
  sql,
  /INSERT\s+INTO\s+public\.business_licenses\s*\([\s\S]*?assigned_barberia_id[\s\S]*?VALUES\s*\([\s\S]*?NULL[\s\S]*?'available'/i,
  'WC006-created license must remain available and unassigned for WC007 confirmation'
);

assert.match(
  sql,
  /'assignment_contract',\s*'WC-007\.v1'/i,
  'WC006 runtime must preserve WC007 explicit-assignment boundary'
);

assert.match(
  sql,
  /'license_available_created'/i,
  'WC006 runtime must write sanitized license creation audit event'
);

assert.match(
  sql,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.wc006_apply_license_transition\(UUID\)\s+TO\s+ba_webhook_worker/i,
  'WC006 runtime execution must be limited to webhook worker'
);

assert.doesNotMatch(
  sql,
  /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.wc006_apply_license_transition\(UUID\)\s+TO\s+(PUBLIC|anon|authenticated|ba_checkout_app|ba_outbox_worker)/i,
  'WC006 runtime must not be executable by public/browser/outbox roles'
);

console.log('WC-006 runtime payment integration static tests passed');
