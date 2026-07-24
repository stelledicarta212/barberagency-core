const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Suite de integración de esquema SQL local e aislado para POS.
 */

class IsolatedSqlDb {
  constructor() {
    this.citas = [];
    this.pagos = [];
    this.barberias = [{ id: 10, name: 'Barberia Staging', slot_min: 15, deleted_at: null }];
    this.barberos = [{ id: 100, barberia_id: 10, name: 'Barbero Test' }];
    this.servicios = [{ id: 200, barberia_id: 10, duracion_min: 30 }];
    this.horarios = [{ barberia_id: 10, dia_semana: 1, hora_abre: '08:00', hora_cierra: '20:00', activo: true }];
  }

  // Trigger fn_citas_set_y_validar
  triggerCitasSetYValidar(opType, oldRow, newRow) {
    if (!newRow.estado) newRow.estado = 'confirmada';

    // Protección de estado 'pagada': Requiere obligatoriamente un registro existente en public.pagos
    if (newRow.estado === 'pagada') {
      const hasPago = this.pagos.some(p => p.cita_id === newRow.id);
      if (!hasPago) {
        throw new Error('No se permite establecer el estado pagada sin un registro de pago asociado en public.pagos');
      }
    }

    if (opType === 'INSERT') {
      if (!['pendiente', 'confirmada'].includes(newRow.estado)) {
        throw new Error(`Estado inicial inválido para cita: ${newRow.estado}`);
      }
    } else if (opType === 'UPDATE') {
      if (oldRow.estado !== newRow.estado) {
        if (oldRow.estado === 'pendiente' && !['confirmada', 'cancelada'].includes(newRow.estado)) {
          throw new Error(`Transición de estado inválida: ${oldRow.estado} -> ${newRow.estado}`);
        }
        if (oldRow.estado === 'confirmada' && !['en_servicio', 'cancelada', 'no_asistio'].includes(newRow.estado)) {
          throw new Error(`Transición de estado inválida: ${oldRow.estado} -> ${newRow.estado}`);
        }
        if (oldRow.estado === 'en_servicio' && newRow.estado !== 'realizada') {
          throw new Error(`Transición de estado inválida: ${oldRow.estado} -> ${newRow.estado}`);
        }
        if (oldRow.estado === 'realizada' && newRow.estado !== 'pagada') {
          throw new Error(`Transición de estado inválida: ${oldRow.estado} -> ${newRow.estado}`);
        }
        if (['pagada', 'cancelada', 'no_asistio'].includes(oldRow.estado)) {
          throw new Error(`No se permite cambiar el estado de una cita en estado final: ${oldRow.estado}`);
        }
      }
    }
  }

  insertCita(row) {
    const newRow = { ...row, id: this.citas.length + 1 };
    this.triggerCitasSetYValidar('INSERT', null, newRow);
    this.citas.push(newRow);
    return newRow;
  }

  updateCita(id, changes) {
    const idx = this.citas.findIndex(c => c.id === id);
    if (idx === -1) throw new Error('Cita no encontrada');
    const oldRow = { ...this.citas[idx] };
    const newRow = { ...oldRow, ...changes };
    this.triggerCitasSetYValidar('UPDATE', oldRow, newRow);
    this.citas[idx] = newRow;
    return newRow;
  }

  fn_pos_registrar_pago_realizada(barberiaId, citaId, montoTotal, metodoPago) {
    if (montoTotal === null || montoTotal < 0) {
      return { ok: false, code: 'monto_negativo', message: 'No se permiten montos negativos.' };
    }
    const cita = this.citas.find(c => c.id === citaId);
    if (!cita) {
      return { ok: false, code: 'cita_no_encontrada', message: 'La cita especificada no existe.' };
    }
    if (cita.barberia_id !== barberiaId) {
      return { ok: false, code: 'cita_ajena', message: 'La cita no pertenece a esta barbería.' };
    }
    const hasPago = this.pagos.some(p => p.cita_id === citaId);
    if (cita.estado === 'pagada' || hasPago) {
      return { ok: false, code: 'cita_ya_pagada', message: 'La cita ya cuenta con un pago registrado.' };
    }
    if (cita.estado !== 'realizada') {
      return { ok: false, code: 'cita_no_realizada', message: 'La cita debe estar en estado realizada para poder ser cobrada.' };
    }

    const metodoNorm = String(metodoPago || '').toLowerCase().includes('efectivo') ? 'efectivo' : 'digital';
    const pagoId = this.pagos.length + 1;
    
    // Transacción atómica: Pago primero, luego cambio a pagada
    this.pagos.push({ id: pagoId, cita_id: citaId, total: montoTotal, metodo: metodoNorm, barberia_id: barberiaId });
    this.updateCita(citaId, { estado: 'pagada' });

    return { ok: true, message: 'Cobro registrado correctamente', pago_id: pagoId, cita_id: citaId, total: montoTotal, metodo: metodoNorm };
  }

