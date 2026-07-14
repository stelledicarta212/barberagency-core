const https = require('https');

const token = process.env.N8N_API_KEY;
if (!token) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}

function req(method, apiPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: apiPath,
      method,
      headers: {
        'X-N8N-API-KEY': token,
        'Content-Type': 'application/json'
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
        resolve(parsed);
      });
    });
    r.on('error', reject);
    r.end();
  });
}

(async () => {
  try {
    const exec = await req('GET', '/api/v1/executions/445330');
    console.log('Execution keys:', Object.keys(exec));
    console.log('Full JSON response:');
    console.log(JSON.stringify(exec, null, 2));
  } catch (e) {
    console.error(e);
  }
})();
