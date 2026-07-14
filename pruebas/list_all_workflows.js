const https = require('https');

const token = process.env.N8N_API_KEY;
if (!token) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = { 
      hostname: 'barberagency-n8n.gymh5g.easypanel.host', 
      path, 
      method, 
      headers: { 'X-N8N-API-KEY': token, 'Content-Type': 'application/json' } 
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const r = https.request(options, (res) => {
      let raw = ''; 
      res.on('data', c => raw += c); 
      res.on('end', () => { 
        let parsed; 
        try { parsed = raw ? JSON.parse(raw) : {} } catch { parsed = { raw } };
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed); 
        else reject(new Error(`HTTP ${res.statusCode}: ${raw}`)); 
      });
    });
    r.on('error', reject); 
    if (data) r.write(data); 
    r.end();
  });
}

(async () => {
  try {
    const wfs = await req('GET', '/api/v1/workflows');
    console.log('Workflows list:');
    wfs.data.forEach(wf => {
      console.log(`- [${wf.id}] ${wf.name} (Active: ${wf.active})`);
    });
  } catch (err) {
    console.error(err);
  }
})();
