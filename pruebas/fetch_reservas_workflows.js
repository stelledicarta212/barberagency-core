const https = require('https');
const fs = require('fs');
const path = require('path');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZWRlNzUwOC05OTdhLTQ0NzUtYjJiOC05YmUyZTNhNmE0MTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWQ4MDYyMDAtNWM4Ni00ZDQ1LWIyM2ItZDEyYzc2MmMwMGEyIiwiaWF0IjoxNzc1OTIxODk4fQ.S-gQd2FKYczqgzSIqxLv3tWTkS4mJk-lvt0DMAtmfKY';

function fetchWorkflow(id, filename) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: `/api/v1/workflows/${id}`,
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': token
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(parsed, null, 2));
          console.log(`Saved ${filename} successfully!`);
          resolve();
        } catch (e) {
          console.error(`Error parsing ${id}:`, e.message);
          resolve();
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

(async () => {
  await fetchWorkflow('6JugRzxsOGKBvgWW', 'dashboard_state_workflow.json');
  await fetchWorkflow('h3JdyaI26GbRqrzE', 'barberos_workflow.json');
})();
