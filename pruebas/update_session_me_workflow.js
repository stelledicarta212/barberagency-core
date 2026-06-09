const https = require('https');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZWRlNzUwOC05OTdhLTQ0NzUtYjJiOC05YmUyZTNhNmE0MTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWQ4MDYyMDAtNWM4Ni00ZDQ1LWIyM2ItZDEyYzc2MmMwMGEyIiwiaWF0IjoxNzc1OTIxODk4fQ.S-gQd2FKYczqgzSIqxLv3tWTkS4mJk-lvt0DMAtmfKY';
const WORKFLOW_ID = 'iUZCTRli7ghGFrEb';
const HOST = 'barberagency-n8n.gymh5g.easypanel.host';

function req(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: HOST,
      port: 443,
      path: apiPath,
      method,
      headers: {
        'X-N8N-API-KEY': API_KEY,
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

(async () => {
  console.log('=== UPDATING N8N SESSION ME WORKFLOW ===');
  try {
    // 1. Fetch current workflow
    console.log('Fetching workflow...');
    const wf = await req('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
    console.log(`Workflow fetched: "${wf.name}"`);

    // 2. Find and update the "Postgres - session me" node query
    const targetNode = wf.nodes.find(n => n.name === 'Postgres - session me');
    if (!targetNode) {
      throw new Error('Node "Postgres - session me" not found in workflow nodes!');
    }

    const newQuery = `WITH input AS (
  SELECT
    COALESCE($1::boolean, false) AS auth_ok,
    COALESCE($2::int, 0) AS user_id_in,
    NULLIF(trim(COALESCE($3::text, '')), '') AS message_in,
    COALESCE(NULLIF(trim($4::text), ''), 'https://barberagency-barberagency.gymh5g.easypanel.host') AS cors_origin
),
resolved AS (
  SELECT u.id AS user_id, u.email, u.nombre, u.plan_id
  FROM public.usuarios u
  JOIN input i ON u.id = i.user_id_in
  LIMIT 1
),
owned_barberias AS (
  SELECT DISTINCT ON (b.id)
    b.id,
    b.slug,
    b.nombre,
    x.role
  FROM public.barberias b
  JOIN resolved r ON true
  JOIN LATERAL (
    SELECT 'owner'::text AS role WHERE b.owner_id = r.user_id
    UNION ALL
    SELECT bm.rol::text AS role FROM public.barberia_miembros bm
    WHERE bm.barberia_id = b.id 
      AND (bm.usuario_id = r.user_id OR lower(bm.email) = lower(r.email))
      AND bm.activo = true
  ) x ON true
  WHERE b.deleted_at IS NULL
  ORDER BY b.id DESC, CASE x.role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'barbero' THEN 3 WHEN 'cajero' THEN 4 ELSE 5 END ASC
),
current_barberia AS (
  SELECT *
  FROM owned_barberias
  ORDER BY id DESC
  LIMIT 1
)
SELECT
  CASE WHEN i.auth_ok AND EXISTS (SELECT 1 FROM resolved) THEN true ELSE false END AS ok,
  CASE WHEN i.auth_ok AND EXISTS (SELECT 1 FROM resolved) THEN 200 ELSE 401 END AS status_code,
  CASE WHEN i.auth_ok AND EXISTS (SELECT 1 FROM resolved) THEN NULL ELSE COALESCE(i.message_in, 'Sesion no valida') END AS message,
  i.cors_origin,
  (SELECT user_id FROM resolved LIMIT 1) AS user_id,
  (SELECT email FROM resolved LIMIT 1) AS email,
  (SELECT nombre FROM resolved LIMIT 1) AS nombre,
  (SELECT plan_id FROM resolved LIMIT 1) AS plan_id,
  CASE WHEN (SELECT plan_id FROM resolved LIMIT 1) IS NULL THEN false ELSE true END AS puede_crear_barberia,
  COALESCE((SELECT count(*) FROM owned_barberias), 0)::int AS barberias_count,
  COALESCE((SELECT row_to_json(current_barberia) FROM current_barberia), NULL) AS current_barberia,
  COALESCE((SELECT json_agg(owned_barberias) FROM owned_barberias), '[]'::json) AS barberias
FROM input i;`;

    targetNode.parameters.query = newQuery;
    console.log('SQL query successfully updated in memory.');

    // 3. Deactivate
    console.log('Deactivating workflow...');
    await req('POST', `/api/v1/workflows/${WORKFLOW_ID}/deactivate`);
    
    // 4. Update
    console.log('Updating workflow definition...');
    await req('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, {
      name: wf.name,
      nodes: wf.nodes,
      connections: wf.connections,
      settings: wf.settings
    });
    
    // 5. Activate
    console.log('Activating workflow...');
    await req('POST', `/api/v1/workflows/${WORKFLOW_ID}/activate`);
    
    console.log('Workflow successfully updated and activated! 🎉');
  } catch (err) {
    console.error('Error updating workflow:', err);
  }
})();
