const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.N8N_API_KEY;
if (!API_KEY) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}

function getExecutions(workflowId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: `/api/v1/executions?workflowId=${workflowId}&limit=5`,
      headers: {
        'X-N8N-API-KEY': API_KEY
      }
    };

    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  const workflows = {
    'Dashboard State Webhook': '6JugRzxsOGKBvgWW'
  };

  for (const [name, id] of Object.entries(workflows)) {
    console.log(`\n=== Executions for ${name} (${id}) ===`);
    try {
      const res = await getExecutions(id);
      if (res.data && res.data.length > 0) {
        res.data.forEach((exec, idx) => {
          console.log(`  Exec ${idx}: ID ${exec.id}, started: ${exec.startedAt}, status: ${exec.status}`);
        });
      } else {
        console.log('  No executions found.');
      }
    } catch (e) {
      console.error(`  Error:`, e.message);
    }
  }
})();
