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
      headers: {
        ...headers
      }
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
    console.log(`Temporary Hash set successfully: ${tempHash}`);

    // Let's run a quick verify query to make sure it is updated
    const verifyRows = await runSQL(`SELECT public.fn_password_verify($1, password_hash) as ok FROM public.usuarios WHERE lower(email) = $2;`, [tempPassword, email]);
    console.log('Database verification of temporary password:', verifyRows[0]?.ok ? 'SUCCESS' : 'FAILED');

    if (!verifyRows[0]?.ok) {
      throw new Error('Database failed to verify the temporary password hash!');
    }

    // 3. Perform Test A: Login direct to n8n
    console.log('\n==================================================');
    console.log('TEST A: Login directo contra n8n');
    console.log('==================================================');
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
    console.log('Status Code A:', resA.status);
    console.log('Headers A:', JSON.stringify(resA.headers, null, 2));
    console.log('Body A:', JSON.stringify(resA.body, null, 2));

    let n8nCookie = '';
    if (resA.headers['set-cookie']) {
      const setCookie = Array.isArray(resA.headers['set-cookie']) 
        ? resA.headers['set-cookie'][0] 
        : resA.headers['set-cookie'];
      const match = setCookie.match(/(?:^|;)\s*ba_session=([^;]+)/);
      if (match) n8nCookie = match[1];
    }
    console.log('Extracted ba_session cookie from A:', n8nCookie ? 'FOUND' : 'NOT FOUND');

    // 4. Perform Test B: session/me direct to n8n using captured cookie
    console.log('\n==================================================');
    console.log('TEST B: session/me directo contra n8n');
    console.log('==================================================');
    if (n8nCookie) {
      const resB = await makeRequest(
        'https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/session/me',
        'GET',
        {
          'Cookie': `ba_session=${n8nCookie}`
        }
      );
      console.log('Status Code B:', resB.status);
      console.log('Headers B:', JSON.stringify(resB.headers, null, 2));
      console.log('Body B:', JSON.stringify(resB.body, null, 2));
    } else {
      console.log('Skipping Test B: No cookie was returned in Test A');
    }

    // 5. Perform Test C (Local): Local Proxy Next login
    console.log('\n==================================================');
    console.log('TEST C (Local): Local Proxy Next login (localhost:3000)');
    console.log('==================================================');
    const proxyPayload = {
      email,
      password: tempPassword,
      barberia_id: 198,
      slug: 'barberia-prueba-4'
    };
    const resCLocal = await makeRequest(
      'http://localhost:3000/api/session/login',
      'POST',
      {},
      proxyPayload
    );
    console.log('Status Code C (Local):', resCLocal.status);
    console.log('Headers C (Local):', JSON.stringify(resCLocal.headers, null, 2));
    console.log('Body C (Local):', JSON.stringify(resCLocal.body, null, 2));

    let proxyCookieLocal = '';
    if (resCLocal.headers['set-cookie']) {
      const setCookie = Array.isArray(resCLocal.headers['set-cookie']) 
        ? resCLocal.headers['set-cookie'][0] 
        : resCLocal.headers['set-cookie'];
      const match = setCookie.match(/(?:^|;)\s*ba_session=([^;]+)/);
      if (match) proxyCookieLocal = match[1];
    }
    console.log('Extracted ba_session cookie from C (Local):', proxyCookieLocal ? 'FOUND' : 'NOT FOUND');

    // 6. Perform Test D (Local): Local Proxy session/me
    console.log('\n==================================================');
    console.log('TEST D (Local): Local Proxy session/me (localhost:3000)');
    console.log('==================================================');
    if (proxyCookieLocal) {
      const resDLocal = await makeRequest(
        'http://localhost:3000/api/session/me',
        'GET',
        {
          'Cookie': `ba_session=${proxyCookieLocal}`
        }
      );
      console.log('Status Code D (Local):', resDLocal.status);
      console.log('Headers D (Local):', JSON.stringify(resDLocal.headers, null, 2));
      console.log('Body D (Local):', JSON.stringify(resDLocal.body, null, 2));
    } else {
      console.log('Skipping Test D (Local): No cookie was returned in Test C (Local)');
    }

    // 7. Perform Test C (Remote): Remote Proxy Next login
    console.log('\n==================================================');
    console.log('TEST C (Remote): Remote Proxy Next login (panel)');
    console.log('==================================================');
    const resCRemote = await makeRequest(
      'https://panel-de-barberia.gymh5g.easypanel.host/api/session/login',
      'POST',
      {},
      proxyPayload
    );
    console.log('Status Code C (Remote):', resCRemote.status);
    console.log('Headers C (Remote):', JSON.stringify(resCRemote.headers, null, 2));
    console.log('Body C (Remote):', JSON.stringify(resCRemote.body, null, 2));

  } catch (err) {
    console.error('An error occurred during execution:', err);
  } finally {
    // 8. RESTORE original hash
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
