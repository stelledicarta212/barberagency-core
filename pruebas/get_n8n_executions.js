const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZWRlNzUwOC05OTdhLTQ0NzUtYjJiOC05YmUyZTNhNmE0MTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWQ4MDYyMDAtNWM4Ni00ZDQ1LWIyM2ItZDEyYzc2MmMwMGEyIiwiaWF0IjoxNzc1OTIxODk4fQ.S-gQd2FKYczqgzSIqxLv3tWTkS4mJk-lvt0DMAtmfKY';

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
  console.log('Fetching executions from n8n...');
  const res = await req('GET', '/api/v1/executions?limit=50');
  console.log('Executions response data length:', res.data ? res.data.length : 0);
  if (res.data) {
    const filtered = res.data.filter(e => e.workflowId === '6JlUg4reb20Z8o1a');
    console.log(`Found ${filtered.length} executions for deleted workflow 6JlUg4reb20Z8o1a.`);
    if (filtered.length > 0) {
      console.log(JSON.stringify(filtered[0], null, 2));
    } else {
      console.log('Sample executions:', JSON.stringify(res.data.slice(0, 5).map(e => ({ id: e.id, workflowId: e.workflowId, finished: e.finished, mode: e.mode })), null, 2));
    }
  }
})();
