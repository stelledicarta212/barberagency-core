const https = require('https');
const db = require('./run_postgres_query.js');

function makeRequest(url, method, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);

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
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log('=== STARTING TEST FOR RESERVA CREATE CANONICAL RESPONSE ===');
  try {
    await db.setup();

    // 1. Get active service and barber for barberia 198
    const serviceRows = await db.runSQL(`SELECT id, nombre, duracion_min, precio FROM public.servicios WHERE barberia_id = 198 AND activo = true LIMIT 1;`);
    const barberRows = await db.runSQL(`SELECT id, nombre FROM public.barberos WHERE barberia_id = 198 AND activo = true LIMIT 1;`);

    if (serviceRows.length === 0 || barberRows.length === 0) {
      throw new Error('No active service or barber found for barberia 198.');
    }

    const testService = serviceRows[0];
    const testBarber = barberRows[0];
    console.log(`Using Service: ${testService.nombre} (${testService.id})`);
    console.log(`Using Barber: ${testBarber.nombre} (${testBarber.id})`);

    // We will pick a date next week to make sure we don't conflict or have slot issues
    const testDate = '2026-06-25'; // A future date
    console.log(`Testing with date: ${testDate}`);

    // 2. Query available slots
    const slotsUrl = `https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/reservas/slots?barberia_id=198&servicio_id=${testService.id}&barbero_id=${testBarber.id}&fecha=${testDate}`;
    console.log(`Fetching slots from: ${slotsUrl}`);
    const slotsRes = await makeRequest(slotsUrl, 'GET');

    if (slotsRes.status !== 200 || !slotsRes.body.ok || !Array.isArray(slotsRes.body.slots) || slotsRes.body.slots.length === 0) {
      console.log('Slots response:', JSON.stringify(slotsRes.body, null, 2));
      throw new Error(`Could not get available slots for date ${testDate}`);
    }

    const selectedSlot = slotsRes.body.slots[0].hora_inicio;
    console.log(`Selected slot: ${selectedSlot}`);

    // 3. Create the reservation
    const createUrl = 'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/reservas/create';
    const payload = {
      barberia_id: 198,
      slug: 'barberia-prueba-4',
      servicio_id: testService.id,
      barbero_id: testBarber.id,
      fecha: testDate,
      hora_inicio: selectedSlot,
      cliente_nombre: 'QA Test Antigravity',
      cliente_tel: '3108888888',
      cliente_email: 'antigravity-qa@barberagency.com',
      notas: 'Prueba de respuesta canonica de reservas/create'
    };

    console.log(`Sending reservation create request to: ${createUrl}`);
    const createRes = await makeRequest(createUrl, 'POST', {}, payload);

    console.log(`Response Status: ${createRes.status}`);
    console.log('Response Body:', JSON.stringify(createRes.body, null, 2));

    // 4. Assertions on the canonical response
    if (createRes.status !== 200) {
      throw new Error(`Failed to create reservation: HTTP ${createRes.status}`);
    }

    const resBody = createRes.body;
    if (resBody.ok !== true) {
      throw new Error('Response "ok" field is not true');
    }

    const cita = resBody.cita_confirmada;
    if (!cita) {
      throw new Error('Response does not contain "cita_confirmada"');
    }

    // Check critical fields
    if (typeof cita.cita_id !== 'number' || cita.cita_id <= 0) {
      throw new Error(`Invalid cita_id: ${cita.cita_id}`);
    }
    if (cita.barberia_id !== 198) {
      throw new Error(`Invalid barberia_id: expected 198, got ${cita.barberia_id}`);
    }
    if (cita.slug !== 'barberia-prueba-4') {
      throw new Error(`Invalid slug: expected barberia-prueba-4, got ${cita.slug}`);
    }
    if (cita.cliente_nombre !== 'QA Test Antigravity') {
      throw new Error(`Invalid cliente_nombre: expected QA Test Antigravity, got ${cita.cliente_nombre}`);
    }
    if (cita.cliente_tel !== '3108888888') {
      throw new Error(`Invalid cliente_tel: expected 3108888888, got ${cita.cliente_tel}`);
    }
    if (cita.fecha !== testDate) {
      throw new Error(`Invalid fecha: expected ${testDate}, got ${cita.fecha}`);
    }
    if (cita.hora_inicio !== selectedSlot) {
      throw new Error(`Invalid hora_inicio: expected ${selectedSlot}, got ${cita.hora_inicio}`);
    }

    // Verify service object
    if (!cita.servicio || cita.servicio.id !== testService.id || cita.servicio.nombre !== testService.nombre || Number(cita.servicio.precio) !== Number(testService.precio) || cita.servicio.duracion_min !== testService.duracion_min) {
      throw new Error(`Invalid service details: ${JSON.stringify(cita.servicio)}`);
    }

    // Verify barbero object
    if (!cita.barbero || cita.barbero.id !== testBarber.id || cita.barbero.nombre !== testBarber.nombre) {
      throw new Error(`Invalid barbero details: ${JSON.stringify(cita.barbero)}`);
    }

    // Verify barberia object
    const expectedBarberiaNombre = 'Barberia Prueba 4';
    const expectedBarberiaDireccion = 'Calle 131#101-10';
    const expectedBarberiaCiudad = 'Bogota';
    const expectedMapsUrl = 'https://www.google.com/maps?q=Calle%20131%23101-10&output=embed';

    if (!cita.barberia || cita.barberia.nombre !== expectedBarberiaNombre || cita.barberia.direccion !== expectedBarberiaDireccion || cita.barberia.ciudad !== expectedBarberiaCiudad || cita.barberia.maps_url !== expectedMapsUrl) {
      throw new Error(`Invalid barberia details: ${JSON.stringify(cita.barberia)}`);
    }

    console.log('✅ CANONICAL RESPONSE FORMAT AND CONTENT VALIDATED SUCCESSFULLY!');

    // 5. Verify database matches
    console.log(`Verifying in DB that cita_id ${cita.cita_id} exists...`);
    const dbCitaRows = await db.runSQL(`SELECT id, cliente_nombre, estado FROM public.citas WHERE id = $1;`, [cita.cita_id]);
    if (dbCitaRows.length === 0) {
      throw new Error(`Cita ID ${cita.cita_id} not found in database after create!`);
    }
    console.log(`✅ Appointment found in DB. Name: ${dbCitaRows[0].cliente_nombre}, Status: ${dbCitaRows[0].estado}`);

    // 6. Clean up the QA booking
    console.log(`Cleaning up: Deleting QA Cita ID ${cita.cita_id} from database...`);
    await db.runSQL(`DELETE FROM public.citas WHERE id = $1;`, [cita.cita_id]);
    console.log('✅ QA appointment successfully cleaned up from DB!');

  } catch (e) {
    console.error('❌ TEST FAILED:', e.message);
    process.exit(1);
  } finally {
    await db.cleanup();
  }
})();
