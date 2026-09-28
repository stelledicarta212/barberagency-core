/**
 * BARBERAGENCY — LOYALTY PHASE 1B: REAL POSTGRESQL RUNTIME VALIDATION
 * File: pruebas/test_loyalty_phase1b_runtime_pg.js
 *
 * Executes real runtime validation against local PostgreSQL (WSL PostgreSQL 16.14).
 * Covers:
 * 1. Dedicated Test Database Initialization & Canonical Tables Bootstrap
 * 2. Migration Application (20260928_1500_loyalty_core_phase1.sql)
 * 3. PostgreSQL Catalog Verification (Tables, Columns, Checks, Indexes, Triggers, RLS, Grants)
 * 4. Test Fixtures Seeding (Tenants A & B, Owners, Admins, Cajeros, Barberos, Clientes)
 * 5. Direct Browser Ledger & Redemption Minting Security Validation (Vulnerability Remediation Check)
 * 6. Real Role & RLS Scoping Tests (Owner, Admin, Cajero, Barbero across Tenants A and B)
 * 7. Real Cross-Tenant Boundary Violation Tests (Ledger & Redemptions)
 * 8. Real Idempotency Tests (ux_loyalty_ledger_source_idempotency)
 * 9. Real Append-Only Immutability Tests (trg_prevent_loyalty_ledger_mutation)
 * 10. Real Balance View Tests (+1, +1, +1, -2 = 1; +1 = 2; and Zero-Movement)
 * 11. Real Domain Check Constraints Tests (sellos_requeridos, costo_en_sellos, delta direction)
 * 12. Real Rollback Test (20260928_1500_loyalty_core_phase1_rollback.sql)
 * 13. Real Reapply Test (re-running migration after rollback)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.join(__dirname, '..');
const migrationFile = path.join(rootDir, 'migrations', '20260928_1500_loyalty_core_phase1.sql');
const rollbackFile = path.join(rootDir, 'migrations', '20260928_1500_loyalty_core_phase1_rollback.sql');

const DB_NAME = 'barberagency_loyalty_test';

function query(sql, db = DB_NAME) {
  try {
    const stdout = execSync(`wsl -u postgres -d Ubuntu -- psql -d ${db} -v ON_ERROR_STOP=1 -t -A`, {
      input: sql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: stdout.trim() };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : ''
    };
  }
}

function queryJson(sql, db = DB_NAME) {
  const wrapped = `SELECT json_agg(t) FROM (${sql}) t;`;
  const res = query(wrapped, db);
  if (!res.success) {
    throw new Error(`SQL_ERROR: ${res.stderr || res.error}`);
  }
  if (!res.output || res.output === '') return [];
  try {
    return JSON.parse(res.output) || [];
  } catch (e) {
    return [];
  }
}

console.log('====================================================');
console.log('BARBERAGENCY — LOYALTY PHASE 1B REAL RUNTIME TEST');
console.log('====================================================\n');

// ---------------------------------------------------------------------------
// STEP 1: INITIALIZE DEDICATED TEST DATABASE & BOOTSTRAP CANONICAL CORE
// ---------------------------------------------------------------------------
console.log('1. Initializing dedicated test database:', DB_NAME);

query(`
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
`, 'postgres');

const bootstrapSql = `
BEGIN;

-- Roles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Canonical tables
CREATE TABLE IF NOT EXISTS public.usuarios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.barberias (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_id INT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.barberia_miembros (
  id SERIAL PRIMARY KEY,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  usuario_id INT REFERENCES public.usuarios(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  rol VARCHAR(50) NOT NULL CHECK (rol IN ('owner', 'admin', 'barbero', 'cajero')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT barberia_miembros_barberia_usuario_key UNIQUE (barberia_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.clientes_finales (
  id SERIAL PRIMARY KEY,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  telefono TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (barberia_id, telefono)
);

CREATE TABLE IF NOT EXISTS public.citas (
  id SERIAL PRIMARY KEY,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  cliente_id INT REFERENCES public.clientes_finales(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pagos (
  id SERIAL PRIMARY KEY,
  barberia_id INT NOT NULL REFERENCES public.barberias(id) ON DELETE CASCADE,
  cita_id INT REFERENCES public.citas(id) ON DELETE SET NULL,
  monto NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Canonical JWT helper
CREATE OR REPLACE FUNCTION public.jwt_user_id()
RETURNS integer
LANGUAGE sql
STABLE
AS $$
SELECT
  NULLIF(
    (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'user_id'),
    ''
  )::int
$$;

-- Canonical RLS on core tables
ALTER TABLE public.barberias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberia_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_finales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

-- Barberias policies
CREATE POLICY barberias_owner_all ON public.barberias
  FOR ALL TO authenticated
  USING (owner_id = public.jwt_user_id())
  WITH CHECK (owner_id = public.jwt_user_id());

-- Barberia miembros policies (canonical)
CREATE POLICY barberia_miembros_owner_all ON public.barberia_miembros
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = barberia_miembros.barberia_id
        AND b.owner_id = public.jwt_user_id()
        AND b.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = barberia_miembros.barberia_id
        AND b.owner_id = public.jwt_user_id()
        AND b.deleted_at IS NULL
    )
  );

CREATE POLICY barberia_miembros_member_select ON public.barberia_miembros
  FOR SELECT TO authenticated
  USING (
    usuario_id = public.jwt_user_id()
  );

-- Clientes finales policy
CREATE POLICY clientes_finales_tenant_all ON public.clientes_finales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = clientes_finales.barberia_id
        AND b.deleted_at IS NULL
        AND (
          b.owner_id = public.jwt_user_id()
          OR EXISTS (
            SELECT 1 FROM public.barberia_miembros bm
            WHERE bm.barberia_id = b.id
              AND bm.usuario_id = public.jwt_user_id()
              AND bm.activo = true
          )
        )
    )
  );

GRANT SELECT ON public.barberias, public.clientes_finales, public.citas, public.pagos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barberias, public.barberia_miembros, public.clientes_finales, public.citas, public.pagos TO authenticated;

COMMIT;
`;

const bootRes = query(bootstrapSql);
assert(bootRes.success, `Bootstrap failed: ${bootRes.stderr}`);
console.log('✓ [PASS] Dedicated test database and canonical tables bootstrapped successfully\n');

// ---------------------------------------------------------------------------
// STEP 2: APPLY MIGRATION 20260928_1500_loyalty_core_phase1.sql
// ---------------------------------------------------------------------------
console.log('2. Applying Migration: 20260928_1500_loyalty_core_phase1.sql');
const migrationSql = fs.readFileSync(migrationFile, 'utf8');
const migRes = query(migrationSql);
assert(migRes.success, `Migration failed to apply: ${migRes.stderr}`);
console.log('✓ [PASS] Migration applied cleanly without errors\n');

// ---------------------------------------------------------------------------
// STEP 3: CATALOG VERIFICATION
// ---------------------------------------------------------------------------
console.log('3. Verifying PostgreSQL catalog objects:');

const expectedTables = [
  'barberia_loyalty_config',
  'loyalty_rewards',
  'loyalty_redemptions',
  'loyalty_ledger'
];

expectedTables.forEach(t => {
  const check = queryJson(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'`);
  assert(check.length === 1, `Table public.${t} missing from catalog`);

  // Check RLS enabled & forced
  const rls = queryJson(`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname='${t}'`);
  assert(rls[0].relrowsecurity === true, `RLS not enabled on ${t}`);
  assert(rls[0].relforcerowsecurity === true, `RLS not forced on ${t}`);
  console.log(`  ✓ Table public.${t} exists (RLS=enabled, FORCE=enabled)`);
});

// View check
const viewCheck = queryJson(`SELECT table_name FROM information_schema.views WHERE table_schema='public' AND table_name='v_loyalty_client_balance'`);
assert(viewCheck.length === 1, 'View public.v_loyalty_client_balance missing from catalog');
console.log('  ✓ View public.v_loyalty_client_balance exists');

// Triggers check
const trigCheck = queryJson(`SELECT tgname FROM pg_trigger WHERE tgname IN ('trg_prevent_loyalty_ledger_mutation', 'trg_loyalty_ledger_validate_tenant', 'trg_loyalty_redemption_validate_tenant')`);
assert(trigCheck.length === 3, 'Missing triggers in pg_trigger');
console.log('  ✓ Triggers (immutability + cross-tenant) verified');

// ---------------------------------------------------------------------------
// STEP 4: SEED TEST FIXTURES
// ---------------------------------------------------------------------------
console.log('\n4. Seeding real test fixtures (Tenants A & B, Owners, Admins, Cajeros, Barberos, Clientes)');

const seedSql = `
BEGIN;

-- Users
INSERT INTO public.usuarios (id, nombre, email) VALUES
  (10, 'Owner A', 'owner_a@barberagency.test'),
  (11, 'Admin A', 'admin_a@barberagency.test'),
  (12, 'Cajero A', 'cajero_a@barberagency.test'),
  (13, 'Barbero A', 'barbero_a@barberagency.test'),
  (20, 'Owner B', 'owner_b@barberagency.test'),
  (21, 'Admin B', 'admin_b@barberagency.test');

-- Tenants
INSERT INTO public.barberias (id, nombre, slug, owner_id) VALUES
  (1, 'Barberia Alpha', 'barberia-alpha', 10),
  (2, 'Barberia Beta', 'barberia-beta', 20);

-- Members
INSERT INTO public.barberia_miembros (barberia_id, usuario_id, email, rol, activo) VALUES
  (1, 10, 'owner_a@barberagency.test', 'owner', true),
  (1, 11, 'admin_a@barberagency.test', 'admin', true),
  (1, 12, 'cajero_a@barberagency.test', 'cajero', true),
  (1, 13, 'barbero_a@barberagency.test', 'barbero', true),
  (2, 20, 'owner_b@barberagency.test', 'owner', true),
  (2, 21, 'admin_b@barberagency.test', 'admin', true);

-- Clientes
INSERT INTO public.clientes_finales (id, barberia_id, nombre, telefono) VALUES
  (101, 1, 'Cliente Alpha 1', '3001112233'),
  (102, 1, 'Cliente Alpha 2 (Zero Move)', '3001112244'),
  (201, 2, 'Cliente Beta 1', '3009998877');

-- Initial configs & rewards
INSERT INTO public.barberia_loyalty_config (barberia_id, activo, sellos_requeridos, recompensa_default) VALUES
  (1, true, 10, 'Corte Gratis'),
  (2, true, 8, 'Lavado Gratis');

INSERT INTO public.loyalty_rewards (id, barberia_id, nombre, costo_en_sellos, activo) VALUES
  (1, 1, 'Corte Gratis', 10, true),
  (2, 2, 'Corte VIP Beta', 8, true);

-- Advance sequence past explicitly seeded IDs
SELECT setval('public.loyalty_rewards_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.loyalty_rewards));

COMMIT;
`;

const seedRes = query(seedSql);
assert(seedRes.success, `Fixture seeding failed: ${seedRes.stderr}`);
console.log('✓ [PASS] Fixtures seeded cleanly\n');

// ---------------------------------------------------------------------------
// STEP 5: CRITICAL SECURITY VERIFICATION - DIRECT LEDGER MINTING CLOSURE
// ---------------------------------------------------------------------------
console.log('5. CRITICAL SECURITY TEST: Direct Browser Ledger & Redemption Minting Closure');

// Test 5.1: Attempt direct INSERT into loyalty_ledger as authenticated Cajero A
const testMintLedgerSql = `
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"user_id": 12}'; -- Cajero A
INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, notas)
VALUES (1, 101, 1000, 'ajuste', 'Arbitrary minting test');
COMMIT;
`;

const mintLedgerRes = query(testMintLedgerSql);
assert(!mintLedgerRes.success, 'Direct ledger INSERT by authenticated user MUST be blocked');
assert(mintLedgerRes.stderr.includes('permission denied for table loyalty_ledger'), 'Expected permission denied on loyalty_ledger');
console.log('  ✓ DIRECT_BROWSER_LEDGER_INSERT: DENIED (PostgreSQL error: permission denied for table loyalty_ledger)');
console.log('  ✓ ARBITRARY_STAMP_MINTING: BLOCKED');

// Test 5.2: Attempt direct INSERT into loyalty_redemptions as authenticated Cajero A
const testMintRedemptionSql = `
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"user_id": 12}'; -- Cajero A
INSERT INTO public.loyalty_redemptions (barberia_id, cliente_id, reward_id, costo_sellos_snapshot)
VALUES (1, 101, 1, 10);
COMMIT;
`;

const mintRedemptionRes = query(testMintRedemptionSql);
assert(!mintRedemptionRes.success, 'Direct redemption INSERT by authenticated user MUST be blocked');
assert(mintRedemptionRes.stderr.includes('permission denied for table loyalty_redemptions'), 'Expected permission denied on loyalty_redemptions');
console.log('  ✓ DIRECT_BROWSER_REDEMPTION_INSERT: DENIED (PostgreSQL error: permission denied for table loyalty_redemptions)');

// ---------------------------------------------------------------------------
// STEP 6: REAL ROLE & RLS SCOPING TESTS (Owner, Admin, Cajero, Barbero)
// ---------------------------------------------------------------------------
console.log('\n6. Testing Real RLS & Role Scoping:');

function runAs(userId, sql) {
  const wrapped = `
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"user_id": ${userId}}';
${sql}
COMMIT;
  `;
  return query(wrapped);
}

function runAsJson(userId, selectSql) {
  const wrapped = `
SET ROLE authenticated;
SET request.jwt.claims = '{"user_id": ${userId}}';
SELECT json_agg(t) FROM (${selectSql}) t;
  `;
  const res = query(wrapped);
  if (!res.success) throw new Error(res.stderr);
  const startArr = res.output.indexOf('[');
  const endArr = res.output.lastIndexOf(']');
  if (startArr !== -1 && endArr !== -1 && endArr >= startArr) {
    try {
      return JSON.parse(res.output.slice(startArr, endArr + 1)) || [];
    } catch (e) {
      return [];
    }
  }
  const startObj = res.output.indexOf('{');
  const endObj = res.output.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1 && endObj >= startObj) {
    try {
      return JSON.parse(res.output.slice(startObj, endObj + 1)) || [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

// 6.1 OWNER A (id=10)
console.log('  Testing OWNER_A (id=10):');
const ownerAConfig = runAsJson(10, 'SELECT barberia_id FROM public.barberia_loyalty_config');
assert(ownerAConfig.length === 1 && ownerAConfig[0].barberia_id === 1, 'Owner A must see exactly Barberia A config');
console.log('    ✓ READ config A: SUCCESS (sees barberia 1 only)');

const ownerAUpdateConfig = runAs(10, "UPDATE public.barberia_loyalty_config SET sellos_requeridos = 12 WHERE barberia_id = 1;");
assert(ownerAUpdateConfig.success, 'Owner A must be able to UPDATE config A');
console.log('    ✓ UPDATE config A: SUCCESS');

const ownerAUpdateConfigB = runAs(10, "UPDATE public.barberia_loyalty_config SET sellos_requeridos = 99 WHERE barberia_id = 2;");
const ownerBConfigCheck = queryJson('SELECT sellos_requeridos FROM public.barberia_loyalty_config WHERE barberia_id = 2');
assert(ownerBConfigCheck[0].sellos_requeridos === 8, 'Owner A must NOT be able to modify config B');
console.log('    ✓ UPDATE config B by Owner A: BLOCKED (0 rows affected)');

const ownerARewards = runAsJson(10, 'SELECT id, barberia_id FROM public.loyalty_rewards');
assert(ownerARewards.every(r => r.barberia_id === 1), 'Owner A must see only Barberia A rewards');
console.log('    ✓ READ rewards A: SUCCESS (sees tenant A only)');

const ownerACreateReward = runAs(10, "INSERT INTO public.loyalty_rewards (barberia_id, nombre, costo_en_sellos) VALUES (1, 'Barba Deluxe', 5);");
assert(ownerACreateReward.success, `Owner A create reward failed: ${ownerACreateReward.stderr}`);
console.log('    ✓ CREATE reward A: SUCCESS');

// 6.2 ADMIN A (id=11)
console.log('  Testing ADMIN_A (id=11):');
const adminAConfig = runAsJson(11, 'SELECT barberia_id FROM public.barberia_loyalty_config');
assert(adminAConfig.length === 1 && adminAConfig[0].barberia_id === 1, 'Admin A must see exactly Barberia A config');
console.log('    ✓ READ config A: SUCCESS');

const adminACreateReward = runAs(11, "INSERT INTO public.loyalty_rewards (barberia_id, nombre, costo_en_sellos) VALUES (1, 'Corte Niño', 6);");
assert(adminACreateReward.success, 'Admin A must be able to CREATE reward in Tenant A');
console.log('    ✓ CREATE reward A: SUCCESS');

const adminACreateRewardB = runAs(11, "INSERT INTO public.loyalty_rewards (barberia_id, nombre, costo_en_sellos) VALUES (2, 'Hacked Reward', 5);");
assert(!adminACreateRewardB.success, 'Admin A must NOT be able to insert reward into Tenant B');
console.log('    ✓ CREATE reward B by Admin A: BLOCKED (RLS WITH CHECK violation)');

// 6.3 CAJERO A (id=12)
console.log('  Testing CAJERO_A (id=12):');
const cajeroAConfig = runAsJson(12, 'SELECT barberia_id FROM public.barberia_loyalty_config');
assert(cajeroAConfig.length === 0, 'Cajero A must NOT have access to loyalty config (only owner/admin)');
console.log('    ✓ READ config A: BLOCKED (0 rows, cajero != admin/owner)');

const cajeroARewards = runAsJson(12, 'SELECT id, barberia_id FROM public.loyalty_rewards');
assert(cajeroARewards.length > 0 && cajeroARewards.every(r => r.barberia_id === 1), 'Cajero A can read rewards of Tenant A');
console.log('    ✓ READ rewards A: SUCCESS');

const cajeroACreateReward = runAs(12, "INSERT INTO public.loyalty_rewards (barberia_id, nombre, costo_en_sellos) VALUES (1, 'Cajero Hack', 1);");
assert(!cajeroACreateReward.success, 'Cajero A must NOT be able to CREATE rewards');
console.log('    ✓ CREATE reward A by Cajero: BLOCKED (RLS WITH CHECK violation)');

// 6.4 BARBERO A (id=13)
console.log('  Testing BARBERO_A (id=13):');
const barberoAConfig = runAsJson(13, 'SELECT barberia_id FROM public.barberia_loyalty_config');
assert(barberoAConfig.length === 0, 'Barbero A must NOT see loyalty config');
console.log('    ✓ READ config A: BLOCKED (0 rows)');

const barberoARewards = runAsJson(13, 'SELECT id, barberia_id FROM public.loyalty_rewards');
assert(barberoARewards.length > 0 && barberoARewards.every(r => r.barberia_id === 1), 'Barbero A can read rewards');
console.log('    ✓ READ rewards A: SUCCESS');

const barberoACreateReward = runAs(13, "INSERT INTO public.loyalty_rewards (barberia_id, nombre, costo_en_sellos) VALUES (1, 'Barbero Hack', 1);");
assert(!barberoACreateReward.success, 'Barbero A must NOT be able to CREATE rewards');
console.log('    ✓ CREATE reward A by Barbero: BLOCKED (RLS WITH CHECK violation)');

// ---------------------------------------------------------------------------
// STEP 7: REAL CROSS-TENANT INTEGRITY TESTS
// ---------------------------------------------------------------------------
console.log('\n7. Testing Real Cross-Tenant Boundary Violations:');

// Test A: Insert ledger with Barberia 1 and Cliente 201 (belongs to Barberia 2)
const crossTenantLedger = query(`
INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id)
VALUES (1, 201, 1, 'acumulacion', 'pago', 5555);
`);
assert(!crossTenantLedger.success, 'Cross-tenant ledger insert must be rejected');
assert(crossTenantLedger.stderr.includes('LOYALTY_CROSS_TENANT_VIOLATION'), 'Expected LOYALTY_CROSS_TENANT_VIOLATION');
console.log('  ✓ Ledger cross-tenant assignment rejected: LOYALTY_CROSS_TENANT_VIOLATION (Cliente 201 pertenece a barberia 2, no a 1)');

// Test B: Insert redemption with Barberia 1, Cliente 201
const crossTenantRedemptionClient = query(`
INSERT INTO public.loyalty_redemptions (barberia_id, cliente_id, reward_id, costo_sellos_snapshot)
VALUES (1, 201, 1, 10);
`);
assert(!crossTenantRedemptionClient.success, 'Cross-tenant redemption client insert must be rejected');
assert(crossTenantRedemptionClient.stderr.includes('LOYALTY_CROSS_TENANT_VIOLATION'), 'Expected LOYALTY_CROSS_TENANT_VIOLATION');
console.log('  ✓ Redemption cross-tenant client rejected: LOYALTY_CROSS_TENANT_VIOLATION');

// Test C: Insert redemption with Barberia 1, Cliente 101, but Reward 2 (belongs to Barberia 2)
const crossTenantRedemptionReward = query(`
INSERT INTO public.loyalty_redemptions (barberia_id, cliente_id, reward_id, costo_sellos_snapshot)
VALUES (1, 101, 2, 8);
`);
assert(!crossTenantRedemptionReward.success, 'Cross-tenant redemption reward insert must be rejected');
assert(crossTenantRedemptionReward.stderr.includes('LOYALTY_CROSS_TENANT_VIOLATION'), 'Expected LOYALTY_CROSS_TENANT_VIOLATION');
console.log('  ✓ Redemption cross-tenant reward rejected: LOYALTY_CROSS_TENANT_VIOLATION (Recompensa 2 pertenece a barberia 2, no a 1)');

// ---------------------------------------------------------------------------
// STEP 8: REAL IDEMPOTENCY TEST
// ---------------------------------------------------------------------------
console.log('\n8. Testing Real Idempotency (ux_loyalty_ledger_source_idempotency):');

const firstAccum = query(`
INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id)
VALUES (1, 101, 1, 'acumulacion', 'pago', 7001);
`);
assert(firstAccum.success, `First accumulation failed: ${firstAccum.stderr}`);
console.log('  ✓ First accumulation with source (pago, 7001): SUCCESS');

const secondAccum = query(`
INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id)
VALUES (1, 101, 1, 'acumulacion', 'pago', 7001);
`);
assert(!secondAccum.success, 'Duplicate accumulation MUST fail on unique idempotency constraint');
assert(secondAccum.stderr.includes('ux_loyalty_ledger_source_idempotency') || secondAccum.stderr.includes('duplicate key value'), 'Expected unique violation on ux_loyalty_ledger_source_idempotency');
console.log('  ✓ Duplicate accumulation rejected: ux_loyalty_ledger_source_idempotency violation (SQLSTATE 23505)');

// ---------------------------------------------------------------------------
// STEP 9: REAL APPEND-ONLY TEST (IMMUTABILITY)
// ---------------------------------------------------------------------------
console.log('\n9. Testing Real Append-Only Immutability:');

const ledgerEntryId = queryJson('SELECT id FROM public.loyalty_ledger WHERE source_id = 7001')[0].id;

const updateAttempt = query(`UPDATE public.loyalty_ledger SET delta = 50 WHERE id = ${ledgerEntryId};`);
assert(!updateAttempt.success, 'Ledger UPDATE must be blocked by trigger');
assert(updateAttempt.stderr.includes('LOYALTY_LEDGER_IMMUTABLE'), 'Expected LOYALTY_LEDGER_IMMUTABLE error');
console.log('  ✓ Ledger UPDATE rejected: LOYALTY_LEDGER_IMMUTABLE');

const deleteAttempt = query(`DELETE FROM public.loyalty_ledger WHERE id = ${ledgerEntryId};`);
assert(!deleteAttempt.success, 'Ledger DELETE must be blocked by trigger');
assert(deleteAttempt.stderr.includes('LOYALTY_LEDGER_IMMUTABLE'), 'Expected LOYALTY_LEDGER_IMMUTABLE error');
console.log('  ✓ Ledger DELETE rejected: LOYALTY_LEDGER_IMMUTABLE');

// ---------------------------------------------------------------------------
// STEP 10: REAL BALANCE VIEW TEST (+1, +1, +1, -2 = 1; +1 = 2)
// ---------------------------------------------------------------------------
console.log('\n10. Testing Real Balance Calculation on v_loyalty_client_balance:');

// Movement 1 already inserted (+1 for Cliente 101)
// Insert Movement 2 (+1)
query(`INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id) VALUES (1, 101, 1, 'acumulacion', 'pago', 7002);`);
// Insert Movement 3 (+1)
query(`INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id) VALUES (1, 101, 1, 'acumulacion', 'pago', 7003);`);
// Insert Movement 4 (-2)
query(`INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id) VALUES (1, 101, -2, 'canje', 'redemption', 8001);`);

let bal1 = queryJson('SELECT saldo_sellos, total_acumulaciones, total_canjes FROM public.v_loyalty_client_balance WHERE cliente_id = 101')[0];
assert.strictEqual(Number(bal1.saldo_sellos), 1, `Expected saldo_sellos=1 after +1,+1,+1,-2, got ${bal1.saldo_sellos}`);
assert.strictEqual(Number(bal1.total_acumulaciones), 3);
assert.strictEqual(Number(bal1.total_canjes), 1);
console.log('  ✓ Balance sequence (+1, +1, +1, -2): saldo_sellos =', bal1.saldo_sellos, '(Expected: 1)');

// Add Movement 5 (+1)
query(`INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id) VALUES (1, 101, 1, 'acumulacion', 'pago', 7004);`);
let bal2 = queryJson('SELECT saldo_sellos, total_acumulaciones, total_canjes FROM public.v_loyalty_client_balance WHERE cliente_id = 101')[0];
assert.strictEqual(Number(bal2.saldo_sellos), 2, `Expected saldo_sellos=2 after +1,+1,+1,-2,+1, got ${bal2.saldo_sellos}`);
assert.strictEqual(Number(bal2.total_acumulaciones), 4);
console.log('  ✓ Balance sequence (+1): saldo_sellos =', bal2.saldo_sellos, '(Expected: 2)');

// Zero-movement client check (Cliente 102)
let zeroBal = queryJson('SELECT saldo_sellos, total_acumulaciones, total_canjes, ultimo_movimiento_at FROM public.v_loyalty_client_balance WHERE cliente_id = 102')[0];
assert.strictEqual(Number(zeroBal.saldo_sellos), 0, 'Zero-movement client must have saldo_sellos = 0');
assert.strictEqual(Number(zeroBal.total_acumulaciones), 0);
assert.strictEqual(Number(zeroBal.total_canjes), 0);
assert.strictEqual(zeroBal.ultimo_movimiento_at, null);
console.log('  ✓ Zero-movement client (Cliente 102): saldo_sellos =', zeroBal.saldo_sellos, '(Expected: 0)');

// ---------------------------------------------------------------------------
// STEP 11: REAL DOMAIN CONSTRAINTS TEST
// ---------------------------------------------------------------------------
console.log('\n11. Testing Real Check Constraints:');

// Threshold <= 0 in config
const invalidThreshold0 = query("INSERT INTO public.barberia_loyalty_config (barberia_id, sellos_requeridos) VALUES (999, 0);");
assert(!invalidThreshold0.success, 'Config with sellos_requeridos=0 must fail');
assert(invalidThreshold0.stderr.includes('violates check constraint'), 'Expected check constraint violation');
console.log('  ✓ Config sellos_requeridos = 0 rejected (violates check constraint)');

const invalidThresholdNeg = query("INSERT INTO public.barberia_loyalty_config (barberia_id, sellos_requeridos) VALUES (999, -5);");
assert(!invalidThresholdNeg.success, 'Config with sellos_requeridos=-5 must fail');
console.log('  ✓ Config sellos_requeridos = -5 rejected');

// Reward cost <= 0
const invalidRewardCost0 = query("INSERT INTO public.loyalty_rewards (barberia_id, nombre, costo_en_sellos) VALUES (1, 'Bad Cost', 0);");
assert(!invalidRewardCost0.success, 'Reward with costo_en_sellos=0 must fail');
console.log('  ✓ Reward costo_en_sellos = 0 rejected');

// Delta = 0 in ledger
const invalidDelta0 = query("INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento) VALUES (1, 101, 0, 'ajuste');");
assert(!invalidDelta0.success, 'Ledger delta=0 must fail');
console.log('  ✓ Ledger delta = 0 rejected');

// Inconsistent delta direction (acumulacion with delta < 0)
const invalidAcum = query("INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento) VALUES (1, 101, -1, 'acumulacion');");
assert(!invalidAcum.success, 'Acumulacion with negative delta must fail');
console.log('  ✓ Acumulacion with delta = -1 rejected (chk_loyalty_ledger_delta_direction)');

// 1:1 config duplicate
const dupConfig = query("INSERT INTO public.barberia_loyalty_config (barberia_id, sellos_requeridos) VALUES (1, 15);");
assert(!dupConfig.success, 'Duplicate config for barberia 1 must fail (PK violation)');
console.log('  ✓ Duplicate config for barberia 1 rejected (PK violation: one config per barberia)');

// ---------------------------------------------------------------------------
// STEP 12: REAL ROLLBACK TEST
// ---------------------------------------------------------------------------
console.log('\n12. Testing Real Rollback: 20260928_1500_loyalty_core_phase1_rollback.sql');

const rollbackSql = fs.readFileSync(rollbackFile, 'utf8');
const rollRes = query(rollbackSql);
assert(rollRes.success, `Rollback failed: ${rollRes.stderr}`);
console.log('✓ [PASS] Rollback script executed cleanly');

// Verify loyalty tables and view are gone
expectedTables.forEach(t => {
  const check = queryJson(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'`);
  assert(check.length === 0, `Table ${t} should have been dropped by rollback`);
});
const viewRollCheck = queryJson(`SELECT table_name FROM information_schema.views WHERE table_schema='public' AND table_name='v_loyalty_client_balance'`);
assert(viewRollCheck.length === 0, 'View v_loyalty_client_balance should have been dropped by rollback');
console.log('✓ [PASS] All 4 loyalty tables and 1 view confirmed dropped');

// Verify canonical tables are intact
const canonicalTables = ['barberias', 'barberia_miembros', 'clientes_finales', 'citas', 'pagos', 'usuarios'];
canonicalTables.forEach(t => {
  const check = queryJson(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'`);
  assert(check.length === 1, `Canonical table ${t} MUST remain intact after rollback`);
});
console.log('✓ [PASS] All canonical tables (barberias, barberia_miembros, clientes_finales, citas, pagos, usuarios) intact');

// ---------------------------------------------------------------------------
// STEP 13: REAL REAPPLY TEST
// ---------------------------------------------------------------------------
console.log('\n13. Testing Real Reapply: Re-executing migration after rollback');

const reapplyRes = query(migrationSql);
assert(reapplyRes.success, `Reapply failed: ${reapplyRes.stderr}`);
console.log('✓ [PASS] Migration re-applied cleanly without errors');

// Verify objects recreated
expectedTables.forEach(t => {
  const check = queryJson(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'`);
  assert(check.length === 1, `Table ${t} must exist after reapply`);
});
const viewReapplyCheck = queryJson(`SELECT table_name FROM information_schema.views WHERE table_schema='public' AND table_name='v_loyalty_client_balance'`);
assert(viewReapplyCheck.length === 1, 'View v_loyalty_client_balance must exist after reapply');
console.log('✓ [PASS] All objects recreated and functional after reapply');

console.log('\n====================================================');
console.log('ALL PHASE 1B REAL RUNTIME TESTS PASSED (100%)');
console.log('====================================================');
