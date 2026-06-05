const https = require('https');
const crypto = require('crypto');
const { setup, cleanup, runSQL } = require('./run_postgres_query');

const SECRET = 'mi_super_secret_jwt_barberia_2026';
const WEBHOOK_URL = '/webhook/barberagency/dashboard/publicar';

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  return `${signatureInput}.${signature}`;
}

function makeRequest(payload, cookieValue = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: WEBHOOK_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    if (cookieValue) {
      options.headers['Cookie'] = `ba_session=${cookieValue}`;
    }

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
    r.write(data);
    r.end();
  });
}

function makeDirectRpcRequest(payload, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'api.agencia2c.cloud',
      port: 443,
      path: '/rpc/ba_publicar_barberia',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

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
    r.write(data);
    r.end();
  });
}

(async () => {
  console.log('--- STARTING SECURE PUBLISHING VERIFICATION TESTS ---');
  try {
    await setup();

    // 1. Establish test baseline
    // Ensure we have two barberias owned by different users
    const barberias = await runSQL(`
      SELECT id, owner_id, slug, nombre, publicada
      FROM public.barberias
      WHERE deleted_at IS NULL AND owner_id IS NOT NULL
      ORDER BY id;
    `);

    console.log('Barberias available:', JSON.stringify(barberias, null, 2));

    const b1 = barberias.find(b => b.owner_id === 1);
    const b2 = barberias.find(b => b.owner_id !== 1);

    if (!b1 || !b2) {
      throw new Error('Test baseline requires at least one barberia owned by user 1 and one owned by a different user.');
    }

    console.log(`Baseline Selected:`);
    console.log(`- Barberia own by User 1: ID ${b1.id}, Slug: "${b1.slug}", Owner: ${b1.owner_id}`);
    console.log(`- Barberia own by User B: ID ${b2.id}, Slug: "${b2.slug}", Owner: ${b2.owner_id}`);

    // Ensure Barberia 1 has at least 1 service and 1 barber active to pass DDL constraints
    await runSQL(`
      INSERT INTO public.servicios (barberia_id, nombre, precio, duracion_min, activo)
      VALUES ($1, 'Servicio Test de Publicacion', 15000, 30, true)
      ON CONFLICT DO NOTHING;
    `, [b1.id]);

    await runSQL(`
      INSERT INTO public.barberos (barberia_id, nombre, activo)
      VALUES ($1, 'Barbero Test de Publicacion', true)
      ON CONFLICT DO NOTHING;
    `, [b1.id]);

    const tokenUser1 = signJWT({ user_id: 1, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
    const tokenUser2 = signJWT({ user_id: b2.owner_id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);
    const tokenAnonPostgrest = signJWT({ role: 'anon', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET);

    const testResults = [];

    // --- TEST A: Without Cookie ---
    console.log('\n--- TEST A: Webhook call without session cookie (Expected 401) ---');
    const resA = await makeRequest({ p_barberia_id: b1.id });
    console.log('Status:', resA.status, 'Body:', JSON.stringify(resA.body));
    testResults.push({
      name: 'TEST A: Webhook call without session cookie',
      expectedStatus: 401,
      actualStatus: resA.status,
      ok: resA.status === 401 && resA.body.ok === false
    });

    // --- TEST B: Valid Cookie Owner of Barberia ---
    console.log('\n--- TEST B: Webhook call with valid cookie of owner (Expected 200) ---');
    // First let's unpublish it so we can test the publishing action
    await runSQL('UPDATE public.barberias SET publicada = false WHERE id = $1', [b1.id]);
    const resB = await makeRequest({ p_barberia_id: b1.id }, tokenUser1);
    console.log('Status:', resB.status, 'Body:', JSON.stringify(resB.body));
    testResults.push({
      name: 'TEST B: Webhook call with valid cookie of owner',
      expectedStatus: 200,
      actualStatus: resB.status,
      ok: resB.status === 200 && resB.body.ok === true && resB.body.slug !== undefined
    });

    // --- TEST C: Valid Cookie but trying to publish foreign Barberia ---
    console.log('\n--- TEST C: Webhook call trying to publish foreign barberia (Expected 403) ---');
    const resC = await makeRequest({ p_barberia_id: b2.id }, tokenUser1);
    console.log('Status:', resC.status, 'Body:', JSON.stringify(resC.body));
    testResults.push({
      name: 'TEST C: Webhook call trying to publish foreign barberia',
      expectedStatus: 403,
      actualStatus: resC.status,
      ok: resC.status === 403 && resC.body.ok === false && resC.body.error === 'no_autorizado_barberia_ajena'
    });

    // --- TEST D: Direct PostgREST RPC call (anon role execution) ---
    console.log('\n--- TEST D: Direct PostgREST call without authorization (Expected 401/403/Forbidden) ---');
    const resD = await makeDirectRpcRequest({ p_barberia_id: b1.id });
    console.log('Status:', resD.status, 'Body:', JSON.stringify(resD.body));
    // Since anon execution has been revoked, PostgREST must return 401 or 403 / "permission denied"
    testResults.push({
      name: 'TEST D: Direct PostgREST call without authorization',
      expectedStatus: [401, 403],
      actualStatus: resD.status,
      ok: [401, 403].includes(resD.status)
    });

    // --- TEST E: Direct PostgREST RPC call with anon JWT (Expected 401/403/Forbidden) ---
    console.log('\n--- TEST E: Direct PostgREST call with anon JWT (Expected 401/403/Forbidden) ---');
    const resE = await makeDirectRpcRequest({ p_barberia_id: b1.id }, tokenAnonPostgrest);
    console.log('Status:', resE.status, 'Body:', JSON.stringify(resE.body));
    testResults.push({
      name: 'TEST E: Direct PostgREST call with anon JWT',
      expectedStatus: [401, 403],
      actualStatus: resE.status,
      ok: [401, 403].includes(resE.status)
    });

    // --- TEST F: Direct PostgREST RPC call with authenticated JWT of owner (Expected 200 since execution granted to authenticated) ---
    console.log('\n--- TEST F: Direct PostgREST call with authenticated JWT of owner (Expected 200) ---');
    // Unpublish first
    await runSQL('UPDATE public.barberias SET publicada = false WHERE id = $1', [b1.id]);
    const resF = await makeDirectRpcRequest({ p_barberia_id: b1.id }, tokenUser1);
    console.log('Status:', resF.status, 'Body:', JSON.stringify(resF.body));
    testResults.push({
      name: 'TEST F: Direct PostgREST call with authenticated JWT of owner',
      expectedStatus: 200,
      actualStatus: resF.status,
      ok: resF.status === 200 && resF.body.ok === true
    });

    // --- TEST G: Direct PostgREST RPC call with authenticated JWT of another user (Expected 200 with error property) ---
    console.log('\n--- TEST G: Direct PostgREST call with authenticated JWT of non-owner (Expected 200 with error property) ---');
    const resG = await makeDirectRpcRequest({ p_barberia_id: b2.id }, tokenUser1);
    console.log('Status:', resG.status, 'Body:', JSON.stringify(resG.body));
    testResults.push({
      name: 'TEST G: Direct PostgREST call with authenticated JWT of non-owner',
      expectedStatus: 200,
      actualStatus: resG.status,
      ok: resG.status === 200 && resG.body.ok === false && resG.body.error === 'no_autorizado_barberia_ajena'
    });

    // Print SQL Evidence requested
    console.log('\n--- CAPTURING SQL EVIDENCE ---');
    console.log('Evidence 1: Procedure Definitions');
    const pgProc = await runSQL(`
      SELECT proname, prosecdef
      FROM pg_proc
      WHERE proname = 'ba_publicar_barberia';
    `);
    console.log(JSON.stringify(pgProc, null, 2));

    console.log('\nEvidence 2: Routine Privileges');
    const routinePrivs = await runSQL(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE routine_name = 'ba_publicar_barberia' AND routine_schema = 'public';
    `);
    console.log(JSON.stringify(routinePrivs, null, 2));

    console.log(`\nEvidence 3: Barberia ID ${b1.id} after publication`);
    const bDetails = await runSQL(`
      SELECT id, owner_id, slug, publicada, published_at
      FROM public.barberias
      WHERE id = $1;
    `, [b1.id]);
    console.log(JSON.stringify(bDetails, null, 2));

    console.log(`\nEvidence 4: Public profile details for Barberia ID ${b1.id}`);
    const profileDetails = await runSQL(`
      SELECT barberia_id, slug, public_landing_url, reservation_url, qr_url
      FROM public.barberia_public_profiles
      WHERE barberia_id = $1;
    `, [b1.id]);
    console.log(JSON.stringify(profileDetails, null, 2));

    // Summary of tests
    console.log('\n--- VERIFICATION TEST SUMMARY ---');
    let allPassed = true;
    for (const test of testResults) {
      console.log(`[${test.ok ? 'PASS' : 'FAIL'}] ${test.name} (Expected: ${JSON.stringify(test.expectedStatus)}, Got: ${test.actualStatus})`);
      if (!test.ok) allPassed = false;
    }

    if (allPassed) {
      console.log('\n🎉 ALL SECURITY VERIFICATION TESTS PASSED SUCCESSFULLY! MULTI-TENANT BYPASS MITIGATED.');
    } else {
      console.error('\n❌ SOME VERIFICATION TESTS FAILED.');
      process.exit(1);
    }

  } catch (err) {
    console.error('Error during testing:', err);
    process.exit(1);
  } finally {
    await cleanup();
  }
})();
