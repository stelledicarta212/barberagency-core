const fs = require('fs');
const https = require('https');

const HOST = 'barberagency-n8n.gymh5g.easypanel.host';
const DB_CRED_ID = 'SOV6oSyuHI9cxgLF';
const WORKFLOW_NAME = 'BarberAgency - RC2 SQL Once';
const WEBHOOK_PATH = `barberagency/admin/rc2-sql-once-${Date.now()}`;
const SQL_PATH = 'app/database/migrations/2026-06-05_rc2_public_reservas_rpc.sql';

function readApiKey() {
  const src = fs.readFileSync('scratch/fetch_active_workflow.js', 'utf8');
  const match = src.match(/X-N8N-API-KEY': '([^']+)'/);
  if (!match) throw new Error('No se pudo leer API key de n8n');
  return match[1];
}

function request(method, path, bodyObject = null, headers = {}) {
  const body = bodyObject ? JSON.stringify(bodyObject) : null;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: HOST,
      port: 443,
      path,
      method,
      headers: {
        ...headers,
        ...(body ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function apiRequest(method, path, bodyObject = null) {
  return request(method, path, bodyObject, { 'X-N8N-API-KEY': readApiKey() });
}

async function findExisting() {
  const res = await apiRequest('GET', '/api/v1/workflows?limit=100');
  if (res.statusCode !== 200) throw new Error(res.body);
  const workflows = JSON.parse(res.body).data || [];
  return workflows.find((workflow) => workflow.name === WORKFLOW_NAME) || null;
}

function buildWorkflow(sql) {
  return {
    name: WORKFLOW_NAME,
    nodes: [
      {
        parameters: {
          httpMethod: 'POST',
          path: WEBHOOK_PATH,
          responseMode: 'responseNode',
          options: {}
        },
        id: 'rc2-sql-webhook',
        name: 'Webhook - RC2 SQL',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1.1,
        position: [100, 300]
      },
      {
        parameters: {
          operation: 'executeQuery',
          query: `${sql}\n\nSELECT json_build_object('ok', true, 'code', 'rc2_sql_deployed') AS result;`,
          options: {}
        },
        id: 'rc2-sql-postgres',
        name: 'PG - RC2 SQL',
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2.4,
        position: [340, 300],
        credentials: {
          postgres: {
            id: DB_CRED_ID,
            name: 'Postgres account'
          }
        }
      },
      {
        parameters: {
          respondWith: 'json',
          responseBody: '={{ $json.result || { ok: true, code: "rc2_sql_deployed" } }}',
          options: {
            responseCode: 200,
            responseHeaders: {
              entries: [
                { name: 'Access-Control-Allow-Origin', value: '*' },
                { name: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
                { name: 'Access-Control-Allow-Headers', value: '*' }
              ]
            }
          }
        },
        id: 'rc2-sql-respond',
        name: 'Respond - RC2 SQL',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [580, 300]
      }
    ],
    connections: {
      'Webhook - RC2 SQL': {
        main: [[{ node: 'PG - RC2 SQL', type: 'main', index: 0 }]]
      },
      'PG - RC2 SQL': {
        main: [[{ node: 'Respond - RC2 SQL', type: 'main', index: 0 }]]
      }
    },
    settings: {}
  };
}

async function main() {
  const sql = fs.readFileSync(SQL_PATH, 'utf8');
  const workflow = buildWorkflow(sql);
  const existing = await findExisting();
  let workflowId = existing?.id;

  const save = workflowId
    ? await apiRequest('PUT', `/api/v1/workflows/${workflowId}`, workflow)
    : await apiRequest('POST', '/api/v1/workflows', workflow);
  if (![200, 201].includes(save.statusCode)) throw new Error(save.body);
  workflowId = workflowId || JSON.parse(save.body).id;

  const activate = await apiRequest('POST', `/api/v1/workflows/${workflowId}/activate`);
  if (![200, 201].includes(activate.statusCode) && !String(activate.body).includes('already active')) {
    throw new Error(activate.body);
  }

  const run = await request('POST', `/webhook/${WEBHOOK_PATH}`, { run: true });
  console.log('run_status', run.statusCode);
  console.log(run.body);
  if (![200, 201].includes(run.statusCode)) throw new Error(run.body);

  const deactivate = await apiRequest('POST', `/api/v1/workflows/${workflowId}/deactivate`);
  console.log('deactivate_status', deactivate.statusCode);
  console.log('workflow_id', workflowId);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
