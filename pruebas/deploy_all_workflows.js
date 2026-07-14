const https = require('https');
const fs = require('fs');
const path = require('path');

const token = process.env.N8N_API_KEY;
if (!token) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}
const HOST = 'barberagency-n8n.gymh5g.easypanel.host';

const targetWorkflows = {
  login: 'oAQzjkGzCuCjT1EP',
  session_me: 'iUZCTRli7ghGFrEb',
  dashboard_state: '6JugRzxsOGKBvgWW',
  config_update: 'dB102yaMhaxNSGpK',
  barberos: 'h3JdyaI26GbRqrzE',
  citas: 'jRi8fOiFwBGziCX5',
  servicios: 'mYdeHfxzpWfOxYIv'
};

function req(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: HOST,
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
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
        }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  for (const [key, id] of Object.entries(targetWorkflows)) {
    console.log(`\n================ DEPLOYING ${key} (${id}) ================`);
    const filename = `${key}_workflow.json`;
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filename}`);
      continue;
    }

    try {
      const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      // 1. Deactivate
      console.log('Deactivating workflow...');
      await req('POST', `/api/v1/workflows/${id}/deactivate`).catch(e => {
        console.log('Deactivation warning (might already be inactive):', e.message);
      });

      // 2. Update via PUT
      console.log('Updating workflow definition...');
      const payload = {
        name: wf.name,
        nodes: wf.nodes,
        connections: wf.connections,
        settings: wf.settings || {}
      };
      await req('PUT', `/api/v1/workflows/${id}`, payload);

      // 3. Reactivate
      console.log('Reactivating workflow...');
      await req('POST', `/api/v1/workflows/${id}/activate`);

      console.log(`Successfully deployed ${key}! 🎉`);

    } catch (e) {
      console.error(`Failed to deploy ${key} (${id}):`, e.message);
    }
  }
  console.log('\nDeployment of all workflows completed.');
})();
