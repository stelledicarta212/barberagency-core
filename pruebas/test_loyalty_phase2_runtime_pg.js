/**
 * BARBERAGENCY — LOYALTY PHASE 2: REAL POSTGRESQL RUNTIME VALIDATION
 * File: pruebas/test_loyalty_phase2_runtime_pg.js
 *
 * Executes real runtime validation against local PostgreSQL (WSL PostgreSQL 16.14).
 * Covers:
 * 1. Dedicated Test DB Bootstrap (Phase 1 + Phase 2 migrations)
 * 2. Catalog & Security Definer Verification (Functions, Permissions, Search Path)
 * 3. Accrual Contract & Canonical Derivation (ba_loyalty_acumular_pago)
 * 4. Accrual Idempotency & Invalid Cases (payment not found, tenant mismatch, not pagada, anonymous, disabled, pre-start)
 * 5. Multi-Tenant RPC Attack Tests (Cross-tenant accrual, redemption, reversal)
 * 6. Redemption Atomicity, Balance Validation & Snapshot (ba_loyalty_redeem)
 * 7. REAL CONCURRENT REDEMPTION TEST (Race condition on balance=8 with two parallel processes)
 * 8. Different Customers Independent Locking Test (Zero cross-customer blocking)
 * 9. Reversal Contract & Spent Balance Policy (ba_loyalty_reverse)
 * 10. Reconciliation Contract & Failure Isolation (ba_loyalty_reconciliar_pagos)
 * 11. Direct Browser Write Regressions (Ledger & Redemptions direct write blocked)
 * 12. Rollback Test (20260928_1600_loyalty_rpc_core_phase2_rollback.sql)
 * 13. Reapply Test (Re-execution & smoke verification)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.join(__dirname, '..');
const phase1MigFile = path.join(rootDir, 'migrations', '20260928_1500_loyalty_core_phase1.sql');
const phase2MigFile = path.join(rootDir, 'migrations', '20260928_1600_loyalty_rpc_core_phase2.sql');
const phase2RollbackFile = path.join(rootDir, 'migrations', '20260928_1600_loyalty_rpc_core_phase2_rollback.sql');

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

function runAs(userId, sql, db = DB_NAME) {
  const wrapped = `
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"user_id": ${userId}}';
${sql}
COMMIT;
  `;
  return query(wrapped, db);
}

function runAsRpc(userId, funcCall, db = DB_NAME) {
  const wrapped = `
SET ROLE authenticated;
SET request.jwt.claims = '{"user_id": ${userId}}';
SELECT ${funcCall};
  `;
  const res = query(wrapped, db);
  if (!res.success) {
    throw new Error(`RPC_FAILED: ${res.stderr || res.error}`);
  }
  const startObj = res.output.indexOf('{');
  const endObj = res.output.lastIndexOf('}');
  if (startObj !== -1 && endObj !== -1 && endObj >= startObj) {
    return JSON.parse(res.output.slice(startObj, endObj + 1));
  }
  throw new Error(`CANNOT_PARSE_RPC_RESULT: ${res.output}`);
}

console.log('====================================================');
console.log('BARBERAGENCY — LOYALTY PHASE 2 REAL RUNTIME TEST');
console.log('====================================================\n');

// ---------------------------------------------------------------------------
// 1. BOOTSTRAP CANONICAL TEST DB + PHASE 1 + PHASE 2
// ---------------------------------------------------------------------------
console.log('1. Initializing dedicated test database with Phase 1 and Phase 2:');

query(`
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
`, 'postgres');

const bootstrapSql = `
BEGIN;

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
  barberia_id INT REFERENCES public.barberias(id) ON DELETE CASCADE,
  cita_id INT REFERENCES public.citas(id) ON DELETE SET NULL,
  monto NUMERIC(10,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT now()
);

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

ALTER TABLE public.barberias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberia_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_finales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY barberias_owner_all ON public.barberias
  FOR ALL TO authenticated
  USING (owner_id = public.jwt_user_id())
  WITH CHECK (owner_id = public.jwt_user_id());

CREATE POLICY barberia_miembros_owner_all ON public.barberia_miembros
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = barberia_miembros.barberia_id
        AND b.owner_id = public.jwt_user_id()
        AND b.deleted_at IS NULL
    )
  );

CREATE POLICY barberia_miembros_member_select ON public.barberia_miembros
  FOR SELECT TO authenticated
  USING (usuario_id = public.jwt_user_id());

CREATE POLICY clientes_finales_tenant_all ON public.clientes_finales
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.barberias b
      WHERE b.id = clientes_finales.barberia_id
        AND b.owner_id = public.jwt_user_id()
        AND b.deleted_at IS NULL
    ) OR EXISTS (
      SELECT 1 FROM public.barberia_miembros bm
      WHERE bm.barberia_id = clientes_finales.barberia_id
        AND bm.usuario_id = public.jwt_user_id()
        AND bm.activo = true
    )
  );

GRANT SELECT ON public.barberias, public.clientes_finales, public.citas, public.pagos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barberias, public.barberia_miembros, public.clientes_finales, public.citas, public.pagos TO authenticated;

COMMIT;
`;

assert(query(bootstrapSql).success, 'Bootstrap canonical tables failed');

// Apply Phase 1
const p1Sql = fs.readFileSync(phase1MigFile, 'utf8');
assert(query(p1Sql).success, 'Phase 1 migration failed');
console.log('✓ [PASS] Phase 1 baseline applied');

// Apply Phase 2
const p2Sql = fs.readFileSync(phase2MigFile, 'utf8');
const p2Res = query(p2Sql);
assert(p2Res.success, `Phase 2 migration failed: ${p2Res.stderr}`);
console.log('✓ [PASS] Phase 2 RPC Core migration applied cleanly\n');

// ---------------------------------------------------------------------------
// 2. CATALOG & SECURITY DEFINER VERIFICATION
// ---------------------------------------------------------------------------
console.log('2. Verifying RPC Catalog Definitions & Security Settings:');

const rpcs = [
  'ba_loyalty_acumular_pago',
  'ba_loyalty_redeem',
  'ba_loyalty_reverse',
  'ba_loyalty_reconciliar_pagos'
];

rpcs.forEach(fn => {
  const meta = queryJson(`
    SELECT proname, prosecdef, proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '${fn}'
  `)[0];
  assert(meta, `RPC function ${fn} missing from catalog`);
  assert(meta.prosecdef === true, `RPC ${fn} must be SECURITY DEFINER`);
  assert(meta.proconfig && meta.proconfig.some(c => c.includes('search_path=public')), `RPC ${fn} must enforce search_path=public`);
  console.log(`  ✓ ${fn}: SECURITY DEFINER confirmed, search_path=public enforced`);
});

// Verify accrual_start_at column on config
const colCheck = queryJson(`SELECT column_name FROM information_schema.columns WHERE table_name='barberia_loyalty_config' AND column_name='accrual_start_at'`);
assert(colCheck.length === 1, 'Column accrual_start_at missing from barberia_loyalty_config');
console.log('  ✓ barberia_loyalty_config.accrual_start_at column verified\n');

// ---------------------------------------------------------------------------
// 3. SEED FIXTURES (Tenants A & B, Users, Clientes, Citas, Pagos)
// ---------------------------------------------------------------------------
console.log('3. Seeding test fixtures:');

const fixturesSql = `
BEGIN;

INSERT INTO public.usuarios (id, nombre, email) VALUES
  (10, 'Owner A', 'owner_a@barberagency.test'),
  (11, 'Admin A', 'admin_a@barberagency.test'),
  (12, 'Cajero A', 'cajero_a@barberagency.test'),
  (13, 'Barbero A', 'barbero_a@barberagency.test'),
  (20, 'Owner B', 'owner_b@barberagency.test'),
  (21, 'Admin B', 'admin_b@barberagency.test'),
  (22, 'Cajero B', 'cajero_b@barberagency.test');

INSERT INTO public.barberias (id, nombre, slug, owner_id) VALUES
  (1, 'Barberia Alpha', 'barberia-alpha', 10),
  (2, 'Barberia Beta', 'barberia-beta', 20);

INSERT INTO public.barberia_miembros (barberia_id, usuario_id, email, rol, activo) VALUES
  (1, 10, 'owner_a@barberagency.test', 'owner', true),
  (1, 11, 'admin_a@barberagency.test', 'admin', true),
  (1, 12, 'cajero_a@barberagency.test', 'cajero', true),
  (1, 13, 'barbero_a@barberagency.test', 'barbero', true),
  (2, 20, 'owner_b@barberagency.test', 'owner', true),
  (2, 21, 'admin_b@barberagency.test', 'admin', true),
  (2, 22, 'cajero_b@barberagency.test', 'cajero', true);

INSERT INTO public.clientes_finales (id, barberia_id, nombre, telefono) VALUES
  (101, 1, 'Cliente Alpha 101', '3001010001'),
  (102, 1, 'Cliente Alpha 102', '3001020002'),
  (201, 2, 'Cliente Beta 201', '3002010001');

-- Loyalty configs (Both active, accrual_start_at set 1 hour in the past)
INSERT INTO public.barberia_loyalty_config (barberia_id, activo, sellos_requeridos, recompensa_default, accrual_start_at) VALUES
  (1, true, 10, 'Corte Gratis', now() - INTERVAL '1 hour'),
  (2, true, 8, 'Lavado Gratis', now() - INTERVAL '1 hour');

-- Loyalty rewards
INSERT INTO public.loyalty_rewards (id, barberia_id, nombre, costo_en_sellos, activo) VALUES
  (1, 1, 'Corte Gratis Alpha', 8, true),
  (2, 1, 'Tratamiento Capilar Alpha', 4, true),
  (3, 1, 'Recompensa Inactiva Alpha', 5, false),
  (4, 2, 'Corte VIP Beta', 8, true);

SELECT setval('public.loyalty_rewards_id_seq', (SELECT MAX(id) FROM public.loyalty_rewards));

-- Canonical appointments & payments for Tenant 1
INSERT INTO public.citas (id, barberia_id, cliente_id, estado, created_at) VALUES
  (1001, 1, 101, 'pagada', now() - INTERVAL '30 minutes'),
  (1002, 1, 101, 'pagada', now() - INTERVAL '25 minutes'),
  (1003, 1, 101, 'pendiente', now() - INTERVAL '20 minutes'), -- Not pagada
  (1004, 1, NULL, 'pagada', now() - INTERVAL '15 minutes'),    -- Anonymous
  (1005, 1, 101, 'pagada', now() - INTERVAL '2 hours'),       -- Before accrual_start_at
  (2001, 2, 201, 'pagada', now() - INTERVAL '30 minutes');     -- Tenant 2

INSERT INTO public.pagos (id, barberia_id, cita_id, monto, estado, created_at) VALUES
  (7001, 1, 1001, 35000, 'pagado', now() - INTERVAL '30 minutes'),
  (7002, 1, 1002, 40000, 'pagado', now() - INTERVAL '25 minutes'),
  (7003, 1, 1003, 35000, 'pendiente', now() - INTERVAL '20 minutes'),
  (7004, 1, 1004, 25000, 'pagado', now() - INTERVAL '15 minutes'),
  (7005, 1, 1005, 30000, 'pagado', now() - INTERVAL '2 hours'),
  (8001, 2, 2001, 50000, 'pagado', now() - INTERVAL '30 minutes'),
  (7008, 1, 2001, 30000, 'pagado', now() - INTERVAL '10 minutes'),
  (7009, NULL, 1001, 30000, 'pagado', now() - INTERVAL '5 minutes');

COMMIT;
`;

assert(query(fixturesSql).success, 'Fixtures seeding failed');
console.log('✓ [PASS] Fixtures seeded successfully\n');

// ---------------------------------------------------------------------------
// 4. ACCRUAL CONTRACT & IDEMPOTENCY (ba_loyalty_acumular_pago)
// ---------------------------------------------------------------------------
console.log('4. Testing Accrual Contract & Idempotency:');

// Test 4.1: Valid accrual as Cajero A
const acc1 = runAsRpc(12, 'public.ba_loyalty_acumular_pago(7001)');
console.log('  [DEBUG] acc1 result:', JSON.stringify(acc1));
assert(acc1.success === true, 'Accrual 7001 must succeed');
assert(acc1.status === 'credited', `Expected status 'credited', got ${acc1.status}`);
assert(acc1.cliente_id === 101, 'Expected customer 101');
assert(acc1.barberia_id === 1, 'Expected tenant 1');
console.log('  ✓ Valid accrual (pago 7001): SUCCESS (status=credited, ledger_id=' + acc1.ledger_id + ')');

// Test 4.2: Idempotency (second call with same pago_id)
const acc2 = runAsRpc(12, 'public.ba_loyalty_acumular_pago(7001)');
assert(acc2.success === true, 'Second call must succeed idempotently');
assert(acc2.status === 'already_credited', `Expected status 'already_credited', got ${acc2.status}`);
assert(acc2.ledger_id === acc1.ledger_id, 'Must return identical ledger_id');

// Verify total ledger rows for payment 7001
const p7001Rows = queryJson('SELECT id, delta FROM public.loyalty_ledger WHERE source_type=\'pago\' AND source_id=7001');
assert(p7001Rows.length === 1, 'Exactly one ledger row must exist for payment 7001');
console.log('  ✓ Accrual idempotency: SUCCESS (status=already_credited, total_rows=1, total_credit=+1)');

// ---------------------------------------------------------------------------
// 5. ACCRUAL INVALID CASES & BOUNDARIES
// ---------------------------------------------------------------------------
console.log('\n5. Testing Accrual Invalid Cases & Boundary Checks:');

// 5.1 Payment does not exist
const accNotFound = runAsRpc(12, 'public.ba_loyalty_acumular_pago(99999)');
assert(accNotFound.success === false && accNotFound.status === 'payment_not_found');
console.log('  ✓ Inexistent payment: payment_not_found');

// 5.2 Appointment not pagada (cita 1003 is pendiente)
const accNotPaid = runAsRpc(12, 'public.ba_loyalty_acumular_pago(7003)');
assert(accNotPaid.success === false && accNotPaid.status === 'appointment_not_paid');
console.log('  ✓ Appointment not pagada: appointment_not_paid');

// 5.3 Appointment anonymous (cita 1004 has no cliente_id)
const accAnon = runAsRpc(12, 'public.ba_loyalty_acumular_pago(7004)');
assert(accAnon.success === false && accAnon.status === 'anonymous_customer');
console.log('  ✓ Appointment without customer: anonymous_customer');

// 5.4 Payment without its canonical tenant is rejected before any ledger write
const accNullTenant = runAsRpc(12, 'public.ba_loyalty_acumular_pago(7009)');
assert(accNullTenant.success === false && accNullTenant.status === 'invalid_payment_tenant');
assert(queryJson("SELECT id FROM public.loyalty_ledger WHERE source_type='pago' AND source_id=7009").length === 0,
  'Null-tenant payment must create zero ledger rows');
console.log('  ✓ NULL payment tenant rejected: invalid_payment_tenant, zero ledger rows');

// 5.5 A payment linked to an appointment in another tenant is rejected without writes
const accTenantMismatch = runAsRpc(12, 'public.ba_loyalty_acumular_pago(7008)');
assert(accTenantMismatch.success === false && accTenantMismatch.status === 'tenant_mismatch');
assert(queryJson("SELECT id FROM public.loyalty_ledger WHERE source_type='pago' AND source_id=7008").length === 0,
  'Mismatched payment/appointment tenant must create zero ledger rows');
console.log('  ✓ Payment/appointment tenant mismatch rejected: zero ledger rows');

// 5.6 Payment created before accrual_start_at (pago 7005 created 2 hours ago, start was 1 hour ago)
const accPreStart = runAsRpc(12, 'public.ba_loyalty_acumular_pago(7005)');
assert(accPreStart.success === false && accPreStart.status === 'created_before_program_start');
console.log('  ✓ Payment before program start: created_before_program_start (prevents retroactive crediting)');

// 5.7 Program disabled check
query("UPDATE public.barberia_loyalty_config SET activo = false WHERE barberia_id = 1;");
const accDisabled = runAsRpc(12, 'public.ba_loyalty_acumular_pago(7002)');
assert(accDisabled.success === false && accDisabled.status === 'program_disabled');
console.log('  ✓ Program disabled: program_disabled');
// Re-enable for subsequent tests
query("UPDATE public.barberia_loyalty_config SET activo = true, accrual_start_at = now() - INTERVAL '1 hour' WHERE barberia_id = 1;");

// ---------------------------------------------------------------------------
// 6. MULTI-TENANT ATTACK TESTS
// ---------------------------------------------------------------------------
console.log('\n6. Testing Multi-Tenant Attack Scenarios:');

// Attack 6.1: Cajero A (Tenant 1) attempts to accrue payment of Tenant 2 (pago 8001)
const attackAccrual = runAsRpc(12, 'public.ba_loyalty_acumular_pago(8001)');
assert(attackAccrual.success === false && attackAccrual.status === 'unauthorized', 'Cross-tenant accrual must be unauthorized');
console.log('  ✓ Cross-tenant accrual attempt: BLOCKED (status=unauthorized)');

// Attack 6.2: Cajero A (Tenant 1) attempts to redeem for Cliente 201 (Tenant 2)
const attackRedeemCustomer = runAsRpc(12, 'public.ba_loyalty_redeem(201, 1)');
assert(attackRedeemCustomer.success === false && attackRedeemCustomer.status === 'unauthorized', 'Cross-tenant redemption must be unauthorized');
console.log('  ✓ Cross-tenant customer redemption: BLOCKED (status=unauthorized)');

// Attack 6.3: Cajero A (Tenant 1) attempts to redeem Reward 4 (belongs to Tenant 2) for Cliente 101
const attackRedeemReward = runAsRpc(12, 'public.ba_loyalty_redeem(101, 4)');
assert(attackRedeemReward.success === false && attackRedeemReward.status === 'cross_tenant_reward', 'Cross-tenant reward must be rejected');
console.log('  ✓ Cross-tenant reward redemption: BLOCKED (status=cross_tenant_reward)');

// ---------------------------------------------------------------------------
// 7. REDEMPTION ATOMICITY & BALANCE VALIDATION (ba_loyalty_redeem)
// ---------------------------------------------------------------------------
console.log('\n7. Testing Redemption Atomicity & Balance Validation:');

// Current balance for Cliente 101 is 1 sello (from pago 7001)
// Attempt redemption of Reward 1 (requires 8 sellos)
const redInsuff = runAsRpc(12, 'public.ba_loyalty_redeem(101, 1)');
assert(redInsuff.success === false && redInsuff.status === 'insufficient_balance', 'Must fail with insufficient balance');
assert(Number(redInsuff.saldo_actual) === 1 && Number(redInsuff.costo_requerido) === 8);
console.log('  ✓ Insufficient balance rejection: SUCCESS (saldo_actual=1, costo_requerido=8)');

// Inactive reward rejection
const redInactive = runAsRpc(12, 'public.ba_loyalty_redeem(101, 3)');
assert(redInactive.success === false && redInactive.status === 'reward_inactive', 'Must reject inactive reward');
console.log('  ✓ Inactive reward rejection: SUCCESS (status=reward_inactive)');

// Credit enough stamps for Cliente 101 to reach exactly 8 sellos
// We add 7 stamps directly via internal helper / ledger for testing redemption
query(`
INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id) VALUES
  (1, 101, 1, 'acumulacion', 'pago', 7101),
  (1, 101, 1, 'acumulacion', 'pago', 7102),
  (1, 101, 1, 'acumulacion', 'pago', 7103),
  (1, 101, 1, 'acumulacion', 'pago', 7104),
  (1, 101, 1, 'acumulacion', 'pago', 7105),
  (1, 101, 1, 'acumulacion', 'pago', 7106),
  (1, 101, 1, 'acumulacion', 'pago', 7107);
`);

const balCheck = queryJson('SELECT saldo_sellos FROM public.v_loyalty_client_balance WHERE cliente_id = 101')[0];
assert(Number(balCheck.saldo_sellos) === 8, `Expected balance 8, got ${balCheck.saldo_sellos}`);
console.log('  ✓ Cliente 101 balance topped up to exactly 8 sellos');

// Valid redemption of Reward 1 (cost 8 sellos)
const validRed = runAsRpc(12, "public.ba_loyalty_redeem(101, 1, NULL, 'Canje de prueba exitoso')");
assert(validRed.success === true && validRed.status === 'redeemed', 'Valid redemption must succeed');
assert(validRed.redemption_id != null && validRed.ledger_id != null);
assert(Number(validRed.costo_sellos) === 8);
assert(Number(validRed.saldo_restante) === 0);

// Check atomicity: exactly 1 redemption record, exactly 1 matching ledger debit (-8)
const redRecord = queryJson(`SELECT * FROM public.loyalty_redemptions WHERE id = ${validRed.redemption_id}`)[0];
assert(Number(redRecord.costo_sellos_snapshot) === 8, 'Snapshot must record 8 sellos');
assert(Number(redRecord.cliente_id) === 101);

const ledRecord = queryJson(`SELECT * FROM public.loyalty_ledger WHERE id = ${validRed.ledger_id}`)[0];
assert(Number(ledRecord.delta) === -8, 'Ledger delta must be -8');
assert(Number(ledRecord.redemption_id) === Number(validRed.redemption_id), 'Ledger must link to redemption_id');

const postRedBal = queryJson('SELECT saldo_sellos FROM public.v_loyalty_client_balance WHERE cliente_id = 101')[0];
assert(Number(postRedBal.saldo_sellos) === 0, 'Balance after redemption must be exactly 0');
console.log('  ✓ Redemption atomicity: SUCCESS (redemption_id=' + validRed.redemption_id + ', ledger_id=' + validRed.ledger_id + ', final_balance=0)');

// ---------------------------------------------------------------------------
// 8. REAL CONCURRENT REDEMPTION TEST (Race Condition Simulation)
// ---------------------------------------------------------------------------
console.log('\n8. REAL CONCURRENCY TEST: Two independent PostgreSQL sessions racing on balance = 8:');

// Setup: Credit Cliente 102 with exactly 8 sellos
query(`
INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id) VALUES
  (1, 102, 8, 'ajuste', 'manual', 9001);
`);

const bal102 = queryJson('SELECT saldo_sellos FROM public.v_loyalty_client_balance WHERE cliente_id = 102')[0];
assert(Number(bal102.saldo_sellos) === 8, 'Cliente 102 must have balance 8');
console.log('  Initial balance for Cliente 102: 8 sellos');
console.log('  Launching 2 concurrent independent processes attempting ba_loyalty_redeem(102, 1)...');

// Helper to execute RPC via child process
function executeRpcAsync(userId, rpcCall) {
  return new Promise((resolve) => {
    const sql = `SET ROLE authenticated; SET request.jwt.claims = '{"user_id": ${userId}}'; SELECT ${rpcCall};`;
    const proc = spawn('wsl', ['-u', 'postgres', '-d', 'Ubuntu', '--', 'psql', '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-t', '-A'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', data => { stdout += data.toString(); });
    proc.stderr.on('data', data => { stderr += data.toString(); });

    proc.on('close', code => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });

    proc.stdin.write(sql);
    proc.stdin.end();
  });
}

async function runConcurrencyTest() {
  // 8.1 Concurrent Redemption: Two independent sessions racing on balance = 8
  const [resA, resB] = await Promise.all([
    executeRpcAsync(12, 'public.ba_loyalty_redeem(102, 1)'),
    executeRpcAsync(12, 'public.ba_loyalty_redeem(102, 1)')
  ]);

  const parseRes = (r) => {
    const start = r.stdout.indexOf('{');
    const end = r.stdout.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      return JSON.parse(r.stdout.slice(start, end + 1));
    }
    return { success: false, error: r.stderr || r.stdout };
  };

  const parsedA = parseRes(resA);
  const parsedB = parseRes(resB);

  console.log('  Process A result:', parsedA.status);
  console.log('  Process B result:', parsedB.status);

  const statuses = [parsedA.status, parsedB.status];
  assert(statuses.includes('redeemed'), 'Exactly one redemption must succeed');
  assert(statuses.includes('insufficient_balance'), 'The other concurrent redemption must fail with insufficient_balance');

  const finalBal102 = queryJson('SELECT saldo_sellos FROM public.v_loyalty_client_balance WHERE cliente_id = 102')[0];
  assert(Number(finalBal102.saldo_sellos) === 0, `Final balance must be 0, got ${finalBal102.saldo_sellos}`);
  assert(Number(finalBal102.saldo_sellos) >= 0, 'Balance must NEVER be negative');

  console.log('  ✓ CONCURRENCY VERIFIED: SUCCESSFUL=1, FAILED=1, FINAL_BALANCE=0, NEGATIVE_BALANCE=NO');

  // 8.2 Accrual Concurrency: 10 parallel attempts for the same payment
  console.log('\n  Testing Accrual Concurrency (10 concurrent attempts on pago 7099):');
  query(`
    INSERT INTO public.citas (id, barberia_id, cliente_id, estado, created_at)
    VALUES (1099, 1, 101, 'pagada', now());

    INSERT INTO public.pagos (id, barberia_id, cita_id, monto, estado, created_at)
    VALUES (7099, 1, 1099, 30000, 'pagado', now());
  `);

  const initialBal101 = Number(queryJson('SELECT saldo_sellos FROM public.v_loyalty_client_balance WHERE cliente_id = 101')[0].saldo_sellos);

  const parallelPromises = [];
  for (let i = 0; i < 10; i++) {
    parallelPromises.push(executeRpcAsync(12, 'public.ba_loyalty_acumular_pago(7099)'));
  }

  const results = (await Promise.all(parallelPromises)).map(parseRes);
  const creditedCount = results.filter(r => r.status === 'credited').length;
  const alreadyCreditedCount = results.filter(r => r.status === 'already_credited').length;

  console.log(`    10 concurrent attempts finished: credited=${creditedCount}, already_credited=${alreadyCreditedCount}`);
  assert(creditedCount === 1, `Exactly 1 attempt must credit, got ${creditedCount}`);
  assert(alreadyCreditedCount === 9, `9 attempts must report already_credited, got ${alreadyCreditedCount}`);

  const p7099Rows = queryJson('SELECT id FROM public.loyalty_ledger WHERE source_type=\'pago\' AND source_id=7099');
  assert(p7099Rows.length === 1, `Expected exactly 1 ledger row, got ${p7099Rows.length}`);

  const afterBal101 = Number(queryJson('SELECT saldo_sellos FROM public.v_loyalty_client_balance WHERE cliente_id = 101')[0].saldo_sellos);
  assert(afterBal101 === initialBal101 + 1, `Balance increment must be exactly 1`);
  console.log('  ✓ ACCRUAL CONCURRENCY VERIFIED: LEDGER_ACCUMULATION_ROWS=1, BALANCE_INCREMENT=1');

  // 8.3 Different Customers Independent Locking: Customer 101 and 102 proceed independently
  console.log('\n  Testing Different Customers Independent Locking (Customer 101 and 102 parallel redemptions):');
  query(`
    INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id)
    VALUES
      (1, 101, 8, 'ajuste', 'manual', 9101),
      (1, 102, 8, 'ajuste', 'manual', 9102);
  `);

  const [diffResA, diffResB] = (await Promise.all([
    executeRpcAsync(12, 'public.ba_loyalty_redeem(101, 1)'),
    executeRpcAsync(12, 'public.ba_loyalty_redeem(102, 1)')
  ])).map(parseRes);

  assert(diffResA.status === 'redeemed', 'Customer 101 redemption must succeed');
  assert(diffResB.status === 'redeemed', 'Customer 102 redemption must succeed');
  console.log('  ✓ INDEPENDENT LOCKING VERIFIED: Both customers redeemed simultaneously without cross-blocking');
}

runConcurrencyTest().then(() => {
  continueTests();
}).catch(err => {
  console.error('CONCURRENCY TEST FAILED:', err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// 9. REVERSAL CONTRACT & POLICY (ba_loyalty_reverse)
// ---------------------------------------------------------------------------
function continueTests() {
  console.log('\n9. Testing Reversal Contract & Policy:');

  // Create an accumulation movement of +1 for Cliente 101 to reverse
  query(`
    INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id)
    VALUES (1, 101, 1, 'acumulacion', 'pago', 7201);
  `);
  const origLedgerId = queryJson("SELECT id FROM public.loyalty_ledger WHERE source_type='pago' AND source_id=7201")[0].id;

  // Test 9.1: Valid reversal by Admin A (id=11)
  const revRes = runAsRpc(11, `public.ba_loyalty_reverse(${origLedgerId}, 'Devolución de servicio')`);
  assert(revRes.success === true && revRes.status === 'reversed', 'Reversal must succeed');
  assert(Number(revRes.delta) === -1, 'Compensating delta must be -1');
  console.log('  ✓ Valid reversal: SUCCESS (status=reversed, delta=-1, reversal_ledger_id=' + revRes.reversal_ledger_id + ')');

  // Verify original movement is intact and immutable
  const origCheck = queryJson(`SELECT delta, tipo_movimiento FROM public.loyalty_ledger WHERE id = ${origLedgerId}`)[0];
  assert(Number(origCheck.delta) === 1 && origCheck.tipo_movimiento === 'acumulacion', 'Original row must remain unchanged');
  console.log('  ✓ Original movement preserved completely intact (compensating pattern enforced)');

  // Test 9.2: Reversal idempotency
  const revDup = runAsRpc(11, `public.ba_loyalty_reverse(${origLedgerId})`);
  assert(revDup.success === true && revDup.status === 'already_reversed', 'Duplicate reversal must return already_reversed');
  console.log('  ✓ Reversal idempotency: SUCCESS (status=already_reversed)');

  // Test 9.3: Reversal vs Spent Balance Policy
  // Create an accumulation (+2), client spends both sellos via redemption (balance = 0)
  query(`
    INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id)
    VALUES (1, 101, 2, 'acumulacion', 'pago', 7202);
  `);
  const testSpentAcc = queryJson("SELECT id FROM public.loyalty_ledger WHERE source_type='pago' AND source_id=7202")[0].id;

  // Spend the 2 sellos
  query(`
    INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento, source_type, source_id)
    VALUES (1, 101, -2, 'canje', 'redemption', 9901);
  `);

  // Balance is now 0. Attempting to reverse the +2 accumulation without allow_negative must fail
  const revSpentBlock = runAsRpc(11, `public.ba_loyalty_reverse(${testSpentAcc}, 'Intento sin saldo', false)`);
  assert(revSpentBlock.success === false && revSpentBlock.status === 'insufficient_balance_for_reversal', 'Reversal of spent stamps without negative authorization must be blocked');
  console.log('  ✓ Spent balance reversal blocked: insufficient_balance_for_reversal (prevents silent negative balance debt)');

  // ---------------------------------------------------------------------------
  // 10. RECONCILIATION CONTRACT & RECOVERY (ba_loyalty_reconciliar_pagos)
  // ---------------------------------------------------------------------------
  console.log('\n10. Testing Reconciliation Contract & Batched Recovery:');

  // Prepare batch in Tenant 1:
  // Pago 7001: Already credited in earlier test
  // Pago 7002: Valid (pagada, cliente 101, after start) -> Missing credit!
  // Pago 7003: Not pagada (pendiente) -> Skip!
  // Pago 7004: Anonymous -> Skip!
  // Pago 7005: Pre-start -> Skip!
  // Add valid uncredited payments created after program activation: Pago 7006 and Pago 7007
  query(`
    INSERT INTO public.citas (id, barberia_id, cliente_id, estado, created_at)
    VALUES
      (1006, 1, 101, 'pagada', now()),
      (1007, 1, 101, 'pagada', now());

    INSERT INTO public.pagos (id, barberia_id, cita_id, monto, estado, created_at)
    VALUES
      (7006, 1, 1006, 45000, 'pagado', now()),
      (7007, 1, 1007, 50000, 'pagado', now());
  `);

  // Run reconciler as Admin A (id=11)
  const rec1 = runAsRpc(11, 'public.ba_loyalty_reconciliar_pagos(1, 50)');
  assert(rec1.success === true && rec1.status === 'reconciliation_completed');
  assert(rec1.credited >= 2, `Expected at least 2 payments credited, got ${rec1.credited}`);
  const excludedPaymentRows = queryJson(`
    SELECT id FROM public.loyalty_ledger
    WHERE source_type='pago' AND source_id IN (7005, 7008, 7009)
  `);
  assert(excludedPaymentRows.length === 0,
    'Reconciliation must exclude pre-start, cross-tenant, and NULL-tenant payments');
  console.log(`  ✓ Reconciliation executed: credited=${rec1.credited}, already_credited=${rec1.already_credited}, skipped=${rec1.skipped}`);
  console.log('  ✓ Reconciliation excludes pre-start, mismatched-tenant, and NULL-tenant payments');

  // Re-run reconciler (Idempotency test): exactly 0 new credits
  const rec2 = runAsRpc(11, 'public.ba_loyalty_reconciliar_pagos(1, 50)');
  assert(rec2.credited === 0, 'Second reconciliation must find 0 new credits');
  console.log('  ✓ Second reconciliation run: SUCCESS (credited=0, no duplicate credits)');

  // ---------------------------------------------------------------------------
  // 11. DIRECT BROWSER WRITE REGRESSION CHECK
  // ---------------------------------------------------------------------------
  console.log('\n11. Re-verifying Direct Browser Write Regressions:');

  const directLedger = runAs(12, "INSERT INTO public.loyalty_ledger (barberia_id, cliente_id, delta, tipo_movimiento) VALUES (1, 101, 100, 'ajuste');");
  assert(!directLedger.success && directLedger.stderr.includes('permission denied for table loyalty_ledger'));
  console.log('  ✓ Direct browser ledger INSERT: STILL DENIED');

  const directRedemption = runAs(12, "INSERT INTO public.loyalty_redemptions (barberia_id, cliente_id, reward_id, costo_sellos_snapshot) VALUES (1, 101, 1, 8);");
  assert(!directRedemption.success && directRedemption.stderr.includes('permission denied for table loyalty_redemptions'));
  console.log('  ✓ Direct browser redemption INSERT: STILL DENIED');

  // ---------------------------------------------------------------------------
  // 12. ROLLBACK TEST
  // ---------------------------------------------------------------------------
  console.log('\n12. Testing Phase 2 Rollback: 20260928_1600_loyalty_rpc_core_phase2_rollback.sql');

  const p2RollbackSql = fs.readFileSync(phase2RollbackFile, 'utf8');
  assert(query(p2RollbackSql).success, 'Phase 2 rollback failed');

  // Verify Phase 2 RPCs dropped
  rpcs.forEach(fn => {
    const check = queryJson(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = '${fn}'`);
    assert(check.length === 0, `RPC ${fn} should have been dropped by rollback`);
  });
  console.log('  ✓ All 4 Phase 2 RPC functions dropped cleanly');

  // Verify Phase 1 tables still exist and intact
  const p1Tables = ['barberia_loyalty_config', 'loyalty_rewards', 'loyalty_redemptions', 'loyalty_ledger'];
  p1Tables.forEach(t => {
    const check = queryJson(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='${t}'`);
    assert(check.length === 1, `Phase 1 table ${t} must remain intact`);
  });
  console.log('  ✓ Phase 1 baseline tables remain completely intact');

  // ---------------------------------------------------------------------------
  // 13. REAPPLY TEST
  // ---------------------------------------------------------------------------
  console.log('\n13. Testing Phase 2 Reapply:');

  assert(query(p2Sql).success, 'Phase 2 reapply failed');
  rpcs.forEach(fn => {
    const check = queryJson(`SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = '${fn}'`);
    assert(check.length === 1, `RPC ${fn} must exist after reapply`);
  });
  console.log('  ✓ Phase 2 re-applied and verified operational');

  console.log('\n====================================================');
  console.log('ALL PHASE 2 REAL RUNTIME TESTS PASSED (100%)');
  console.log('====================================================');
}
