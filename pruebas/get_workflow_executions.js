const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZWRlNzUwOC05OTdhLTQ0NzUtYjJiOC05YmUyZTNhNmE0MTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWQ4MDYyMDAtNWM4Ni00ZDQ1LWIyM2ItZDEyYzc2MmMwMGEyIiwiaWF0IjoxNzc1OTIxODk4fQ.S-gQd2FKYczqgzSIqxLv3tWTkS4mJk-lvt0DMAtmfKY';

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
