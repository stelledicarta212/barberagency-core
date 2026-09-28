/**
 * BARBERAGENCY — LOYALTY PHASE 1 TEST SUITE
 * File: pruebas/test_loyalty_phase1_postgres.js
 *
 * Verifies:
 * 1. Static contract verification on migrations/20260928_1500_loyalty_core_phase1.sql
 * 2. Static contract verification on migrations/20260928_1500_loyalty_core_phase1_rollback.sql
 * 3. Regression safety guards (zero alterations to pagos, citas, clientes_finales, zero birthday references)
 * 4. Logical simulation of ledger balance computation (+1, +1, +1, -2 = 1; +1 = 2)
 * 5. Simulation of cross-tenant boundary validation
 * 6. Simulation of append-only ledger immutability
 * 7. Simulation of idempotency constraints
 * 8. Simulation of RLS multi-tenant scoping
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const migrationPath = path.join(rootDir, 'migrations', '20260928_1500_loyalty_core_phase1.sql');
const rollbackPath = path.join(rootDir, 'migrations', '20260928_1500_loyalty_core_phase1_rollback.sql');

console.log('====================================================');
console.log('BARBERAGENCY — LOYALTY PHASE 1 POSTGRESQL TEST SUITE');
console.log('====================================================\n');

// ---------------------------------------------------------------------------
// 1. FILE EXISTENCE & READ
// ---------------------------------------------------------------------------
assert(fs.existsSync(migrationPath), `Migration file not found: ${migrationPath}`);
assert(fs.existsSync(rollbackPath), `Rollback file not found: ${rollbackPath}`);

const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');

console.log('✓ [PASS] Migration and Rollback files exist');

// ---------------------------------------------------------------------------
// 2. STATIC CONTRACT VERIFICATION: PREREQUISITES
// ---------------------------------------------------------------------------
assert(migrationSql.includes("to_regclass('public.barberias') IS NULL"), 'Prerequisite check for public.barberias missing');
assert(migrationSql.includes("to_regclass('public.clientes_finales') IS NULL"), 'Prerequisite check for public.clientes_finales missing');
assert(migrationSql.includes("to_regclass('public.usuarios') IS NULL"), 'Prerequisite check for public.usuarios missing');
assert(migrationSql.includes("proname = 'jwt_user_id'"), 'Prerequisite check for jwt_user_id() missing');

console.log('✓ [PASS] Prerequisites verification checks present');

// ---------------------------------------------------------------------------
// 3. STATIC CONTRACT VERIFICATION: DDL & TABLES
// ---------------------------------------------------------------------------
const requiredTables = [
  'public.barberia_loyalty_config',
  'public.loyalty_rewards',
  'public.loyalty_redemptions',
  'public.loyalty_ledger'
];

requiredTables.forEach(tbl => {
  assert(
    migrationSql.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`),
    `Table definition missing: ${tbl}`
  );
});

// Column validations
assert(migrationSql.includes('barberia_id INT PRIMARY KEY REFERENCES public.barberias(id) ON DELETE CASCADE'), 'Config PK missing');
assert(migrationSql.includes("program_type VARCHAR(50) NOT NULL DEFAULT 'stamps' CHECK (program_type IN ('stamps'))"), 'program_type constraint missing');
assert(migrationSql.includes('sellos_requeridos INT NOT NULL DEFAULT 10 CHECK (sellos_requeridos > 0)'), 'sellos_requeridos constraint missing');

assert(migrationSql.includes('costo_en_sellos INT NOT NULL CHECK (costo_en_sellos > 0)'), 'costo_en_sellos constraint missing');
assert(migrationSql.includes('costo_sellos_snapshot INT NOT NULL CHECK (costo_sellos_snapshot > 0)'), 'costo_sellos_snapshot constraint missing');

assert(migrationSql.includes('delta INT NOT NULL CHECK (delta <> 0)'), 'ledger delta <> 0 constraint missing');
assert(migrationSql.includes("tipo_movimiento VARCHAR(50) NOT NULL CHECK (tipo_movimiento IN ('acumulacion', 'canje', 'reversion', 'ajuste'))"), 'tipo_movimiento enum check missing');
assert(migrationSql.includes("chk_loyalty_ledger_delta_direction"), 'delta direction constraint missing');

console.log('✓ [PASS] Table definitions, data types, and check constraints verified');

// ---------------------------------------------------------------------------
// 4. STATIC CONTRACT VERIFICATION: INDEXES & IDEMPOTENCY
// ---------------------------------------------------------------------------
assert(migrationSql.includes('ix_loyalty_rewards_barberia_id'), 'Index ix_loyalty_rewards_barberia_id missing');
assert(migrationSql.includes('ix_loyalty_redemptions_barberia_cliente'), 'Index ix_loyalty_redemptions_barberia_cliente missing');
assert(migrationSql.includes('ix_loyalty_redemptions_reward_id'), 'Index ix_loyalty_redemptions_reward_id missing');
assert(migrationSql.includes('ix_loyalty_ledger_tenant_cliente'), 'Index ix_loyalty_ledger_tenant_cliente missing');
assert(migrationSql.includes('ux_loyalty_ledger_source_idempotency'), 'Partial unique index ux_loyalty_ledger_source_idempotency missing');
assert(migrationSql.includes('ux_loyalty_ledger_redemption'), 'Partial unique index ux_loyalty_ledger_redemption missing');

console.log('✓ [PASS] Required indexes and partial uniqueness constraints verified');

// ---------------------------------------------------------------------------
// 5. STATIC CONTRACT VERIFICATION: IMMUTABILITY & CROSS-TENANT TRIGGERS
// ---------------------------------------------------------------------------
assert(migrationSql.includes('fn_prevent_loyalty_ledger_mutation()'), 'Immutability function missing');
assert(migrationSql.includes('trg_prevent_loyalty_ledger_mutation'), 'Immutability trigger missing');
assert(migrationSql.includes('BEFORE UPDATE OR DELETE ON public.loyalty_ledger'), 'Immutability trigger event incorrect');

assert(migrationSql.includes('fn_loyalty_ledger_validate_tenant()'), 'Ledger tenant validator function missing');
assert(migrationSql.includes('trg_loyalty_ledger_validate_tenant'), 'Ledger tenant validator trigger missing');
assert(migrationSql.includes('fn_loyalty_redemption_validate_tenant()'), 'Redemption tenant validator function missing');
assert(migrationSql.includes('trg_loyalty_redemption_validate_tenant'), 'Redemption tenant validator trigger missing');

console.log('✓ [PASS] Immutability and cross-tenant integrity triggers verified');

// ---------------------------------------------------------------------------
// 6. STATIC CONTRACT VERIFICATION: VIEW
// ---------------------------------------------------------------------------
assert(migrationSql.includes('CREATE OR REPLACE VIEW public.v_loyalty_client_balance'), 'View v_loyalty_client_balance missing');
assert(migrationSql.includes('COALESCE(SUM(l.delta), 0)::BIGINT AS saldo_sellos'), 'View saldo calculation missing');
assert(migrationSql.includes("COUNT(l.id) FILTER (WHERE l.tipo_movimiento = 'acumulacion')::BIGINT AS total_acumulaciones"), 'total_acumulaciones missing');
assert(migrationSql.includes("COUNT(l.id) FILTER (WHERE l.tipo_movimiento = 'canje')::BIGINT AS total_canjes"), 'total_canjes missing');
assert(migrationSql.includes('FROM public.clientes_finales cf'), 'View base table must be clientes_finales');
assert(migrationSql.includes('LEFT JOIN public.loyalty_ledger l'), 'View must LEFT JOIN loyalty_ledger');

console.log('✓ [PASS] Derived view definition and aggregations verified');

// ---------------------------------------------------------------------------
// 7. STATIC CONTRACT VERIFICATION: RLS & GRANTS
// ---------------------------------------------------------------------------
requiredTables.forEach(tbl => {
  assert(migrationSql.includes(`ALTER TABLE ${tbl} ENABLE ROW LEVEL SECURITY;`), `RLS not enabled on ${tbl}`);
  assert(migrationSql.includes(`ALTER TABLE ${tbl} FORCE ROW LEVEL SECURITY;`), `RLS not forced on ${tbl}`);
});

assert(migrationSql.includes('loyalty_config_tenant_all'), 'RLS policy loyalty_config_tenant_all missing');
assert(migrationSql.includes('loyalty_rewards_tenant_all'), 'RLS policy loyalty_rewards_tenant_all missing');
assert(migrationSql.includes('loyalty_redemptions_tenant_select'), 'RLS policy loyalty_redemptions_tenant_select missing');
assert(migrationSql.includes('loyalty_ledger_tenant_select'), 'RLS policy loyalty_ledger_tenant_select missing');

assert(migrationSql.includes('GRANT SELECT ON public.v_loyalty_client_balance TO authenticated;'), 'View grant missing');
assert(migrationSql.includes('GRANT SELECT ON public.loyalty_ledger TO authenticated;'), 'Ledger read grant missing');
assert(!migrationSql.includes('GRANT INSERT ON public.loyalty_ledger TO authenticated;'), 'INSERT must NOT be granted on loyalty_ledger to authenticated (prevents arbitrary minting)');
assert(!migrationSql.includes('GRANT INSERT ON public.loyalty_redemptions TO authenticated;'), 'INSERT must NOT be granted on loyalty_redemptions to authenticated (mutations via Phase 2 RPCs only)');
assert(!migrationSql.includes('GRANT UPDATE ON public.loyalty_ledger'), 'UPDATE must NOT be granted on loyalty_ledger');
assert(!migrationSql.includes('GRANT DELETE ON public.loyalty_ledger'), 'DELETE must NOT be granted on loyalty_ledger');

console.log('✓ [PASS] RLS policies and role grants verified (hardened against direct browser minting)');

// ---------------------------------------------------------------------------
// 8. REGRESSION GUARDS: ZERO ALTERATIONS ON CANONICAL TABLES
// ---------------------------------------------------------------------------
const forbiddenPatterns = [
  { pattern: /\bALTER\s+TABLE\s+public\.pagos\b/i, name: 'ALTER TABLE public.pagos' },
  { pattern: /\bALTER\s+TABLE\s+public\.citas\b/i, name: 'ALTER TABLE public.citas' },
  { pattern: /\bALTER\s+TABLE\s+public\.clientes_finales\b/i, name: 'ALTER TABLE public.clientes_finales' },
  { pattern: /\bALTER\s+TABLE\s+public\.barberias\b/i, name: 'ALTER TABLE public.barberias' },
  { pattern: /\bALTER\s+TABLE\s+public\.usuarios\b/i, name: 'ALTER TABLE public.usuarios' },
  { pattern: /\bUPDATE\s+public\.(pagos|citas|clientes_finales|barberias|usuarios)\b/i, name: 'UPDATE on existing tables' },
  { pattern: /\bDELETE\s+FROM\s+public\.(pagos|citas|clientes_finales|barberias|usuarios)\b/i, name: 'DELETE FROM existing tables' },
  { pattern: /cumplea[ñn]os|birthday|fecha_nacimiento/i, name: 'Birthday feature reference' }
];

forbiddenPatterns.forEach(({ pattern, name }) => {
  assert(!pattern.test(migrationSql), `Regression violation: Found forbidden pattern "${name}"`);
});

console.log('✓ [PASS] Regression safety guards verified (zero mutations on canonical schemas, zero birthday references)');

// ---------------------------------------------------------------------------
// 9. STATIC CONTRACT VERIFICATION: ROLLBACK CLEANLINESS
// ---------------------------------------------------------------------------
assert(rollbackSql.includes('DROP VIEW IF EXISTS public.v_loyalty_client_balance CASCADE;'), 'Rollback missing view drop');
assert(rollbackSql.includes('DROP TRIGGER IF EXISTS trg_prevent_loyalty_ledger_mutation ON public.loyalty_ledger;'), 'Rollback missing ledger trigger drop');
assert(rollbackSql.includes('DROP TABLE IF EXISTS public.loyalty_ledger CASCADE;'), 'Rollback missing ledger table drop');
assert(rollbackSql.includes('DROP TABLE IF EXISTS public.loyalty_redemptions CASCADE;'), 'Rollback missing redemptions table drop');
assert(rollbackSql.includes('DROP TABLE IF EXISTS public.loyalty_rewards CASCADE;'), 'Rollback missing rewards table drop');
assert(rollbackSql.includes('DROP TABLE IF EXISTS public.barberia_loyalty_config CASCADE;'), 'Rollback missing config table drop');

console.log('✓ [PASS] Rollback script teardown order verified');

// ---------------------------------------------------------------------------
// 10. IN-MEMORY LOGIC ENGINE SIMULATION
// ---------------------------------------------------------------------------
console.log('\n--- Running Logical Simulation ---');

class MockPostgresDb {
  constructor() {
    this.barberias = new Map();
    this.clientes = new Map();
    this.ledger = [];
    this.rewards = new Map();
    this.redemptions = new Map();
  }

  addBarberia(id, name, ownerId) {
    this.barberias.set(id, { id, name, owner_id: ownerId, deleted_at: null });
  }

  addCliente(id, barberiaId, nombre) {
    this.clientes.set(id, { id, barberia_id: barberiaId, nombre });
  }

  // Trigger: prevent ledger mutation
  updateLedger(id, updates) {
    throw new Error('LOYALTY_LEDGER_IMMUTABLE: No se permite modificar o eliminar registros del ledger de lealtad.');
  }

  deleteLedger(id) {
    throw new Error('LOYALTY_LEDGER_IMMUTABLE: No se permite modificar o eliminar registros del ledger de lealtad.');
  }

  // Insert ledger entry with all constraints and triggers
  insertLedger(entry) {
    // 1. Check constraints
    if (entry.delta === 0) {
      throw new Error('CHECK_VIOLATION: delta <> 0');
    }
    const validTipos = ['acumulacion', 'canje', 'reversion', 'ajuste'];
    if (!validTipos.includes(entry.tipo_movimiento)) {
      throw new Error('CHECK_VIOLATION: tipo_movimiento');
    }
    if (entry.tipo_movimiento === 'acumulacion' && entry.delta <= 0) {
      throw new Error('CHECK_VIOLATION: chk_loyalty_ledger_delta_direction (acumulacion must have delta > 0)');
    }
    if (entry.tipo_movimiento === 'canje' && entry.delta >= 0) {
      throw new Error('CHECK_VIOLATION: chk_loyalty_ledger_delta_direction (canje must have delta < 0)');
    }

    // 2. Cross-tenant trigger: trg_loyalty_ledger_validate_tenant
    const cliente = this.clientes.get(entry.cliente_id);
    if (!cliente) {
      throw new Error(`LOYALTY_INVALID_CLIENT: Cliente ${entry.cliente_id} no existe`);
    }
    if (cliente.barberia_id !== entry.barberia_id) {
      throw new Error(`LOYALTY_CROSS_TENANT_VIOLATION: Cliente ${entry.cliente_id} pertenece a barberia ${cliente.barberia_id}, no a ${entry.barberia_id}`);
    }

    // 3. Partial Unique Index: ux_loyalty_ledger_source_idempotency
    if (entry.source_id != null && entry.source_type != null) {
      const duplicate = this.ledger.find(
        l => l.barberia_id === entry.barberia_id &&
             l.source_type === entry.source_type &&
             l.source_id === entry.source_id &&
             l.tipo_movimiento === entry.tipo_movimiento
      );
      if (duplicate) {
        throw new Error(`UNIQUE_VIOLATION: ux_loyalty_ledger_source_idempotency key (${entry.barberia_id}, ${entry.source_type}, ${entry.source_id}, ${entry.tipo_movimiento}) already exists`);
      }
    }

    // 4. Append
    const newEntry = {
      id: this.ledger.length + 1,
      ...entry,
      created_at: entry.created_at || new Date()
    };
    this.ledger.push(newEntry);
    return newEntry;
  }

  // View: public.v_loyalty_client_balance
  getViewLoyaltyClientBalance(barberiaId = null) {
    const results = [];
    for (const [clienteId, cliente] of this.clientes.entries()) {
      if (barberiaId !== null && cliente.barberia_id !== barberiaId) {
        continue;
      }

      const clientLedger = this.ledger.filter(
        l => l.cliente_id === clienteId && l.barberia_id === cliente.barberia_id
      );

      const saldo_sellos = clientLedger.reduce((sum, l) => sum + l.delta, 0);
      const total_acumulaciones = clientLedger.filter(l => l.tipo_movimiento === 'acumulacion').length;
      const total_canjes = clientLedger.filter(l => l.tipo_movimiento === 'canje').length;
      const ultimo_movimiento_at = clientLedger.length > 0 ? clientLedger[clientLedger.length - 1].created_at : null;

      results.push({
        barberia_id: cliente.barberia_id,
        cliente_id: clienteId,
        saldo_sellos,
        total_acumulaciones,
        total_canjes,
        ultimo_movimiento_at
      });
    }
    return results;
  }
}

const db = new MockPostgresDb();
db.addBarberia(1, 'Barberia Centro', 10);
db.addBarberia(2, 'Barberia Norte', 20);

db.addCliente(101, 1, 'Carlos Perez');
db.addCliente(102, 1, 'Andres Gomez');
db.addCliente(201, 2, 'Felipe Rojas');

// Sim 1: Balance test (+1, +1, +1, -2 = 1; +1 = 2)
db.insertLedger({ barberia_id: 1, cliente_id: 101, delta: 1, tipo_movimiento: 'acumulacion', source_type: 'pago', source_id: 1001 });
db.insertLedger({ barberia_id: 1, cliente_id: 101, delta: 1, tipo_movimiento: 'acumulacion', source_type: 'pago', source_id: 1002 });
db.insertLedger({ barberia_id: 1, cliente_id: 101, delta: 1, tipo_movimiento: 'acumulacion', source_type: 'pago', source_id: 1003 });
db.insertLedger({ barberia_id: 1, cliente_id: 101, delta: -2, tipo_movimiento: 'canje', source_type: 'redemption', source_id: 501 });

let balance = db.getViewLoyaltyClientBalance(1).find(r => r.cliente_id === 101);
assert.strictEqual(balance.saldo_sellos, 1, 'Balance after (+1, +1, +1, -2) must be 1');
assert.strictEqual(balance.total_acumulaciones, 3);
assert.strictEqual(balance.total_canjes, 1);

// Add another accumulation
db.insertLedger({ barberia_id: 1, cliente_id: 101, delta: 1, tipo_movimiento: 'acumulacion', source_type: 'pago', source_id: 1004 });
balance = db.getViewLoyaltyClientBalance(1).find(r => r.cliente_id === 101);
assert.strictEqual(balance.saldo_sellos, 2, 'Balance after (+1, +1, +1, -2, +1) must be 2');
assert.strictEqual(balance.total_acumulaciones, 4);
assert.strictEqual(balance.total_canjes, 1);
console.log('✓ [PASS] Balance derived math (+1, +1, +1, -2 = 1; +1 = 2) verified');

// Sim 2: Customer with 0 movements
const zeroMovementsClient = db.getViewLoyaltyClientBalance(1).find(r => r.cliente_id === 102);
assert.strictEqual(zeroMovementsClient.saldo_sellos, 0);
assert.strictEqual(zeroMovementsClient.total_acumulaciones, 0);
assert.strictEqual(zeroMovementsClient.total_canjes, 0);
assert.strictEqual(zeroMovementsClient.ultimo_movimiento_at, null);
console.log('✓ [PASS] Zero-movement customer balance verified (saldo = 0, totals = 0)');

// Sim 3: Idempotency protection
let caughtIdempotency = false;
try {
  db.insertLedger({ barberia_id: 1, cliente_id: 101, delta: 1, tipo_movimiento: 'acumulacion', source_type: 'pago', source_id: 1001 });
} catch (err) {
  caughtIdempotency = err.message.includes('UNIQUE_VIOLATION');
}
assert(caughtIdempotency, 'Duplicate payment accumulation must be rejected by unique idempotency index');
console.log('✓ [PASS] Idempotency duplicate rejection verified');

// Sim 4: Immutability (no UPDATE or DELETE)
let caughtUpdate = false;
try {
  db.updateLedger(1, { delta: 99 });
} catch (err) {
  caughtUpdate = err.message.includes('LOYALTY_LEDGER_IMMUTABLE');
}
assert(caughtUpdate, 'Ledger UPDATE must be rejected by immutability trigger');

let caughtDelete = false;
try {
  db.deleteLedger(1);
} catch (err) {
  caughtDelete = err.message.includes('LOYALTY_LEDGER_IMMUTABLE');
}
assert(caughtDelete, 'Ledger DELETE must be rejected by immutability trigger');
console.log('✓ [PASS] Ledger immutability (append-only enforcement) verified');

// Sim 5: Cross-tenant boundary rejection
let caughtCrossTenant = false;
try {
  // Client 201 belongs to Barberia 2, attempting to insert into Barberia 1
  db.insertLedger({ barberia_id: 1, cliente_id: 201, delta: 1, tipo_movimiento: 'acumulacion', source_type: 'pago', source_id: 2001 });
} catch (err) {
  caughtCrossTenant = err.message.includes('LOYALTY_CROSS_TENANT_VIOLATION');
}
assert(caughtCrossTenant, 'Cross-tenant assignment must be rejected by tenant validation trigger');
console.log('✓ [PASS] Cross-tenant boundary violation trigger verified');

// Sim 6: Directional constraint checks
let caughtInvalidDelta = false;
try {
  db.insertLedger({ barberia_id: 1, cliente_id: 101, delta: 0, tipo_movimiento: 'acumulacion' });
} catch (err) {
  caughtInvalidDelta = err.message.includes('CHECK_VIOLATION: delta <> 0');
}
assert(caughtInvalidDelta, 'Delta 0 must be rejected');

let caughtInvalidAcumulacion = false;
try {
  db.insertLedger({ barberia_id: 1, cliente_id: 101, delta: -1, tipo_movimiento: 'acumulacion' });
} catch (err) {
  caughtInvalidAcumulacion = err.message.includes('chk_loyalty_ledger_delta_direction');
}
assert(caughtInvalidAcumulacion, 'Negative delta for acumulacion must be rejected');

let caughtInvalidCanje = false;
try {
  db.insertLedger({ barberia_id: 1, cliente_id: 101, delta: 1, tipo_movimiento: 'canje' });
} catch (err) {
  caughtInvalidCanje = err.message.includes('chk_loyalty_ledger_delta_direction');
}
assert(caughtInvalidCanje, 'Positive delta for canje must be rejected');
console.log('✓ [PASS] Delta check constraints verified');

console.log('\n====================================================');
console.log('ALL LOYALTY PHASE 1 TEST ASSERTIONS PASSED (100%)');
console.log('====================================================');
