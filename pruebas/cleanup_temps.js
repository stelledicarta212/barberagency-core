const https = require('https');

const token = process.env.N8N_API_KEY;
if (!token) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}

function req(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
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
        resolve(parsed);
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log('Cleaning up temporary workflows in n8n...');
  const res = await req('GET', '/api/v1/workflows');
  if (!res.data) {
    console.log('No workflows found or failed to fetch.');
    return;
  }
  for (const w of res.data) {
    if (w.name.includes('Temp') || w.name.includes('temp') || w.name.includes('Temp Postgres Exec Webhook')) {
      console.log(`Deactivating & Deleting temp workflow ID: ${w.id}, Name: "${w.name}"`);
      await req('POST', `/api/v1/workflows/${w.id}/deactivate`);
      await req('DELETE', `/api/v1/workflows/${w.id}`);
    }
  }
  console.log('Cleanup finished.');
})();
