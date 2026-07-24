const assert = require('assert');

/**
 * Suite de pruebas unitarias aisladas para la lógica POS y transiciones de estado de Citas.
 * No utiliza base de datos de producción, no llama a endpoints temporales y no depende de IDs fijos.
 */

// Simulador en memoria de la función de base de datos fn_pos_registrar_pago_realizada
function simulateFnPosCharge(dbCitas, dbPagos, barberiaId, citaId, total, metodo) {
  if (total === null || total === undefined || total < 0) {
    return { ok: false, code: 'monto_negativo', message: 'No se permiten montos negativos.' };
  }

  const metodoNormalizado = String(metodo || '').toLowerCase().includes('efectivo') ? 'efectivo' : 'digital';
  const cita = dbCitas.find(c => c.id === citaId);

  if (!cita) {
    return { ok: false, code: 'cita_no_encontrada', message: 'La cita especificada no existe.' };
  }

  if (cita.barberia_id !== barberiaId) {
    return { ok: false, code: 'cita_ajena', message: 'La cita no pertenece a esta barbería.' };
  }

  const hasPago = dbPagos.some(p => p.cita_id === citaId);
  if (cita.estado === 'pagada' || hasPago) {
    return { ok: false, code: 'cita_ya_pagada', message: 'La cita ya cuenta con un pago registrado.' };
  }

  if (cita.estado !== 'realizada') {
    return { ok: false, code: 'cita_no_realizada', message: 'La cita debe estar en estado realizada para poder ser cobrada.' };
  }

  // Transacción atómica
  const nuevoPagoId = dbPagos.length + 1;
  dbPagos.push({ id: nuevoPagoId, cita_id: citaId, total, metodo: metodoNormalizado, barberia_id: barberiaId });
  cita.estado = 'pagada';

  return { ok: true, message: 'Cobro registrado correctamente', pago_id: nuevoPagoId, cita_id: citaId, total, metodo: metodoNormalizado };
}

// Simulador de la matriz de transiciones estrictas fn_citas_set_y_validar
function validateStateTransition(opType, oldEstado, newEstado) {
  if (opType === 'INSERT') {
    if (!['pendiente', 'confirmada', 'pagada'].includes(newEstado)) {
      throw new Error(`Estado inicial inválido para cita: ${newEstado}`);
    }
    return true;
  }
  if (opType === 'UPDATE' && oldEstado !== newEstado) {
    if (oldEstado === 'pendiente' && !['confirmada', 'cancelada'].includes(newEstado)) {
      throw new Error(`Transición de estado inválida: ${oldEstado} -> ${newEstado}`);
    }
    if (oldEstado === 'confirmada' && !['en_servicio', 'cancelada', 'no_asistio'].includes(newEstado)) {
      throw new Error(`Transición de estado inválida: ${oldEstado} -> ${newEstado}`);
    }
    if (oldEstado === 'en_servicio' && newEstado !== 'realizada') {
      throw new Error(`Transición de estado inválida: ${oldEstado} -> ${newEstado}`);
    }
    if (oldEstado === 'realizada' && newEstado !== 'pagada') {
      throw new Error(`Transición de estado inválida: ${oldEstado} -> ${newEstado}`);
    }
    if (['pagada', 'cancelada', 'no_asistio'].includes(oldEstado)) {
      throw new Error(`No se permite cambiar el estado de una cita en estado final: ${oldEstado}`);
    }
  }
  return true;
}

function runSuite() {
  console.log('=== RUNNING ISOLATED POS & STATE TRANSITION UNIT TESTS ===\n');
  let passCount = 0;
  let totalCount = 0;

  function test(name, fn) {
    totalCount++;
    try {
      fn();
      passCount++;
      console.log(`✅ TEST ${totalCount}: ${name} - PASS`);
    } catch (err) {
      console.error(`❌ TEST ${totalCount}: ${name} - FAIL:`, err.message);
    }
  }

  test('1. Cita pendiente no puede cobrarse (code: cita_no_realizada)', () => {
    const citas = [{ id: 1, barberia_id: 10, estado: 'pendiente' }];
    const pagos = [];
    const res = simulateFnPosCharge(citas, pagos, 10, 1, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_no_realizada');
  });

  test('2. Cita confirmada no puede cobrarse (code: cita_no_realizada)', () => {
    const citas = [{ id: 2, barberia_id: 10, estado: 'confirmada' }];
    const pagos = [];
    const res = simulateFnPosCharge(citas, pagos, 10, 2, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_no_realizada');
  });

  test('3. Cita en servicio no puede cobrarse (code: cita_no_realizada)', () => {
    const citas = [{ id: 3, barberia_id: 10, estado: 'en_servicio' }];
    const pagos = [];
    const res = simulateFnPosCharge(citas, pagos, 10, 3, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_no_realizada');
  });

  test('4. Cita realizada sí puede cobrarse (ok: true)', () => {
    const citas = [{ id: 4, barberia_id: 10, estado: 'realizada' }];
    const pagos = [];
    const res = simulateFnPosCharge(citas, pagos, 10, 4, 15000, 'efectivo');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(citas[0].estado, 'pagada');
    assert.strictEqual(pagos.length, 1);
  });

  test('5. Cita pagada no puede cobrarse otra vez (code: cita_ya_pagada)', () => {
    const citas = [{ id: 5, barberia_id: 10, estado: 'pagada' }];
    const pagos = [{ id: 100, cita_id: 5, total: 15000, barberia_id: 10 }];
    const res = simulateFnPosCharge(citas, pagos, 10, 5, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_ya_pagada');
  });

  test('6. Cita de otra barbería es rechazada (code: cita_ajena)', () => {
    const citas = [{ id: 6, barberia_id: 99, estado: 'realizada' }];
    const pagos = [];
    const res = simulateFnPosCharge(citas, pagos, 10, 6, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_ajena');
  });

  test('7. Monto negativo es rechazado (code: monto_negativo)', () => {
    const citas = [{ id: 7, barberia_id: 10, estado: 'realizada' }];
    const pagos = [];
    const res = simulateFnPosCharge(citas, pagos, 10, 7, -500, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'monto_negativo');
  });

  test('8. Transición válida pendiente -> confirmada', () => {
    assert.strictEqual(validateStateTransition('UPDATE', 'pendiente', 'confirmada'), true);
  });

  test('9. Transición válida confirmada -> en_servicio', () => {
    assert.strictEqual(validateStateTransition('UPDATE', 'confirmada', 'en_servicio'), true);
  });

  test('10. Transición válida en_servicio -> realizada', () => {
    assert.strictEqual(validateStateTransition('UPDATE', 'en_servicio', 'realizada'), true);
  });

  test('11. Transición válida realizada -> pagada', () => {
    assert.strictEqual(validateStateTransition('UPDATE', 'realizada', 'pagada'), true);
  });

  test('12. Transición inválida pendiente -> realizada rechazada', () => {
    assert.throws(() => validateStateTransition('UPDATE', 'pendiente', 'realizada'), /Transición de estado inválida/);
  });

  test('13. Transición inválida confirmada -> pagada rechazada', () => {
    assert.throws(() => validateStateTransition('UPDATE', 'confirmada', 'pagada'), /Transición de estado inválida/);
  });

  test('14. Modificación de cita en estado terminal (pagada) rechazada', () => {
    assert.throws(() => validateStateTransition('UPDATE', 'pagada', 'confirmada'), /No se permite cambiar el estado/);
  });

  console.log(`\n=== SUMMARY: ${passCount}/${totalCount} PASS ===\n`);
  if (passCount < totalCount) {
    process.exit(1);
  }
}

runSuite();
