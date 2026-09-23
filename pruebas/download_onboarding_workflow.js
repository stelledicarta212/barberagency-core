const https = require('https');
const fs = require('fs');

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const token = process.env.N8N_API_KEY;
const workflowId = 'LsvB2cGDxvNTSL28';

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
    const wf = await req('GET', `/api/v1/workflows/${workflowId}`);
    fs.writeFileSync('pruebas/onboarding_workflow_LsvB2cGDxvNTSL28.json', JSON.stringify(wf, null, 2));
    console.log('Onboarding workflow downloaded successfully to pruebas/onboarding_workflow_LsvB2cGDxvNTSL28.json');
  } catch (err) {
    console.error(err);
  }
})();
