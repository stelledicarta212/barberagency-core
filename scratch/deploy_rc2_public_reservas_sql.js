const fs = require('fs');
const https = require('https');

const HOST = 'barberagency-n8n.gymh5g.easypanel.host';
const WORKFLOW_ID = 'bl8JLdC5VOsC9zdu';
const SQL_PATH = 'app/database/migrations/2026-06-05_rc2_public_reservas_rpc.sql';

function readApiKey() {
  const src = fs.readFileSync('scratch/fetch_active_workflow.js', 'utf8');
  const match = src.match(/X-N8N-API-KEY': '([^']+)'/);
  if (!match) throw new Error('No se pudo leer API key de n8n');
  return match[1];
}

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ statusCode: res.statusCode, body: data, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function workflowRequest(method, path, bodyObject) {
  const body = bodyObject ? JSON.stringify(bodyObject) : null;
  return request({
    hostname: HOST,
    port: 443,
    path,
    method,
    headers: {
      'X-N8N-API-KEY': readApiKey(),
      ...(body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      } : {})
    }
  }, body);
}

async function putWorkflow(workflow) {
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: {}
  };
  const response = await workflowRequest('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, payload);
  if (response.statusCode !== 200) throw new Error(response.body);
}

async function activateWorkflow() {
  await workflowRequest('POST', `/api/v1/workflows/${WORKFLOW_ID}/deactivate`);
  const response = await workflowRequest('POST', `/api/v1/workflows/${WORKFLOW_ID}/activate`);
  if (![200, 201].includes(response.statusCode) && !String(response.body).includes('already active')) {
    throw new Error(response.body);
  }
}

async function main() {
  const current = await workflowRequest('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  if (current.statusCode !== 200) throw new Error(current.body);
  const original = current.json;
  const modified = JSON.parse(JSON.stringify(original));
  const sql = fs.readFileSync(SQL_PATH, 'utf8');

  const normalizeNode = modified.nodes.find((node) => node.name === 'Normalize payload');
  const buildNode = modified.nodes.find((node) => node.name === 'Build SQL dinamico' || node.name === 'Format RPC reserva');
  if (!normalizeNode || !buildNode) throw new Error('No se encontraron nodos esperados para ejecutar SQL');

  normalizeNode.parameters.jsCode = `
return [{ json: { ok: true, payload: {
  nombre_completo: "RC2 SQL Deploy",
  telefono: "3000000000",
  id_barberia: 198,
  id_barbero: 439,
  id_servicio: 489,
  fecha: "2026-06-10",
  hora: "08:00"
} } }];
`.trim();

  buildNode.parameters.jsCode = `
const query = \`${sql.replace(/`/g, '\\`')}\`;
return [{ json: { ok: true, query, params: [] } }];
`.trim();

  try {
    await putWorkflow(modified);
    await activateWorkflow();

    const payload = JSON.stringify({
      clientes_finales: { nombre_completo: 'RC2 SQL Deploy', telefono: '3000000000' },
      citas: { id_barberia: 198, id_servicio: 489, id_barbero: 439, fecha: '2026-06-10', hora: '08:00' }
    });
    const response = await request({
      hostname: HOST,
      port: 443,
      path: '/webhook/barberagency/reservas/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);

    console.log('deploy_sql_status', response.statusCode);
    console.log(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`SQL deploy failed with HTTP ${response.statusCode}`);
    }
  } finally {
    await putWorkflow(original);
    await activateWorkflow();
    console.log('workflow_restored', WORKFLOW_ID);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
