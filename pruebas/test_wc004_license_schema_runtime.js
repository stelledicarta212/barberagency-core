const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const migrationPath = path.join(root, 'migrations', '20260803_1200_wc004_license_schema.sql');
const rollbackPath = path.join(root, 'migrations', '20260803_1200_wc004_license_schema_rollback.sql');

const pg = {
  host: process.env.WC004_PGHOST || '127.0.0.1',
  port: process.env.WC004_PGPORT,
  database: process.env.WC004_PGDATABASE || 'wc004_validation',
  user: process.env.WC004_PGUSER || 'wc004_admin',
};
const psqlBin = process.env.WC004_PSQL_BIN || 'psql';
const pgPassword = process.env.WC004_PGPASSWORD ?? process.env.PGPASSWORD ?? '';

assert(pg.port, 'WC004_PGPORT is required');

function psql(args, input, expectedStatus = 0) {
  const result = spawnSync(
    psqlBin,
    [
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-h',
      pg.host,
      '-p',
      pg.port,
      '-U',
      pg.user,
      '-d',
      pg.database,
      ...args,
    ],
    {
      input,
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: pgPassword },
      windowsHide: true,
      timeout: 15000,
    },
  );

  if (result.status !== expectedStatus) {
    throw new Error(
      [
        `psql exited ${result.status}, expected ${expectedStatus}`,
        result.stdout.trim(),
        result.stderr.trim(),
      ].filter(Boolean).join('\n'),
    );
  }

  return result.stdout;
}

function sql(query) {
  return psql(['-At', '-c', query]).trim();
}

function execSql(query) {
  return psql([], query);
}

function expectError(label, query, pattern) {
  const result = spawnSync(
    psqlBin,
    [
      '-X',
      '-v',
      'ON_ERROR_STOP=1',
      '-h',
      pg.host,
      '-p',
      pg.port,
      '-U',
      pg.user,
      '-d',
      pg.database,
      '-c',
      query,
    ],
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: pgPassword }, windowsHide: true, timeout: 15000 },
  );

  assert.notStrictEqual(result.status, 0, `${label}: expected failure`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert(pattern.test(output), `${label}: unexpected error output: ${output}`);
}

function lastNumericValue(output) {
  const values = output.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^\d+$/.test(line));
  assert(values.length > 0, `expected numeric psql output, got: ${output}`);
  return values[values.length - 1];
}

function phase(name) {
  console.log(`WC004_RUNTIME_PHASE=${name}`);
}

