const https = require('https');
const fs = require('fs');
const { setup, cleanup, runSQL } = require('./run_postgres_query');

const HOST = 'barberagency-n8n.gymh5g.easypanel.host';
const SLOTS_PATH = '/webhook/barberagency/reservas/slots';

function makeGetRequest(queryParams) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams(queryParams);
    const options = {
      hostname: HOST,
      port: 443,
      path: `${SLOTS_PATH}?${params.toString()}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const r = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = { raw };
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    r.on('error', reject);
    r.end();
  });
}

(async () => {
  console.log('=== INICIANDO PRUEBAS OBLIGATORIAS DE DISPONIBILIDAD (SLOTS) ===');
  try {
    // 1. Obtener datos dinámicos de la base de datos
    await setup();

    console.log('Obteniendo datos de la base de datos para configurar las pruebas...');
    
    // Obtener servicio y barbero de barbería 198
    const myServices = await runSQL('SELECT id, nombre FROM public.servicios WHERE barberia_id = 198 AND activo = true LIMIT 1;');
    const myBarbers = await runSQL('SELECT id, nombre FROM public.barberos WHERE barberia_id = 198 AND activo = true LIMIT 1;');
    
    // Obtener servicio y barbero de OTRA barbería
    const foreignServices = await runSQL('SELECT id, barberia_id, nombre FROM public.servicios WHERE barberia_id != 198 AND activo = true LIMIT 1;');
    const foreignBarbers = await runSQL('SELECT id, barberia_id, nombre FROM public.barberos WHERE barberia_id != 198 AND activo = true LIMIT 1;');

    await cleanup();

    if (!myServices.length || !myBarbers.length || !foreignServices.length || !foreignBarbers.length) {
      throw new Error('No se pudieron obtener suficientes datos de prueba de la base de datos.');
    }

    const serviceId = myServices[0].id;
    const serviceName = myServices[0].nombre;
    const barberId = myBarbers[0].id;
    const barberName = myBarbers[0].nombre;

    const foreignServiceId = foreignServices[0].id;
    const foreignServiceName = foreignServices[0].nombre;
    const foreignBarberId = foreignBarbers[0].id;
    const foreignBarberName = foreignBarbers[0].nombre;

    console.log(`Configuración de prueba:`);
    console.log(`- Barbería ID: 198 (slug: barberia-prueba-4)`);
    console.log(`- Servicio Propio: ID ${serviceId} ("${serviceName}")`);
    console.log(`- Barbero Propio: ID ${barberId} ("${barberName}")`);
    console.log(`- Servicio Ajeno: ID ${foreignServiceId} ("${foreignServiceName}" de Barbería ${foreignServices[0].barberia_id})`);
    console.log(`- Barbero Ajeno: ID ${foreignBarberId} ("${foreignBarberName}" de Barbería ${foreignBarbers[0].barberia_id})`);
    console.log(`- Fecha de prueba: 2026-06-05\n`);

    const results = [];

    // --- PRUEBA A: Slots válido ---
    console.log('Ejecutando Prueba A: slots válido...');
    const resA = await makeGetRequest({
      barberia_id: '198',
      servicio_id: String(serviceId),
      barbero_id: String(barberId),
      fecha: '2026-06-05'
    });
    console.log(`Status: ${resA.status}, Body:`, JSON.stringify(resA.body, null, 2));
    const okA = resA.status === 200 && resA.body.ok === true && Array.isArray(resA.body.slots) && resA.body.slots.length > 0;
    results.push({
      id: 'A',
      name: 'Prueba A: slots válido (Barbería 198, Servicio real, Barbero real, Fecha 2026-06-05)',
      expected: 'ok = true con lista de slots',
      actual: `ok = ${resA.body.ok}, slots.length = ${resA.body.slots ? resA.body.slots.length : 0}`,
      status: resA.status,
      body: resA.body,
      ok: okA
    });

    // --- PRUEBA B: Slots con servicio ajeno ---
    console.log('\nEjecutando Prueba B: slots con servicio ajeno...');
    const resB = await makeGetRequest({
      barberia_id: '198',
      servicio_id: String(foreignServiceId),
      barbero_id: String(barberId),
      fecha: '2026-06-05'
    });
    console.log(`Status: ${resB.status}, Body:`, JSON.stringify(resB.body, null, 2));
    const okB = resB.body.ok === false && resB.body.code === 'servicio_no_pertenece';
    results.push({
      id: 'B',
      name: 'Prueba B: slots con servicio ajeno',
      expected: 'ok = false, code = servicio_no_pertenece',
      actual: `ok = ${resB.body.ok}, code = ${resB.body.code}`,
      status: resB.status,
      body: resB.body,
      ok: okB
    });

    // --- PRUEBA C: Slots con barbero ajeno ---
    console.log('\nEjecutando Prueba C: slots con barbero ajeno...');
    const resC = await makeGetRequest({
      barberia_id: '198',
      servicio_id: String(serviceId),
      barbero_id: String(foreignBarberId),
      fecha: '2026-06-05'
    });
    console.log(`Status: ${resC.status}, Body:`, JSON.stringify(resC.body, null, 2));
    const okC = resC.body.ok === false && resC.body.code === 'barbero_no_pertenece';
    results.push({
      id: 'C',
      name: 'Prueba C: slots con barbero ajeno',
      expected: 'ok = false, code = barbero_no_pertenece',
      actual: `ok = ${resC.body.ok}, code = ${resC.body.code}`,
      status: resC.status,
      body: resC.body,
      ok: okC
    });

    // --- PRUEBA D: Slots con fecha inválida ---
    console.log('\nEjecutando Prueba D: slots con fecha inválida...');
    const resD = await makeGetRequest({
      barberia_id: '198',
      servicio_id: String(serviceId),
      barbero_id: String(barberId),
      fecha: '2026-06-05-invalid'
    });
    console.log(`Status: ${resD.status}, Body:`, JSON.stringify(resD.body, null, 2));
    const okD = resD.body.ok === false && resD.body.code === 'datos_invalidos';
    results.push({
      id: 'D',
      name: 'Prueba D: slots con fecha inválida',
      expected: 'ok = false, code = datos_invalidos',
      actual: `ok = ${resD.body.ok}, code = ${resD.body.code}`,
      status: resD.status,
      body: resD.body,
      ok: okD
    });

    // --- EXTRA PRUEBA E: Slots de barbería 198 sin barbero (debe combinar slots de todos los barberos) ---
    console.log('\nEjecutando Prueba Extra E: slots sin barbero específico (debe retornar slots combinados)...');
    const resE = await makeGetRequest({
      barberia_id: '198',
      servicio_id: String(serviceId),
      fecha: '2026-06-05'
    });
    console.log(`Status: ${resE.status}, Body slots count: ${resE.body.slots ? resE.body.slots.length : 0}`);
    const okE = resE.status === 200 && resE.body.ok === true && Array.isArray(resE.body.slots) && resE.body.slots.length > 0;
    results.push({
      id: 'E',
      name: 'Prueba Extra E: slots sin barbero especificado (combinado)',
      expected: 'ok = true con lista de slots',
      actual: `ok = ${resE.body.ok}, slots.length = ${resE.body.slots ? resE.body.slots.length : 0}`,
      status: resE.status,
      body: { ok: resE.body.ok, count: resE.body.count, code: resE.body.code, slots: '...' },
      ok: okE
    });

    console.log('\n=======================================');
    console.log('      RESUMEN DE PRUEBAS DE SLOTS      ');
    console.log('=======================================');
    let allPassed = true;
    for (const r of results) {
      console.log(`[${r.id}] ${r.name}: ${r.ok ? '✅ APTO' : '❌ FALLIDO'} (Status: ${r.status}, Actual: ${r.actual})`);
      if (!r.ok) allPassed = false;
    }
    console.log('=======================================');
    console.log(allPassed ? '¡TODAS LAS PRUEBAS PASARON CORRECTAMENTE! 🎉' : 'ALGUNA PRUEBA FALLÓ.');

    // Escribir archivo de reporte markdown
    const reportPath = 'ContextoGeneral/RC3_Evidencia_Pruebas.md';
    let reportContent = `# 📝 Evidencia de Pruebas de Disponibilidad (Paso 10)\n\n`;
    reportContent += `**Fecha de Ejecución:** ${new Date().toISOString()}\n`;
    reportContent += `**Validador:** Antigravity (AI Agent)\n\n`;
    reportContent += `## 📊 Tabla de Resultados\n\n`;
    reportContent += `| ID | Caso de Prueba | Esperado | Obtenido | HTTP Status | Resultado |\n`;
    reportContent += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const r of results) {
      reportContent += `| **${r.id}** | ${r.name} | ${r.expected} | ${r.actual} | ${r.status} | ${r.ok ? '✅ APTO' : '❌ FALLIDO'} |\n`;
    }
    reportContent += `\n## 🛠 Respuestas JSON Detalladas\n\n`;
    for (const r of results) {
      reportContent += `### Respuesta ${r.id}: ${r.name}\n\`\`\`json\n${JSON.stringify(r.body, null, 2)}\n\`\`\`\n\n`;
    }
    fs.writeFileSync(reportPath, reportContent);
    console.log(`Saved report to ${reportPath}`);

  } catch (err) {
    console.error('Fatal test error:', err);
  }
})();
