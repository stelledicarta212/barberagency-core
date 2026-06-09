const https = require('https');

const HOST = 'barberagency-n8n.gymh5g.easypanel.host';
const LOGIN_PATH = '/webhook/barberagency/dashboard/login';

function testLogin(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: HOST,
      port: 443,
      path: LOGIN_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
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
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

(async () => {
  console.log('=== TEST DIRECTO A N8N LOGIN ENDPOINT ===');
  try {
    const result = await testLogin({
      email: 'pildorasdeautomatizacion@gmail.com',
      password: 'contrasena_incorrecta_para_pruebas',
      barberia_id: 198,
      slug: 'barberia-prueba-4'
    });

    console.log('Status Code:', result.status);
    console.log('Headers:', JSON.stringify(result.headers, null, 2));
    console.log('Body:', JSON.stringify(result.body, null, 2));
  } catch (err) {
    console.error('Error in request:', err);
  }
})();
