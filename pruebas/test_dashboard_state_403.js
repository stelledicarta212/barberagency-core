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

(async () => {
  let originalHash = null;
  const email = 'calvis590@gmail.com';
  const tempPassword = 'temp_password_123';

  try {
    // 1. Setup DB and backup hash
    await setup();
    console.log('--- BACKING UP PASSWORD HASH ---');
    const userRows = await runSQL(`SELECT password_hash FROM public.usuarios WHERE lower(email) = $1;`, [email]);
    if (userRows.length === 0) {
      throw new Error(`User ${email} not found in database!`);
    }
    originalHash = userRows[0].password_hash;
    console.log(`Original Hash for ${email}: ${originalHash}`);

    // 2. Set temporary password hash for 'temp_password_123'
    console.log('--- SETTING TEMPORARY PASSWORD HASH ---');
    const tempHashRows = await runSQL(`SELECT crypt($1, gen_salt('bf', 8)) as new_hash;`, [tempPassword]);
    const tempHash = tempHashRows[0].new_hash;
    await runSQL(`UPDATE public.usuarios SET password_hash = $1 WHERE lower(email) = $2;`, [tempHash, email]);

    // 3. Login to get cookie
    console.log('\n--- LOGGING IN DIRECT TO N8N ---');
    const loginPayload = {
      email,
      password: tempPassword,
      barberia_id: 198,
      slug: 'barberia-prueba-4',
      identity: {
        barberia_id: 198,
        slug: 'barberia-prueba-4'
      }
    };
    const resA = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/login',
      'POST',
      {},
      loginPayload
    );
    console.log('Login Status:', resA.status);
    let n8nCookie = '';
    if (resA.headers['set-cookie']) {
      const setCookie = Array.isArray(resA.headers['set-cookie']) 
        ? resA.headers['set-cookie'][0] 
        : resA.headers['set-cookie'];
      const match = setCookie.match(/(?:^|;)\s*ba_session=([^;]+)/);
      if (match) n8nCookie = match[1];
    }
    console.log('Extracted ba_session cookie:', n8nCookie ? 'FOUND' : 'NOT FOUND');

    if (!n8nCookie) {
      throw new Error('No cookie returned from login!');
    }

    // 4. Request session/me
    console.log('\n--- GETTING session/me ---');
    const resMe = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/session/me',
      'GET',
      { 'Cookie': `ba_session=${n8nCookie}` }
    );
    console.log('session/me Status:', resMe.status);
    console.log('session/me Body:', JSON.stringify(resMe.body, null, 2));

    // 5. Request dashboard/state?barberia_id=198
    console.log('\n--- GETTING dashboard/state?barberia_id=198 ---');
    const resState = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/state?barberia_id=198',
      'GET',
      { 'Cookie': `ba_session=${n8nCookie}` }
    );
    console.log('dashboard/state Status for 198:', resState.status);
    console.log('dashboard/state Body for 198 (truncated):', resState.body.ok ? 'OK = true' : JSON.stringify(resState.body, null, 2));

    // 6. Request dashboard/state?barberia_id=3 (unauthorized)
    console.log('\n--- GETTING dashboard/state?barberia_id=3 ---');
    const resState3 = await makeRequest(
      'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/state?barberia_id=3',
      'GET',
      { 'Cookie': `ba_session=${n8nCookie}` }
    );
    console.log('dashboard/state Status for 3:', resState3.status);
    console.log('dashboard/state Body for 3:', JSON.stringify(resState3.body, null, 2));

  } catch (err) {
    console.error('An error occurred during execution:', err);
  } finally {
    // Restore original hash
    if (originalHash) {
      console.log('\n--- RESTORING ORIGINAL PASSWORD HASH ---');
      try {
        await runSQL(`UPDATE public.usuarios SET password_hash = $1 WHERE lower(email) = $2;`, [originalHash, email]);
        console.log('Original hash successfully restored.');
      } catch (restoreErr) {
        console.error('CRITICAL ERROR: Failed to restore original password hash!', restoreErr);
      }
    }
    await cleanup();
  }
})();
