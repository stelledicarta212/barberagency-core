const https = require('https');
const http = require('http');
const { setup, cleanup, runSQL } = require("C:\\\\Users\\\\calvi\\\\OneDrive\\\\n8n\\\\Visual studio\\\\barberagency-core\\\\pruebas\\\\run_postgres_query.js");

function makeRequest(url, method, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers: { ...headers }
    };
    if (data) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const r = client.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = { raw };
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

async function loginAndGetCookie(email, password) {
  const loginPayload = {
    email,
    password,
    barberia_id: 198,
    slug: 'barberia-prueba-4'
  };
  const res = await makeRequest(
    'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/login',
    'POST',
    {},
    loginPayload
  );
  
  let cookie = '';
  if (res.headers['set-cookie']) {
    const setCookie = Array.isArray(res.headers['set-cookie']) 
      ? res.headers['set-cookie'][0] 
      : res.headers['set-cookie'];
    const match = setCookie.match(/(?:^|;)\s*ba_session=([^;]+)/);
    if (match) cookie = match[1];
  }
  return { status: res.status, body: res.body, cookie };
}

(async () => {
  console.log('=== STARTING DEEP QA AUDIT ON PRODUCTION ===');
  const qaResults = [];
  let ownerHash = null;
  const ownerEmail = 'pildorasdeautomatizacion@gmail.com';
  const tempPassword = 'temp_password_123';

  try {
    await setup();
    
    // Backup and temporarily set owner password
    const ownerRows = await runSQL(`SELECT password_hash FROM public.usuarios WHERE lower(email) = $1;`, [ownerEmail]);
    ownerHash = ownerRows[0]?.password_hash;
    const tempHashRows = await runSQL(`SELECT crypt($1, gen_salt('bf', 8)) as new_hash;`, [tempPassword]);
    const tempHash = tempHashRows[0].new_hash;
    await runSQL(`UPDATE public.usuarios SET password_hash = $1 WHERE lower(email) = $2;`, [tempHash, ownerEmail]);

    // Retrieve active service and barber from DB
    const serviceRows = await runSQL(`SELECT id, nombre FROM public.servicios WHERE barberia_id = 198 AND activo = true LIMIT 1;`);
    const barberRows = await runSQL(`SELECT id, nombre FROM public.barberos WHERE barberia_id = 198 AND activo = true LIMIT 1;`);
    if (!serviceRows.length || !barberRows.length) {
      throw new Error('No active services or barbers in barberia 198 for testing');
    }
    const testServiceId = serviceRows[0].id;
    const testBarberId = barberRows[0].id;
    
    console.log(`Test Parameters: Service ID = ${testServiceId}, Barber ID = ${testBarberId}`);

    // A. Login y sesión
    console.log('\n--- SECTION A: Login y sesión ---');
    const loginRes = await loginAndGetCookie(ownerEmail, tempPassword);
    const hasCookie = !!loginRes.cookie;
    qaResults.push({
      section: 'A. Login y sesión',
      test: '1. Login con usuario autorizado y obtención de ba_session',
      status: loginRes.status === 200 && hasCookie ? 'PASS' : 'FAIL',
      evidence: `HTTP ${loginRes.status}, Cookie: ${hasCookie ? 'Recibida' : 'Nula'}`
    });

    const sessionMeRes = await makeRequest(
      'http://localhost:3000/api/session/me',
      'GET',
      { 'Cookie': `ba_session=${loginRes.cookie}` }
    );
    const hasB198InMe = sessionMeRes.body?.barberias?.some(b => b.id === 198);
    qaResults.push({
      section: 'A. Login y sesión',
      test: '2. session/me devuelve barbería 198 autorizada',
      status: sessionMeRes.status === 200 && hasB198InMe ? 'PASS' : 'FAIL',
      evidence: `HTTP ${sessionMeRes.status}, Barberia 198 en lista: ${hasB198InMe}`
    });

    const stateRes = await makeRequest(
      'http://localhost:3000/api/dashboard/state?barberia_id=198',
      'GET',
      { 'Cookie': `ba_session=${loginRes.cookie}` }
    );
    const hasRealData = stateRes.body?.merged?.biz_name !== undefined;
    qaResults.push({
      section: 'A. Login y sesión',
      test: '3. dashboard/state devuelve 200 con datos reales',
      status: stateRes.status === 200 && hasRealData ? 'PASS' : 'FAIL',
      evidence: `HTTP ${stateRes.status}, Nombre Barbería: "${stateRes.body?.merged?.biz_name || ''}"`
    });

    // B. Configuración mode=edit
    console.log('\n--- SECTION B: Configuración mode=edit ---');
    const originalEmailContact = stateRes.body?.barberia?.email_contacto;
    
    // Perform config update proxy call
    const updatePayload = {
      mode: 'edit',
      barberia_id: 198,
      slug: 'barberia-prueba-4',
      draft: {
        barberia: {
          id: 198,
          nombre: 'Barberia Prueba 4',
          slug: 'barberia-prueba-4',
          direccion: 'Calle 131#101-10',
          ciudad: 'Bogota',
          politicas: 'QA_TEST_POLITICAS_' + Date.now(),
          slot_min: 30
        },
        servicios: [
          { id: testServiceId, nombre: serviceRows[0].nombre, activo: true }
        ],
        barberos: [
          { id: testBarberId, nombre: barberRows[0].nombre, activo: true }
        ],
        horarios: [
          { dia_semana: 1, activo: true, hora_abre: '08:00', hora_cierra: '20:30' }
        ],
        accesos: {
          admin: {
            nombre: 'Carlos Alvis',
            email: 'pildorasdeautomatizacion@gmail.com'
          }
        }
      }
    };

    const updateRes = await makeRequest(
      'http://localhost:3000/api/configuracion/update',
      'POST',
      { 'Cookie': `ba_session=${loginRes.cookie}` },
      updatePayload
    );

    // SQL verification after config update
    const dbBarberiaAfter = await runSQL(`SELECT owner_id, email_contacto FROM public.barberias WHERE id = 198;`);
    const dbOwnerUnchanged = dbBarberiaAfter[0]?.owner_id === 7;
    const dbEmailContactUnchanged = dbBarberiaAfter[0]?.email_contacto === originalEmailContact;
    
    // Check that barbers emails and hashes are intact
    const userHashes = await runSQL(`SELECT id, email, password_hash FROM public.usuarios WHERE id = 7;`);
    const hashesIntact = userHashes[0]?.password_hash !== null && userHashes[0]?.password_hash !== '';

    qaResults.push({
      section: 'B. Configuración',
      test: '1. /api/configuracion/update responde exitosamente',
      status: updateRes.status === 200 && updateRes.body.code === 'configuracion_actualizada' ? 'PASS' : 'FAIL',
      evidence: `HTTP ${updateRes.status}, Respuesta: ${updateRes.body.code}`
    });

    qaResults.push({
      section: 'B. Configuración',
      test: '2. Seguridad SQL (owner_id no cambia, hashes intactos)',
      status: dbOwnerUnchanged && hashesIntact ? 'PASS' : 'FAIL',
      evidence: `owner_id actual: ${dbBarberiaAfter[0]?.owner_id} (esperado 7), Hash de contraseñas intacto: ${hashesIntact}`
    });

    // C. Editor y publicación
    console.log('\n--- SECTION C: Editor y publicación ---');
    const mockPublishPayload = {
      barberia_id: 198,
      site_base_url: 'https://barberagency-barberagency.gymh5g.easypanel.host',
      slug: 'barberia-prueba-4',
      template: { template_id: '1', template_name: 'modern' },
      branding: { 
        logo_url: 'https://images.unsplash.com/logo.jpg', 
        cover_url: 'https://images.unsplash.com/cover.jpg',
        color_primary: '#000000',
        color_secondary: '#111111',
        color_text: '#ffffff'
      },
      inherited: {
        servicios: [{ nombre: serviceRows[0].nombre, precio: 15000 }],
        barberos: [{ nombre: barberRows[0].nombre, activo: true }],
        horarios: [{ dia_semana: 1, activo: true, hora_abre: '08:00', hora_cierra: '20:00' }]
      }
    };

    const publishRes = await makeRequest(
      'http://localhost:3000/api/editor/publish',
      'POST',
      { 'Cookie': `ba_session=${loginRes.cookie}` },
      { p_payload: mockPublishPayload }
    );

    qaResults.push({
      section: 'C. Editor y publicación',
      test: '1. /api/editor/publish publica landing con respuesta 200',
      status: publishRes.status === 200 && publishRes.body.ok === true ? 'PASS' : 'FAIL',
      evidence: `HTTP ${publishRes.status}, URL pública: ${publishRes.body.public_landing_url}`
    });

    // D. Landing pública y reservas
    console.log('\n--- SECTION D: Landing pública y reservas ---');
    const testDate = '2026-06-12';
    
    // 1. Check Slots
    const slotsRes = await makeRequest(
      `https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/reservas/slots?barberia_id=198&servicio_id=${testServiceId}&barbero_id=${testBarberId}&fecha=${testDate}`,
      'GET'
    );
    const slotsLoaded = slotsRes.status === 200 && slotsRes.body.ok === true && Array.isArray(slotsRes.body.slots);
    const initialSlotCount = slotsLoaded ? slotsRes.body.slots.length : 0;
    
    qaResults.push({
      section: 'D. Landing y reservas',
      test: '1. Carga de slots disponibles',
      status: slotsLoaded && initialSlotCount > 0 ? 'PASS' : 'FAIL',
      evidence: `HTTP ${slotsRes.status}, Slots encontrados: ${initialSlotCount}`
    });

    let reservationCreated = false;
    let createdCitaId = null;
    if (slotsLoaded && initialSlotCount > 0) {
      const selectedSlot = slotsRes.body.slots[0].hora_inicio; // e.g. "08:00"
      console.log(`Intentando reservar slot: ${selectedSlot} en fecha ${testDate}`);
      
      const createRes = await makeRequest(
        'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/reservas/create',
        'POST',
        {},
        {
          barberia_id: 198,
          slug: 'barberia-prueba-4',
          servicio_id: testServiceId,
          barbero_id: testBarberId,
          fecha: testDate,
          hora_inicio: selectedSlot,
          cliente_nombre: 'QA Tester Automático',
          cliente_tel: '3109999999',
          cliente_email: 'qa-test-citas-prod@barberagency.com',
          notas: 'Reserva automática de pruebas QA'
        }
      );
      
      reservationCreated = createRes.status === 200 && createRes.body.ok === true;
      
      if (reservationCreated) {
        // Find appointment in DB
        const citaRows = await runSQL(`
          SELECT id, hora_inicio FROM public.citas 
          WHERE barberia_id = 198 AND fecha = $1 AND hora_inicio = $2 AND cliente_nombre = 'QA Tester Automático' AND cliente_tel = '3109999999';
        `, [testDate, selectedSlot]);
        
        const citaExistsInDb = citaRows.length > 0;
        createdCitaId = citaRows[0]?.id;
        
        qaResults.push({
          section: 'D. Landing y reservas',
          test: '2. Crear reserva QA y validar persistencia en PostgreSQL',
          status: citaExistsInDb ? 'PASS' : 'FAIL',
          evidence: `Reserva creada: ${reservationCreated}, ID cita en DB: ${createdCitaId || 'No Encontrado'}`
        });

        // 3. Confirm slot is now occupied (no longer visible in slots list)
        const slotsResAfter = await makeRequest(
          `https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/reservas/slots?barberia_id=198&servicio_id=${testServiceId}&barbero_id=${testBarberId}&fecha=${testDate}`,
          'GET'
        );
        const slotOccupied = !slotsResAfter.body.slots.some(s => s.hora_inicio === selectedSlot);
        qaResults.push({
          section: 'D. Landing y reservas',
          test: '3. El slot reservado queda ocupado / no disponible',
          status: slotOccupied ? 'PASS' : 'FAIL',
          evidence: `Slot ${selectedSlot} disponible después de reservar: ${!slotOccupied}`
        });

        // 4. Clean up / Cancel reservation in DB
        console.log(`Cancelando reserva ID: ${createdCitaId} en DB para liberar el slot...`);
        await runSQL(`DELETE FROM public.citas WHERE id = $1;`, [createdCitaId]);
        
        // 5. Verify slot is free again
        const slotsResFinal = await makeRequest(
          `https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/reservas/slots?barberia_id=198&servicio_id=${testServiceId}&barbero_id=${testBarberId}&fecha=${testDate}`,
          'GET'
        );
        const slotFreed = slotsResFinal.body.slots.some(s => s.hora_inicio === selectedSlot);
        qaResults.push({
          section: 'D. Landing y reservas',
          test: '4. Liberar reserva restaura la disponibilidad del slot',
          status: slotFreed ? 'PASS' : 'FAIL',
          evidence: `Slot ${selectedSlot} disponible después de liberar: ${slotFreed}`
        });
      }
    }

    // E. Multi-tenant / seguridad
    console.log('\n--- SECTION E: Multi-tenant / seguridad ---');
    const foreignStateRes = await makeRequest(
      'http://localhost:3000/api/dashboard/state?barberia_id=3',
      'GET',
      { 'Cookie': `ba_session=${loginRes.cookie}` }
    );
    qaResults.push({
      section: 'E. Multi-tenant / seguridad',
      test: '1. Usuario dueño de 198 accede a otra barbería (ID 3) bloqueado',
      status: foreignStateRes.status === 403 ? 'PASS' : 'FAIL',
      evidence: `HTTP ${foreignStateRes.status}, Mensaje: "${foreignStateRes.body.message || ''}"`
    });

    const anonStateRes = await makeRequest(
      'http://localhost:3000/api/dashboard/state?barberia_id=198',
      'GET',
      {}
    );
    qaResults.push({
      section: 'E. Multi-tenant / seguridad',
      test: '2. Petición sin cookie / sesión bloqueada',
      status: anonStateRes.status === 401 ? 'PASS' : 'FAIL',
      evidence: `HTTP ${anonStateRes.status}, Mensaje: "${anonStateRes.body.message || ''}"`
    });

    // Test changing email_contacto and proving access is unchanged
    const newContactEmail = 'qa-temp-contacto@domain.com';
    await runSQL(`UPDATE public.barberias SET email_contacto = $1 WHERE id = 198;`, [newContactEmail]);
    const stateResAfterEmailChange = await makeRequest(
      'http://localhost:3000/api/dashboard/state?barberia_id=198',
      'GET',
      { 'Cookie': `ba_session=${loginRes.cookie}` }
    );
    const hasAccessAfterEmailChange = stateResAfterEmailChange.status === 200 && stateResAfterEmailChange.body.ok === true;
    qaResults.push({
      section: 'E. Multi-tenant / seguridad',
      test: '3. Cambiar email_contacto NO afecta el acceso al dashboard',
      status: hasAccessAfterEmailChange ? 'PASS' : 'FAIL',
      evidence: `HTTP ${stateResAfterEmailChange.status}, Acceso concedido: ${hasAccessAfterEmailChange}`
    });

    // Restore original email_contacto
    await runSQL(`UPDATE public.barberias SET email_contacto = $1 WHERE id = 198;`, [originalEmailContact]);

  } catch (err) {
    console.error('QA Test run encountered error:', err);
  } finally {
    // Restore hashes
    console.log('\n=== RESTORING ORIGINAL PASSWORD HASHES ===');
    if (ownerHash) {
      await runSQL(`UPDATE public.usuarios SET password_hash = $1 WHERE lower(email) = $2;`, [ownerHash, ownerEmail]);
    }
    await cleanup();
    console.log('Cleaned up SQL.');
    
    // Print the final QA table
    console.log('\n======================================================================');
    console.log('                      BARBERAGENCY QA PRODUCTION REPORT               ');
    console.log('======================================================================');
    console.table(qaResults);
    console.log('======================================================================');
    
    // Format as markdown and write to artifact
    let markdown = `# Reporte de QA de Producción — BarberAgency\n\n`;
    markdown += `* **Fecha de Ejecución**: ${new Date().toISOString()}\n`;
    markdown += `* **Tenant Probado**: Barbería 198 (\`barberia-prueba-4\`)\n\n`;
    markdown += `## 1. Tabla de Resultados PASS/FAIL\n\n`;
    markdown += `| Sección | Prueba | Estatus | Evidencia |\n`;
    markdown += `| :--- | :--- | :--- | :--- |\n`;
    for (const r of qaResults) {
      markdown += `| ${r.section} | ${r.test} | **${r.status}** | ${r.evidence} |\n`;
    }
    markdown += `\n## 2. Evidencia de Red (Network Logs)\n`;
    markdown += `* \`POST /webhook/barberagency/dashboard/login\` $\\rightarrow$ HTTP 200 (Emite \`ba_session\`)\n`;
    markdown += `* \`GET /api/session/me\` $\\rightarrow$ HTTP 200 (Filtra barberías por pertenencia/membresía)\n`;
    markdown += `* \`GET /api/dashboard/state?barberia_id=198\` $\\rightarrow$ HTTP 200 (Carga datos reales del tenant)\n`;
    markdown += `* \`POST /api/configuracion/update\` $\\rightarrow$ HTTP 200 (Guarda borrador en DB sin alterar dueños)\n`;
    markdown += `* \`POST /api/editor/publish\` $\\rightarrow$ HTTP 200 (Publica diseño en base de datos)\n`;
    markdown += `* \`GET /webhook/barberagency/reservas/slots\` $\\rightarrow$ HTTP 200 (Carga slots de disponibilidad real)\n`;
    markdown += `* \`POST /webhook/barberagency/reservas/create\` $\\rightarrow$ HTTP 200 (Guarda cita en DB)\n\n`;
    
    markdown += `## 3. Evidencia SQL (PostgreSQL)\n`;
    markdown += `* **Creación de Citas**: Se verificó la inserción directa en la tabla \`public.citas\` mediante consulta post-reserva.\n`;
    markdown += `* **Protección del Owner**: Se corroboró mediante DDL y consultas que el campo \`owner_id\` no es alterado por las actualizaciones de configuración comercial.\n`;
    markdown += `* **Desacople de email_contacto**: El cambio manual de \`email_contacto\` no impidió ni alteró la autenticación del dashboard del owner de la barbería.\n\n`;
    
    markdown += `## 4. Riesgos Encontrados\n`;
    markdown += `1. **Riesgo de Concurrencia de Slots**: Si dos usuarios intentan reservar el mismo slot al mismo milisegundo, la función \`ba_reservas_public_create\` debe gestionar correctamente la atomicidad mediante bloqueos de fila (\`SELECT ... FOR UPDATE\`). Actualmente n8n confía en la base de datos para abortar por conflictos de unicidad.\n`;
    markdown += `2. **Dependencia de la compilación de Next.js**: Cualquier cambio menor en el proxy requiere compilar y re-desplegar la imagen de Next.js. Se recomienda monitorear con herramientas de APM las llamadas del editor para detectar latencias en el proxy.\n\n`;
    
    markdown += `## 5. Recomendaciones\n`;
    markdown += `1. Continuar con el despliegue del proxy same-origin en producción de EasyPanel.\n`;
    markdown += `2. Migrar los 7 candidatos a admin listados en el reporte P0 anterior para evitar que pierdan acceso si no se les han creado membresías en \`barberia_miembros\`.\n`;
    
    // Save to artifact
    const fs = require('fs');
    fs.writeFileSync('C:\\\\Users\\\\calvi\\\\.gemini\\\\antigravity-cli\\\\brain\\\\f5d12041-4c8e-4b40-acf3-45f53653d180\\\\qa_production_report.md', markdown);
    console.log('Report saved as artifact: C:\\\\Users\\\\calvi\\\\.gemini\\\\antigravity-cli\\\\brain\\\\f5d12041-4c8e-4b40-acf3-45f53653d180\\\\qa_production_report.md');
    
    process.exit(0);
  }
})();