function bootstrapBaseSchema() {
  execSql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
    END $$;

    DROP TABLE IF EXISTS public.barberias CASCADE;
    DROP TABLE IF EXISTS public.usuarios CASCADE;
    CREATE TABLE public.usuarios (
      id integer PRIMARY KEY,
      email text NOT NULL
    );
    CREATE TABLE public.barberias (
      id integer PRIMARY KEY,
      owner_id integer NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
      nombre text NOT NULL
    );

    CREATE OR REPLACE FUNCTION public.jwt_user_id()
    RETURNS integer
    LANGUAGE sql
    STABLE
    AS $fn$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::integer
    $fn$;

    GRANT USAGE ON SCHEMA public TO authenticated, anon;
    GRANT SELECT ON public.usuarios, public.barberias TO authenticated, anon;

    INSERT INTO public.usuarios (id, email) VALUES
      (1, 'owner1@example.test'),
      (2, 'owner2@example.test');
    INSERT INTO public.barberias (id, owner_id, nombre) VALUES
      (101, 1, 'Barberia TEST 1'),
      (202, 2, 'Barberia TEST 2');
  `);
}

function applyMigration() {
  psql(['-f', migrationPath]);
}

function applyRollback() {
  psql(['-f', rollbackPath]);
}

function verifyStructure() {
  const tables = sql(`
    SELECT count(*)
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('business_licenses','woocommerce_license_order_items','business_license_events')
  `);
  assert.strictEqual(tables, '3', 'WC-004 table count mismatch');

  const rls = sql(`
    SELECT count(*)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('business_licenses','woocommerce_license_order_items','business_license_events')
      AND c.relrowsecurity
      AND c.relforcerowsecurity
  `);
  assert.strictEqual(rls, '3', 'RLS/FORCE RLS mismatch');

  const writerRole = sql(`SELECT count(*) FROM pg_roles WHERE rolname = 'ba_wc_license_writer'`);
  assert.strictEqual(writerRole, '1', 'writer role missing');

  const authenticatedWrites = sql(`
    SELECT count(*)
    FROM information_schema.role_table_grants
    WHERE grantee = 'authenticated'
      AND table_schema = 'public'
      AND table_name IN ('business_licenses','woocommerce_license_order_items','business_license_events')
      AND privilege_type IN ('INSERT','UPDATE','DELETE')
  `);
  assert.strictEqual(authenticatedWrites, '0', 'authenticated has write grants');

  const writerGrants = sql(`
    SELECT count(*)
    FROM information_schema.role_table_grants
    WHERE grantee = 'ba_wc_license_writer'
      AND table_schema = 'public'
      AND (
        (table_name = 'business_licenses' AND privilege_type IN ('SELECT','INSERT','UPDATE'))
        OR (table_name = 'woocommerce_license_order_items' AND privilege_type IN ('SELECT','INSERT','UPDATE'))
        OR (table_name = 'business_license_events' AND privilege_type IN ('SELECT','INSERT'))
      )
  `);
  assert.strictEqual(writerGrants, '8', 'writer grants mismatch');
}

function seedCanonicalRows() {
  execSql(`
    SET ROLE ba_wc_license_writer;
    INSERT INTO public.business_licenses (
      id, owner_id, assigned_barberia_id, status, current_period_term,
      period_start, period_end, grace_until, assigned_at, metadata
    ) VALUES
      (1001, 1, NULL, 'available', 'monthly', NULL, NULL, NULL, NULL, '{"case":"available"}'),
      (1002, 1, 101, 'assigned', 'monthly', '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z', '2026-09-04T00:00:00Z', '2026-08-01T00:00:00Z', '{"case":"assigned"}'),
      (2001, 2, 202, 'assigned', 'monthly', '2026-08-01T00:00:00Z', '2026-09-01T00:00:00Z', '2026-09-04T00:00:00Z', '2026-08-01T00:00:00Z', '{"case":"other-owner"}');

    INSERT INTO public.woocommerce_license_order_items (
      id, source_event_id, idempotency_key, canonical_reference, owner_id,
      owner_resolution_source, woocommerce_customer_id, woocommerce_order_id,
      woocommerce_order_item_id, product_id, variation_id, billing_term,
      amount_cents, currency, resulting_license_id, processing_status,
      payload_reference, payload_sanitized
    ) VALUES (
      5001, 'evt_test_1', 'wc:4241:item:9001:paid:v1', 'wc:4241:item:9001', 1,
      'server_session', 301, 4241, 9001, 4224, 4225, 'monthly',
      50000, 'COP', 1001, 'processed', 'local-runtime-fixture', '{"redacted":true}'
    );

    INSERT INTO public.business_license_events (
      id, license_id, wc_order_item_link_id, owner_id, event_type,
      event_source, idempotency_key, previous_status, new_status, reason, payload_sanitized
    ) VALUES (
      7001, 1001, 5001, 1, 'license_available_created',
      'woocommerce', 'evt:license:1001:created', NULL, 'available', 'runtime-test', '{"redacted":true}'
    );
    RESET ROLE;
  `);
}

function verifyConstraintsAndIdempotency() {
  expectError(
    'invalid variation amount rejected',
    `
      SET ROLE ba_wc_license_writer;
      INSERT INTO public.woocommerce_license_order_items (
        source_event_id, idempotency_key, canonical_reference, owner_id,
        owner_resolution_source, woocommerce_customer_id, woocommerce_order_id,
        woocommerce_order_item_id, product_id, variation_id, billing_term,
        amount_cents, currency
      ) VALUES (
        'evt_invalid_amount', 'bad-amount', 'wc:4242:item:9002', 1,
        'server_session', 301, 4242, 9002, 4224, 4225, 'monthly',
        1, 'COP'
      );
    `,
    /chk_wc_license_variation_term_amount|violates check constraint/i,
  );

  expectError(
    'duplicate idempotency key rejected',
    `
      SET ROLE ba_wc_license_writer;
      INSERT INTO public.woocommerce_license_order_items (
        source_event_id, idempotency_key, canonical_reference, owner_id,
        owner_resolution_source, woocommerce_customer_id, woocommerce_order_id,
        woocommerce_order_item_id, product_id, variation_id, billing_term,
        amount_cents, currency
      ) VALUES (
        'evt_duplicate_idem', 'wc:4241:item:9001:paid:v1', 'wc:4243:item:9003', 1,
        'server_session', 301, 4243, 9003, 4224, 4225, 'monthly',
        50000, 'COP'
      );
    `,
    /ux_wc_license_idempotency_key|duplicate key value/i,
  );

  expectError(
    'available license cannot be assigned',
    `
      SET ROLE ba_wc_license_writer;
      INSERT INTO public.business_licenses (
        owner_id, assigned_barberia_id, status, current_period_term, assigned_at
      ) VALUES (1, 101, 'available', 'monthly', statement_timestamp());
    `,
    /chk_business_licenses_assignment_state|violates check constraint/i,
  );
}

function verifyRls() {
  const ownerVisible = lastNumericValue(psql(['-At', '-c', `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '1';
    SELECT count(*) FROM public.business_licenses;
    COMMIT;
  `]));
  assert.strictEqual(ownerVisible, '2', 'owner 1 should see only own licenses');

  const otherVisible = lastNumericValue(psql(['-At', '-c', `
    BEGIN;
    SET LOCAL ROLE authenticated;
    SET LOCAL request.jwt.claim.sub = '2';
    SELECT count(*) FROM public.business_licenses;
    COMMIT;
  `]));
  assert.strictEqual(otherVisible, '1', 'owner 2 should see only own licenses');

  expectError(
    'authenticated insert denied',
    `
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL request.jwt.claim.sub = '1';
      INSERT INTO public.business_licenses (owner_id, status, current_period_term)
      VALUES (1, 'available', 'monthly');
      COMMIT;
    `,
    /permission denied|permiso denegado|violates row-level security/i,
  );

  expectError(
    'authenticated update denied',
    `
      BEGIN;
      SET LOCAL ROLE authenticated;
      SET LOCAL request.jwt.claim.sub = '1';
      UPDATE public.business_licenses SET status = 'revoked' WHERE id = 1001;
      COMMIT;
    `,
    /permission denied|permiso denegado|violates row-level security/i,
  );

  expectError(
    'anon select denied',
    `
      SET ROLE anon;
      SELECT count(*) FROM public.business_licenses;
    `,
    /permission denied|permiso denegado/i,
  );
}

function verifyRollbackLeavesBaseSchema() {
  applyRollback();
  const wcTables = sql(`
    SELECT count(*)
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('business_licenses','woocommerce_license_order_items','business_license_events')
  `);
  assert.strictEqual(wcTables, '0', 'rollback did not remove WC-004 tables');

  const baseTables = sql(`
    SELECT count(*)
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('usuarios','barberias')
  `);
  assert.strictEqual(baseTables, '2', 'rollback removed base tables');
}

phase('bootstrap_base_schema');
bootstrapBaseSchema();
phase('apply_migration_1');
applyMigration();
phase('verify_structure_1');
verifyStructure();
phase('seed_canonical_rows');
seedCanonicalRows();
phase('verify_constraints_and_idempotency');
verifyConstraintsAndIdempotency();
phase('verify_rls');
verifyRls();
phase('verify_rollback_1');
verifyRollbackLeavesBaseSchema();
phase('apply_migration_2');
applyMigration();
phase('verify_structure_2');
verifyStructure();
phase('verify_rollback_2');
verifyRollbackLeavesBaseSchema();

console.log('WC-004 runtime PostgreSQL migration checks passed');
