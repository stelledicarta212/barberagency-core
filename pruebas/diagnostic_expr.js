const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZWRlNzUwOC05OTdhLTQ0NzUtYjJiOC05YmUyZTNhNmE0MTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWQ4MDYyMDAtNWM4Ni00ZDQ1LWIyM2ItZDEyYzc2MmMwMGEyIiwiaWF0IjoxNzc1OTIxODk4fQ.S-gQd2FKYczqgzSIqxLv3tWTkS4mJk-lvt0DMAtmfKY';
let tempWorkflowId = null;

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

function callWebhook(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: '/webhook/temp_expr_test',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
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
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

async function setup() {
  const workflowDefinition = {
    name: "Temp Diagnostic Webhook",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "temp_expr_test",
          responseMode: "responseNode"
        },
        id: "webhook-trigger",
        name: "Webhook - Servicios Admin",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2.1,
        position: [250, 300]
      },
      {
        parameters: {
          jsCode: `
            let test1 = 'fail';
            let test2 = 'fail';
            let test3 = 'fail';
            let test4 = 'fail';

            try {
              test1 = $('Webhook - Servicios Admin').first().json.body.barberia_id;
            } catch(e) { test1 = 'err: ' + e.message; }

            try {
              test2 = $node['Webhook - Servicios Admin'].json.body.barberia_id;
            } catch(e) { test2 = 'err: ' + e.message; }

            try {
              test3 = $input.first().json;
            } catch(e) { test3 = 'err: ' + e.message; }

            try {
              // Check how to reference previous nodes from expressions:
              test4 = typeof $('Webhook - Servicios Admin');
            } catch(e) { test4 = 'err: ' + e.message; }

            return [{ json: { test1, test2, test3, test4 } }];
          `
        },
        id: "diagnostic-code",
        name: "Code Node",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [450, 300]
      },
      {
        parameters: {
          respondWith: "json",
          responseBody: "={{ $json }}"
        },
        id: "respond-node",
        name: "Respond",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [650, 300]
      }
    ],
    connections: {
      "Webhook - Servicios Admin": {
        "main": [[{ node: "Code Node", type: "main", index: 0 }]]
      },
      "Code Node": {
        "main": [[{ node: "Respond", type: "main", index: 0 }]]
      }
    },
    settings: {}
  };

  console.log('Creating diagnostic workflow...');
  const res = await req('POST', '/api/v1/workflows', workflowDefinition);
  tempWorkflowId = res.id;
  console.log('Workflow created with ID:', tempWorkflowId);

  console.log('Activating diagnostic workflow...');
  await req('POST', `/api/v1/workflows/${tempWorkflowId}/activate`);
  console.log('Workflow active.');
}

async function cleanup() {
  if (tempWorkflowId) {
    console.log('Deactivating diagnostic workflow...');
    await req('POST', `/api/v1/workflows/${tempWorkflowId}/deactivate`).catch(() => {});
    console.log('Deleting diagnostic workflow...');
    await req('DELETE', `/api/v1/workflows/${tempWorkflowId}`).catch(() => {});
    console.log('Cleanup completed.');
  }
}

(async () => {
  try {
    await setup();
    console.log('Calling diagnostic webhook...');
    const result = await callWebhook({ barberia_id: 12345 });
    console.log('Diagnostic Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