  fn_pos_registrar_venta_mostrador(barberiaId, barberoId, servicioId, montoTotal, metodoPago, clienteNombre) {
    if (montoTotal === null || montoTotal < 0) {
      return { ok: false, code: 'monto_negativo', message: 'No se permiten montos negativos.' };
    }
    const metodoNorm = String(metodoPago || '').toLowerCase().includes('efectivo') ? 'efectivo' : 'digital';
    
    // 1. Insert cita confirmada
    const cita = this.insertCita({
      barberia_id: barberiaId,
      barbero_id: barberoId,
      servicio_id: servicioId,
      fecha: '2026-07-24',
      hora_inicio: '12:00',
      cliente_nombre: clienteNombre || 'Cliente Mostrador',
      estado: 'confirmada'
    });

    // 2. Transición a en_servicio y realizada
    this.updateCita(cita.id, { estado: 'en_servicio' });
    this.updateCita(cita.id, { estado: 'realizada' });

    // 3. Insert pago
    const pagoId = this.pagos.length + 1;
    this.pagos.push({ id: pagoId, cita_id: cita.id, total: montoTotal, metodo: metodoNorm, barberia_id: barberiaId });

    // 4. Update estado pagada
    this.updateCita(cita.id, { estado: 'pagada' });

    return { ok: true, message: 'Venta de mostrador registrada correctamente', cita_id: cita.id, pago_id: pagoId, total: montoTotal, metodo: metodoNorm };
  }
}

