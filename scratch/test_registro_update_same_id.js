const https = require('https');
const fs = require('fs');

const source = fs.readFileSync('scratch/fetch_latest_executions.js', 'utf8');
const API_KEY = source.match(/'X-N8N-API-KEY':\s*'([^']+)'/)?.[1];
const HOST = 'barberagency-n8n.gymh5g.easypanel.host';
const EXECUTION_ID = process.argv[2] || '425036';

function apiRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: HOST,
      port: 443,
      path,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
        ...(payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function webhookPost(path, body, sessionToken) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request({
      hostname: HOST,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        Cookie: `ba_session=${sessionToken}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function collectNodeItems(runData, nodeName) {
  const entries = runData?.[nodeName] || [];
  return entries.flatMap((entry) => entry?.data?.main?.[0] || []);
}

async function main() {
  const detailsRes = await apiRequest('GET', `/api/v1/executions/${encodeURIComponent(EXECUTION_ID)}?includeData=true`);
  if (detailsRes.statusCode !== 200) {
    throw new Error(`No se pudo leer ejecucion ${EXECUTION_ID}: ${detailsRes.statusCode}`);
  }

  const details = JSON.parse(detailsRes.body);
  const runData = details?.data?.resultData?.runData || details?.data?.runData || {};
  const parsed = collectNodeItems(runData, 'Code - parse session cookie')[0]?.json || {};
  const sessionToken = parsed.session_token;
  if (!sessionToken) throw new Error('No se encontro session_token en la ejecucion.');

  const payload = { ...parsed };
  delete payload.session_token;
  payload.barberia_id = Number(payload.barberia_id || payload.barberia?.id || payload.draft?.barberia?.id || 0);
  if (!payload.barberia_id) throw new Error('No se encontro barberia_id para probar actualizacion.');

  const before = await apiRequest('GET', '/api/v1/executions?workflowId=LsvB2cGDxvNTSL28&limit=1');
  const beforeId = JSON.parse(before.body)?.data?.[0]?.id;

  const postRes = await webhookPost('/webhook/registro-barberia', payload, sessionToken);
  let postData = {};
  try { postData = JSON.parse(postRes.body); } catch (_) {}

  const after = await apiRequest('GET', '/api/v1/executions?workflowId=LsvB2cGDxvNTSL28&limit=1');
  const afterId = JSON.parse(after.body)?.data?.[0]?.id;

  console.log(JSON.stringify({
    status: postRes.statusCode,
    ok: postData.ok ?? postData.success ?? null,
    message: postData.message || postData.result?.message || '',
    barberia_id: postData.barberia_id || postData.result?.barberia?.id || null,
    slug: postData.slug || postData.result?.barberia?.slug || '',
    owner_id: postData.owner_id || postData.result?.barberia?.owner_id || null,
    previous_execution_id: beforeId,
    new_execution_id: afterId,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
