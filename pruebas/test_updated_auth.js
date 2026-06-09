const { setup, cleanup, runSQL } = require('./run_postgres_query');
const https = require('https');
const http = require('http');

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
  let ownerHash = null;
  let adminHash = null;
  const ownerEmail = 'pildorasdeautomatizacion@gmail.com';
  const adminEmail = 'calvis590@gmail.com';
  const tempPassword = 'temp_password_123';

  try {
    await setup();
    console.log('=== PREPARING TEST ENVIRONMENT ===');
    
    // Backup hashes
    const ownerRows = await runSQL(`SELECT password_hash FROM public.usuarios WHERE lower(email) = $1;`, [ownerEmail]);
    ownerHash = ownerRows[0]?.password_hash;
    const adminRows = await runSQL(`SELECT password_hash FROM public.usuarios WHERE lower(email) = $1;`, [adminEmail]);
    adminHash = adminRows[0]?.password_hash;

    // Set temp passwords
    const tempHashRows = await runSQL(`SELECT crypt($1, gen_salt('bf', 8)) as new_hash;`, [tempPassword]);
    const tempHash = tempHashRows[0].new_hash;
    await runSQL(`UPDATE public.usuarios SET password_hash = $1 WHERE lower(email) = $2;`, [tempHash, ownerEmail]);
    await runSQL(`UPDATE public.usuarios SET password_hash = $1 WHERE lower(email) = $2;`, [tempHash, adminEmail]);

    console.log('\n================ TEST A: OWNER ACCESS ================');
    const ownerLogin = await loginAndGetCookie(ownerEmail, tempPassword);
    console.log('Owner Login Status:', ownerLogin.status);
    console.log('Owner Login Cookie:', ownerLogin.cookie ? 'EMITTED' : 'MISSING');
    console.log('Owner Login Body:', JSON.stringify(ownerLogin.body, null, 2));

    const ownerState = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/state?barberia_id=198',
      'GET',
      { 'Cookie': `ba_session=${ownerLogin.cookie}` }
    );
    console.log('Owner State Status:', ownerState.status);
    console.log('Owner State ok:', ownerState.body.ok);

    console.log('\n================ TEST B: MEMBER ADMIN ACCESS ================');
    const adminLogin = await loginAndGetCookie(adminEmail, tempPassword);
    console.log('Admin Login Status:', adminLogin.status);
    console.log('Admin Login Cookie:', adminLogin.cookie ? 'EMITTED' : 'MISSING');
    console.log('Admin Login Body (trimmed):', JSON.stringify({ ok: adminLogin.body.ok, status: adminLogin.body.status, message: adminLogin.body.message }, null, 2));

    const adminState = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/state?barberia_id=198',
      'GET',
      { 'Cookie': `ba_session=${adminLogin.cookie}` }
    );
    console.log('Admin State Status:', adminState.status);
    console.log('Admin State ok:', adminState.body.ok);

    console.log('\n================ TEST C: NON-MEMBER ACCESS ================');
    const unauthorizedState = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/state?barberia_id=3',
      'GET',
      { 'Cookie': `ba_session=${adminLogin.cookie}` }
    );
    console.log('Non-member State Status (expected 403):', unauthorizedState.status);
    console.log('Non-member State Body:', JSON.stringify(unauthorizedState.body, null, 2));

    console.log('\n================ TEST D: UNAUTHORIZED / NO SESSION ================');
    const noSessionMe = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/session/me',
      'GET',
      {}
    );
    console.log('No Session Session-Me Status (expected 401):', noSessionMe.status);

    const noSessionState = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/state?barberia_id=198',
      'GET',
      {}
    );
    console.log('No Session State Status (expected 401):', noSessionState.status);

    console.log('\n================ TEST G: SESSION ME BARBERIAS LIST ================');
    const adminSessionMe = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/session/me',
      'GET',
      { 'Cookie': `ba_session=${adminLogin.cookie}` }
    );
    console.log('Admin Session-Me Status:', adminSessionMe.status);
    const included = adminSessionMe.body.barberias.some(b => b.id === 198);
    console.log('Is Barberia 198 included in admin list (expected true):', included);
    console.log('Admin authorized barberias count:', adminSessionMe.body.barberias_count);

    console.log('\n================ TEST E & H: CONFIG UPDATE & EMAIL_CONTACTO CHANGE ================');
    // Modify email_contacto to a dummy email to prove access does not depend on email_contacto
    const newContactEmail = 'test-contacto-cambiado@barberagency.com';
    console.log(`Updating email_contacto to: ${newContactEmail}...`);
    
    // Build update payload
    const updatePayload = {
      mode: 'edit',
      barberia_id: 198,
      slug: 'barberia-prueba-4',
      draft: {
        barberia: {
          id: 198,
          nombre: 'Barberia Prueba 4',
          slug: 'barberia-prueba-4',
          telefono: '3106974573',
          direccion: 'Calle 131#101-10',
          ciudad: 'Bogota',
          politicas: 'QA_P0_CONFIG_UPDATE_TEST',
          slot_min: 30
        },
        servicios: [
          { nombre: 'Corte Clasico', duracion_min: 30, precio: 20000 },
          { nombre: 'Barba', duracion_min: 30, precio: 12000 }
        ],
        barberos: [
          { id: 439, usuario_id: 6, nombre: 'Barbero prueba 4', activo: true },
          { id: 440, usuario_id: 256, nombre: 'Barbero Prueba 4.1', activo: true }
        ],
        horarios: [
          { dia_semana: 1, activo: true, hora_abre: '08:00', hora_cierra: '20:30' }
        ],
        accesos: {
          admin: {
            nombre: 'Carlos Alvis',
            email: 'pildorasdeautomatizacion@gmail.com' // email_contacto destination
          }
        }
      }
    };

    // First update database email_contacto manually to newContactEmail to verify admin still has access
    await runSQL(`UPDATE public.barberias SET email_contacto = $1 WHERE id = 198;`, [newContactEmail]);
    console.log('Database email_contacto manually updated to:', newContactEmail);

    // Verify admin calvis590@gmail.com still has access to dashboard/state!
    const adminStateAfterEmailChange = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/state?barberia_id=198',
      'GET',
      { 'Cookie': `ba_session=${adminLogin.cookie}` }
    );
    console.log('Admin State Status after contact email change (expected 200):', adminStateAfterEmailChange.status);
    console.log('Admin State ok after change:', adminStateAfterEmailChange.body.ok);

    // Restore correct email_contacto via config/update using admin's cookie (Test permission propagation)
    console.log('Sending config update via admin session...');
    const updateRes = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/configuracion/update',
      'POST',
      { 'Cookie': `ba_session=${adminLogin.cookie}` },
      updatePayload
    );
    console.log('Config Update Status:', updateRes.status);
    console.log('Config Update Response Code:', updateRes.body.code);

    // Verify email_contacto restored in db
    const finalDbBarberia = await runSQL(`SELECT email_contacto, owner_id FROM public.barberias WHERE id = 198;`);
    console.log('Final email_contacto in DB:', finalDbBarberia[0]?.email_contacto);
    console.log('Final owner_id in DB (expected 7):', finalDbBarberia[0]?.owner_id);

  } catch (err) {
    console.error('An error occurred:', err);
  } finally {
    // Restore hashes
    console.log('\n=== RESTORING ORIGINAL PASSWORD HASHES ===');
    if (ownerHash) {
      await runSQL(`UPDATE public.usuarios SET password_hash = $1 WHERE lower(email) = $2;`, [ownerHash, ownerEmail]);
    }
    if (adminHash) {
      await runSQL(`UPDATE public.usuarios SET password_hash = $1 WHERE lower(email) = $2;`, [adminHash, adminEmail]);
    }
    await cleanup();
    console.log('Cleaned up.');
  }
})();
