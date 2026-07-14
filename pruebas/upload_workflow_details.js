const https = require('https');
const fs = require('fs');
const path = require('path');

const token = process.env.N8N_API_KEY;
if (!token) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}
const workflowId = 'mYdeHfxzpWfOxYIv';

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
  try {
    console.log('Reading updated workflow JSON...');
    const rawWf = fs.readFileSync(path.join(__dirname, 'servicios_workflow_updated.json'), 'utf8');
    const updatedNodesAndConnections = JSON.parse(rawWf);

    console.log('Fetching current workflow settings...');
    const currentWf = await req('GET', `/api/v1/workflows/${workflowId}`);

    const payload = {
      name: currentWf.name,
      nodes: updatedNodesAndConnections.nodes,
      connections: updatedNodesAndConnections.connections,
      settings: currentWf.settings || {}
    };

    console.log('Uploading/updating workflow on n8n...');
    await req('PUT', `/api/v1/workflows/${workflowId}`, payload);
    console.log('Workflow uploaded successfully.');

    console.log('Deactivating workflow...');
    await req('POST', `/api/v1/workflows/${workflowId}/deactivate`).catch(e => console.log('Deactivate warning:', e.message));

    console.log('Re-activating workflow...');
    const active = await req('POST', `/api/v1/workflows/${workflowId}/activate`);
    console.log('Workflow activation status:', JSON.stringify(active, null, 2));

    console.log('SUCCESS! Secure Services Webhook has been uploaded and activated.');
  } catch (err) {
    console.error('ERROR uploading workflow:', err.message);
    process.exit(1);
  }
})();
