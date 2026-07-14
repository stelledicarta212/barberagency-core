const https = require('https');

const token = process.env.N8N_API_KEY;
if (!token) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}
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
    console.log('Fetching onboarding workflow LsvB2cGDxvNTSL28...');
    const wf = await req('GET', `/api/v1/workflows/${workflowId}`);
    console.log(`Fetched workflow: "${wf.name}"`);

    let updatedCount = 0;
    wf.nodes.forEach(node => {
      if (node.name === 'Crear barberia' && node.parameters && node.parameters.query) {
        let q = node.parameters.query;
        // Check if query contains insecure email_contacto matching
        if (q.includes('email_contacto')) {
          console.log(`Found matching query in node: ${node.name} [ID: ${node.id}]`);
          q = q.replace(
            /JOIN auth_user au ON \(b\.owner_id = au\.id OR lower\(COALESCE\(b\.email_contacto, ''\)\) = lower\(COALESCE\(au\.email, ''\)\)\)/g,
            'JOIN auth_user au ON b.owner_id = au.id'
          );
          node.parameters.query = q;
          updatedCount++;
        }
      }
    });

    if (updatedCount === 0) {
      console.log('No matching insecure query found. Onboarding query is already secure.');
      return;
    }

    console.log(`Updated query in ${updatedCount} nodes in memory.`);

    console.log('Deactivating workflow...');
    await req('POST', `/api/v1/workflows/${workflowId}/deactivate`).catch(() => {});

    console.log('Saving updated workflow...');
    await req('PUT', `/api/v1/workflows/${workflowId}`, {
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: {}
    });

    console.log('Activating workflow...');
    const activeRes = await req('POST', `/api/v1/workflows/${workflowId}/activate`);
    console.log('Workflow is active:', activeRes.active);
    console.log('--- UPDATE COMPLETED SUCCESSFULLY ---');

  } catch (err) {
    console.error('Error during execution:', err);
  }
})();
