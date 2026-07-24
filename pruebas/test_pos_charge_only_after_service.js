const https = require('https');
const assert = require('assert');

// Helper to execute SQL queries via temp_postgres_exec
function runSql(query) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query });
    const req = https.request({
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      path: '/webhook/temp_postgres_exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error(`Failed to parse JSON response: ${raw}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Call stored procedure directly
async function callFnPosCharge(barberiaId, citaId, total, metodo) {
  const sql = `SELECT public.fn_pos_registrar_pago_realizada(${barberiaId}, ${citaId}, ${total}, '${metodo}') AS res;`;
  const result = await runSql(sql);
  if (Array.isArray(result) && result[0] && result[0].res) {
    return result[0].res;
  }
  if (Array.isArray(result) && result[0] && result[0].result) {
    return result[0].result;
  }
  return result;
}

async function runTests() {
  console.log('=== INICIANDO PRUEBAS DE COBRO POS SOLO DESPUÉS DE SERVICIO REALIZADO ===\n');
  let passedCount = 0;
  let totalCount = 0;

  function logPass(testName) {
    totalCount++;
    passedCount++;
    console.log(`✅ TEST ${totalCount}: ${testName} - PASS`);
  }

  function logFail(testName, err) {
    totalCount++;
    console.error(`❌ TEST ${totalCount}: ${testName} - FAIL:`, err.message || err);
  }

  // Create temporary test citas for tenant 198
  const barberiaId = 198;
  const barberoId = 447;
  const servicioId = 489;
  const setupSql = `
    INSERT INTO public.citas (barberia_id, barbero_id, servicio_id, fecha, hora_inicio, hora_fin, cliente_nombre, cliente_tel, estado)
    VALUES
      (${barberiaId}, ${barberoId}, ${servicioId}, CURRENT_DATE, '10:00', '10:30', 'Test Pendiente', '1234567890', 'pendiente'),
      (${barberiaId}, ${barberoId}, ${servicioId}, CURRENT_DATE, '10:30', '11:00', 'Test Confirmada', '1234567890', 'confirmada'),
      (${barberiaId}, ${barberoId}, ${servicioId}, CURRENT_DATE, '11:00', '11:30', 'Test En Servicio', '1234567890', 'en_servicio'),
      (${barberiaId}, ${barberoId}, ${servicioId}, CURRENT_DATE, '11:30', '12:00', 'Test Realizada', '1234567890', 'realizada'),
      (${barberiaId}, ${barberoId}, ${servicioId}, CURRENT_DATE, '12:00', '12:30', 'Test Cancelada', '1234567890', 'cancelada'),
      (${barberiaId}, ${barberoId}, ${servicioId}, CURRENT_DATE, '12:30', '13:00', 'Test No Asistio', '1234567890', 'no_asistio')
    RETURNING id, estado;
  `;

  let createdCitas = [];
  try {
    const setupRes = await runSql(setupSql);
    createdCitas = setupRes.map(row => row.id ? row : (row.result ? row.result : row));
  } catch (err) {
    console.error('Error enviando setup data:', err.message);
  }

  const findCitaId = (estadoTarget) => {
    const item = createdCitas.find(c => String(c.estado).toLowerCase() === estadoTarget.toLowerCase());
    return item ? Number(item.id) : null;
  };

  const idPendiente = findCitaId('pendiente');
  const idConfirmada = findCitaId('confirmada');
  const idEnServicio = findCitaId('en_servicio');
  const idRealizada = findCitaId('realizada');
  const idCancelada = findCitaId('cancelada');
  const idNoAsistio = findCitaId('no_asistio');

  // 1. Cita pendiente no puede cobrarse
  try {
    const res = await callFnPosCharge(barberiaId, idPendiente, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_no_realizada');
    logPass('1. Cita pendiente no puede cobrarse');
  } catch (e) { logFail('1. Cita pendiente no puede cobrarse', e); }

  // 2. Cita confirmada no puede cobrarse
  try {
    const res = await callFnPosCharge(barberiaId, idConfirmada, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_no_realizada');
    logPass('2. Cita confirmada no puede cobrarse');
  } catch (e) { logFail('2. Cita confirmada no puede cobrarse', e); }

  // 3. Cita en servicio no puede cobrarse
  try {
    const res = await callFnPosCharge(barberiaId, idEnServicio, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_no_realizada');
    logPass('3. Cita en servicio no puede cobrarse');
  } catch (e) { logFail('3. Cita en servicio no puede cobrarse', e); }

  // 4. Cita realizada sí puede cobrarse
  try {
    const res = await callFnPosCharge(barberiaId, idRealizada, 15000, 'efectivo');
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.cita_id, idRealizada);
    logPass('4. Cita realizada sí puede cobrarse');
  } catch (e) { logFail('4. Cita realizada sí puede cobrarse', e); }

  // 5. Al cobrar, la cita pasa a 'pagada' en PostgreSQL
  try {
    const checkRes = await runSql(`SELECT estado FROM public.citas WHERE id = ${idRealizada};`);
    const estado = checkRes[0].estado;
    assert.strictEqual(estado, 'pagada');
    logPass('5. Cita transiciona a estado "pagada" tras cobro exitoso');
  } catch (e) { logFail('5. Cita transiciona a estado "pagada" tras cobro exitoso', e); }

  // 6. Cita pagada no puede cobrarse otra vez (bloqueo doble cobro)
  try {
    const res = await callFnPosCharge(barberiaId, idRealizada, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_ya_pagada');
    logPass('6. Cita pagada no puede cobrarse otra vez');
  } catch (e) { logFail('6. Cita pagada no puede cobrarse otra vez', e); }

  // 7. Cita de otra barbería no puede cobrarse (tenant isolation)
  try {
    const res = await callFnPosCharge(999, idRealizada, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_ajena');
    logPass('7. Cita de otra barbería no puede cobrarse');
  } catch (e) { logFail('7. Cita de otra barbería no puede cobrarse', e); }

  // 8. Cita cancelada no puede cobrarse
  try {
    const res = await callFnPosCharge(barberiaId, idCancelada, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_no_realizada');
    logPass('8. Cita cancelada no puede cobrarse');
  } catch (e) { logFail('8. Cita cancelada no puede cobrarse', e); }

  // 9. Cita no_asistio no puede cobrarse
  try {
    const res = await callFnPosCharge(barberiaId, idNoAsistio, 15000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'cita_no_realizada');
    logPass('9. Cita no_asistio no puede cobrarse');
  } catch (e) { logFail('9. Cita no_asistio no puede cobrarse', e); }

  // 10. Monto negativo es rechazado
  try {
    const res = await callFnPosCharge(barberiaId, idRealizada, -5000, 'efectivo');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'monto_negativo');
    logPass('10. Monto negativo es rechazado');
  } catch (e) { logFail('10. Monto negativo es rechazado', e); }

  // 11. Concurrencia simulada (dos llamadas concurrentes para la misma cita realizada)
  try {
    const tempCitaSql = `INSERT INTO public.citas (barberia_id, barbero_id, servicio_id, fecha, hora_inicio, hora_fin, cliente_nombre, cliente_tel, estado) VALUES (${barberiaId}, ${barberoId}, ${servicioId}, CURRENT_DATE, '13:00', '13:30', 'Test Concurrent', '1234567890', 'realizada') RETURNING id;`;
    const tempRes = await runSql(tempCitaSql);
    const tempId = Number(tempRes[0].id);

    const [res1, res2] = await Promise.all([
      callFnPosCharge(barberiaId, tempId, 20000, 'efectivo'),
      callFnPosCharge(barberiaId, tempId, 20000, 'efectivo')
    ]);

    const successes = [res1, res2].filter(r => r.ok === true);
    const failures = [res1, res2].filter(r => r.ok === false && r.code === 'cita_ya_pagada');

    assert.strictEqual(successes.length, 1, 'Exactamente un cobro debió tener éxito');
    assert.strictEqual(failures.length, 1, 'El segundo cobro debió ser rechazado por cita_ya_pagada');

    // Cleanup temp cita
    await runSql(`DELETE FROM public.pagos WHERE cita_id = ${tempId}; DELETE FROM public.citas WHERE id = ${tempId};`);
    logPass('11. Dos cobros concurrentes para la misma cita producen exactamente UN pago');
  } catch (e) { logFail('11. Dos cobros concurrentes para la misma cita producen exactamente UN pago', e); }

  // Cleanup all created test citas
  if (createdCitas.length > 0) {
    const ids = createdCitas.map(c => c.id).join(',');
    await runSql(`DELETE FROM public.pagos WHERE cita_id IN (${ids}); DELETE FROM public.citas WHERE id IN (${ids});`);
  }

  console.log(`\n=== RESUMEN DE PRUEBAS: ${passedCount}/${totalCount} PASS ===\n`);
  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runTests();