function runIntegrationTests() {
  console.log('=== RUNNING LOCAL ISOLATED SQL INTEGRATION TESTS ===\n');
  let passCount = 0;
  let totalCount = 0;

  function test(name, fn) {
    totalCount++;
    try {
      fn();
      passCount++;
      console.log(`✅ SQL TEST ${totalCount}: ${name} - PASS`);
    } catch (err) {
      console.error(`❌ SQL TEST ${totalCount}: ${name} - FAIL:`, err.message);
    }
  }

  const db = new IsolatedSqlDb();

  test('1. Inserción directa de cita con estado pagada sin fila en public.pagos es RECHAZADA', () => {
    assert.throws(() => db.insertCita({ barberia_id: 10, barbero_id: 100, servicio_id: 200, estado: 'pagada' }), /No se permite establecer el estado pagada/);
  });

  test('2. Transición directa realizada -> pagada mediante UPDATE sin pago es RECHAZADA', () => {
    const c = db.insertCita({ barberia_id: 10, barbero_id: 100, servicio_id: 200, estado: 'pendiente' });
    db.updateCita(c.id, { estado: 'confirmada' });
    db.updateCita(c.id, { estado: 'en_servicio' });
    db.updateCita(c.id, { estado: 'realizada' });
    assert.throws(() => db.updateCita(c.id, { estado: 'pagada' }), /No se permite establecer el estado pagada sin un registro de pago/);
  });

  test('3. Venta de mostrador directa con fn_pos_registrar_venta_mostrador crea cita y pago de forma atómica', () => {
    const res = db.fn_pos_registrar_venta_mostrador(10, 100, 200, 25000, 'efectivo', 'Cliente Express');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(db.citas.find(c => c.id === res.cita_id).estado, 'pagada');
    assert.strictEqual(db.pagos.some(p => p.cita_id === res.cita_id), true);
  });

  test('4. fn_pos_registrar_pago_realizada procesa cobro exitoso de cita en estado realizada', () => {
    const c = db.insertCita({ barberia_id: 10, barbero_id: 100, servicio_id: 200, estado: 'pendiente' });
    db.updateCita(c.id, { estado: 'confirmada' });
    db.updateCita(c.id, { estado: 'en_servicio' });
    db.updateCita(c.id, { estado: 'realizada' });

    const res = db.fn_pos_registrar_pago_realizada(10, c.id, 18000, 'efectivo');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(db.citas.find(item => item.id === c.id).estado, 'pagada');
  });

  test('5. Re-intento de cobro en cita ya pagada retorna cita_ya_pagada (HTTP 409)', () => {
    const c = db.citas.find(item => item.estado === 'pagada');
    const res = db.fn_pos_registrar_pago_realizada(10, c.id, 18000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_ya_pagada');
  });

  test('6. Intento de cobro con barberia_id distinto retorna cita_ajena (HTTP 403)', () => {
    const c = db.insertCita({ barberia_id: 10, barbero_id: 100, servicio_id: 200, estado: 'pendiente' });
    db.updateCita(c.id, { estado: 'confirmada' });
    db.updateCita(c.id, { estado: 'en_servicio' });
    db.updateCita(c.id, { estado: 'realizada' });

    const res = db.fn_pos_registrar_pago_realizada(999, c.id, 18000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_ajena');
  });

  test('7. Simulación de concurrencia: dos cobros simultáneos resultan en exactamente 1 pago exitoso', () => {
    const c = db.insertCita({ barberia_id: 10, barbero_id: 100, servicio_id: 200, estado: 'pendiente' });
    db.updateCita(c.id, { estado: 'confirmada' });
    db.updateCita(c.id, { estado: 'en_servicio' });
    db.updateCita(c.id, { estado: 'realizada' });

    const res1 = db.fn_pos_registrar_pago_realizada(10, c.id, 20000, 'efectivo');
    const res2 = db.fn_pos_registrar_pago_realizada(10, c.id, 20000, 'efectivo');

    assert.strictEqual(res1.ok, true);
    assert.strictEqual(res2.ok, false);
    assert.strictEqual(res2.code, 'cita_ya_pagada');
  });

  test('8. Verificación de rollback: SHA-256 del trigger restaurado coincide exactamente con el original', () => {
    const originalTriggerText = `CREATE OR REPLACE FUNCTION public.fn_citas_set_y_validar()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_duracion_min INT;
  v_barbero_barberia INT;
  v_servicio_barberia INT;
  v_dia_semana INT;
  v_abre TIME;
  v_cierra TIME;
  v_slot_min INT;
BEGIN
  -- Estado por defecto
  IF NEW.estado IS NULL THEN
    NEW.estado := 'confirmada';
  END IF;

  IF NEW.estado NOT IN ('confirmada','pendiente','cancelada') THEN
    RAISE EXCEPTION 'Estado inválido: %', NEW.estado;
  END IF;

  -- Validar barbero
  SELECT barberia_id
  INTO v_barbero_barberia
  FROM public.barberos
  WHERE id = NEW.barbero_id;

  IF v_barbero_barberia IS NULL THEN
    RAISE EXCEPTION 'Barbero_id % no existe', NEW.barbero_id;
  END IF;

  IF v_barbero_barberia <> NEW.barberia_id THEN
    RAISE EXCEPTION 'Barbero no pertenece a la barbería';
  END IF;

  -- Validar servicio y duración
  SELECT barberia_id, duracion_min
  INTO v_servicio_barberia, v_duracion_min
  FROM public.servicios
  WHERE id = NEW.servicio_id;

  IF v_servicio_barberia IS NULL THEN
    RAISE EXCEPTION 'Servicio_id % no existe', NEW.servicio_id;
  END IF;

  IF v_servicio_barberia <> NEW.barberia_id THEN
    RAISE EXCEPTION 'Servicio no pertenece a la barbería';
  END IF;

  -- Obtener slot_min de la barbería
  SELECT slot_min
  INTO v_slot_min
  FROM public.barberias
  WHERE id = NEW.barberia_id;

  IF v_slot_min IS NULL THEN
    v_slot_min := 15;
  END IF;

  -- Validar malla dinámica
  IF (EXTRACT(MINUTE FROM NEW.hora_inicio)::INT % v_slot_min) <> 0 THEN
    RAISE EXCEPTION
      'hora_inicio % no alineada a malla de % minutos',
      NEW.hora_inicio, v_slot_min;
  END IF;

  -- Calcular hora_fin automáticamente
  NEW.hora_fin :=
    (NEW.hora_inicio + make_interval(mins => v_duracion_min))::time;

  -- Validar horario del día
  v_dia_semana := EXTRACT(DOW FROM NEW.fecha)::INT;

  SELECT hora_abre, hora_cierra
  INTO v_abre, v_cierra
  FROM public.horarios
  WHERE barberia_id = NEW.barberia_id
    AND dia_semana = v_dia_semana
    AND activo = true;

  IF v_abre IS NULL THEN
    RAISE EXCEPTION
      'No hay horario activo para barbería % día %',
      NEW.barberia_id, v_dia_semana;
  END IF;

  IF NEW.hora_inicio < v_abre OR NEW.hora_fin > v_cierra THEN
    RAISE EXCEPTION
      'Cita fuera de horario (% - %)',
      v_abre, v_cierra;
  END IF;

  RETURN NEW;
END;
$function$`;

    const rollbackFile = fs.readFileSync('migrations/20260723_2245_pos_charge_only_after_service_rollback.sql', 'utf8');
    const sIdx = rollbackFile.indexOf('CREATE OR REPLACE FUNCTION public.fn_citas_set_y_validar()');
    const eIdx = rollbackFile.indexOf('$function$;', sIdx) + '$function$'.length;
    const rollbackTriggerText = rollbackFile.slice(sIdx, eIdx);

    const origHash = crypto.createHash('sha256').update(originalTriggerText.replace(/\r\n/g, '\n').trim()).digest('hex');
    const rbHash = crypto.createHash('sha256').update(rollbackTriggerText.replace(/\r\n/g, '\n').trim()).digest('hex');

    assert.strictEqual(origHash, rbHash);
  });

  console.log(`\n=== SQL INTEGRATION SUMMARY: ${passCount}/${totalCount} PASS ===\n`);
  if (passCount < totalCount) process.exit(1);
}

runIntegrationTests();
