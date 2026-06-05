const https = require('https');
const fs = require('fs');

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
      path: '/webhook/temp_postgres_exec',
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
    name: "Temp Postgres Exec Webhook",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "temp_postgres_exec",
          responseMode: "responseNode"
        },
        id: "webhook-trigger",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2.1,
        position: [250, 300]
      },
      {
        parameters: {
          operation: "executeQuery",
          query: "={{ $json.body.query }}",
          options: {
            queryReplacement: "={{ $json.body.params }}"
          }
        },
        id: "postgres-query",
        name: "PG - execute query",
        type: "n8n-nodes-base.postgres",
        typeVersion: 2.4,
        position: [450, 300],
        credentials: {
          postgres: {
            id: "SOV6oSyuHI9cxgLF",
            "name": "Postgres account"
          }
        },
        continueOnFail: true
      },
      {
        parameters: {
          jsCode: "const all = $input.all().map(item => item.json);\nreturn [{ json: { results: all } }];"
        },
        id: "aggregate-results",
        name: "Aggregate Results",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [650, 300]
      },
      {
        parameters: {
          respondWith: "json",
          responseBody: "={{ $json.results }}"
        },
        id: "respond-node",
        name: "Respond to Webhook",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [850, 300]
      }
    ],
    connections: {
      "Webhook": {
        "main": [[{ node: "PG - execute query", type: "main", index: 0 }]]
      },
      "PG - execute query": {
        "main": [[{ node: "Aggregate Results", type: "main", index: 0 }]]
      },
      "Aggregate Results": {
        "main": [[{ node: "Respond to Webhook", type: "main", index: 0 }]]
      }
    },
    settings: {}
  };

  console.log('Creating temp workflow...');
  const res = await req('POST', '/api/v1/workflows', workflowDefinition);
  tempWorkflowId = res.id;
  console.log('Workflow created with ID:', tempWorkflowId);

  console.log('Activating temp workflow...');
  await req('POST', `/api/v1/workflows/${tempWorkflowId}/activate`);
  console.log('Workflow active.');
}

async function cleanup() {
  if (tempWorkflowId) {
    console.log('Deactivating temp workflow...');
    await req('POST', `/api/v1/workflows/${tempWorkflowId}/deactivate`).catch(() => {});
    console.log('Deleting temp workflow...');
    await req('DELETE', `/api/v1/workflows/${tempWorkflowId}`).catch(() => {});
    console.log('Cleanup completed.');
  }
}

async function runSQL(query, params = []) {
  const res = await callWebhook({ query, params });
  return res.data;
}

module.exports = {
  setup,
  cleanup,
  runSQL,
  callWebhook
};

// If run directly, run a quick query to test:
if (require.main === module) {
  (async () => {
    try {
      await setup();
      console.log('Executing test query: SELECT NOW()');
      const time = await runSQL('SELECT NOW() as current_time;');
      console.log('Result:', JSON.stringify(time, null, 2));
    } catch (e) {
      console.error(e);
    } finally {
      await cleanup();
    }
  })();
}
