const https = require('https');
const fs = require('fs');
const path = require('path');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZWRlNzUwOC05OTdhLTQ0NzUtYjJiOC05YmUyZTNhNmE0MTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWQ4MDYyMDAtNWM4Ni00ZDQ1LWIyM2ItZDEyYzc2MmMwMGEyIiwiaWF0IjoxNzc1OTIxODk4fQ.S-gQd2FKYczqgzSIqxLv3tWTkS4mJk-lvt0DMAtmfKY';
const HOST = 'barberagency-n8n.gymh5g.easypanel.host';
const workflowId = 'bl8JLdC5VOsC9zdu';

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
  console.log(`\n================ DEPLOYING RESERVAS SAVE WORKFLOW (${workflowId}) ================`);
  const filename = 'reservas_save_workflow.json';
  const filePath = path.join(__dirname, filename);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filename}`);
    process.exit(1);
  }

  try {
    const wf = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // 1. Deactivate
    console.log('Deactivating workflow...');
    await req('POST', `/api/v1/workflows/${workflowId}/deactivate`).catch(e => {
      console.log('Deactivation warning (might already be inactive):', e.message);
    });

    // 2. Update via PUT
    console.log('Updating workflow definition...');
    const payload = {
      name: wf.name || 'BarberAgency - Reservas Save v1',
      nodes: wf.nodes,
      connections: wf.connections,
      settings: {}
    };
    await req('PUT', `/api/v1/workflows/${workflowId}`, payload);

    // 3. Reactivate
    console.log('Reactivating workflow...');
    await req('POST', `/api/v1/workflows/${workflowId}/activate`);

    console.log(`Successfully deployed reservas_save_workflow! 🎉`);

  } catch (e) {
    console.error(`Failed to deploy:`, e.message);
  }
})();
