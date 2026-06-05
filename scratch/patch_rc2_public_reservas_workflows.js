const fs = require('fs');
const https = require('https');

const HOST = 'barberagency-n8n.gymh5g.easypanel.host';
const SLOTS_WORKFLOW_ID = 'sX5R13YbZ6gPoPo8';
const CREATE_WORKFLOW_ID = 'bl8JLdC5VOsC9zdu';
const DEPLOY = process.argv.includes('--deploy');

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

function workflowRequest(method, workflowId, bodyObject) {
  const body = bodyObject ? JSON.stringify(bodyObject) : null;
  return request({
    hostname: HOST,
    port: 443,
    path: `/api/v1/workflows/${workflowId}`,
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

function node(workflow, name) {
  const found = workflow.nodes.find((item) => item.name === name);
  if (!found) throw new Error(`No se encontro nodo ${name}`);
  return found;
}

function nodeAny(workflow, names) {
  const found = workflow.nodes.find((item) => names.includes(item.name));
  if (!found) throw new Error(`No se encontro nodo ${names.join(' / ')}`);
  return found;
}

function setIfTrueCondition(ifNode) {
  ifNode.parameters = {
    conditions: {
      combinator: 'and',
      conditions: [
        {
          leftValue: '={{ $json.ok }}',
          rightValue: true,
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true
          }
        }
      ]
    },
    options: {}
  };
}

function renameConnectionNode(workflow, oldName, newName) {
  if (!workflow.connections || oldName === newName) return;
  if (workflow.connections[oldName] && !workflow.connections[newName]) {
    workflow.connections[newName] = workflow.connections[oldName];
    delete workflow.connections[oldName];
  }
  for (const source of Object.values(workflow.connections)) {
    for (const outputs of Object.values(source)) {
      if (!Array.isArray(outputs)) continue;
      for (const branch of outputs) {
        if (!Array.isArray(branch)) continue;
        for (const edge of branch) {
          if (edge && edge.node === oldName) edge.node = newName;
        }
      }
    }
  }
}

function patchSlots(workflow) {
  node(workflow, 'Normalize query').parameters.jsCode = `
const query = $input.first().json.query || {};
const toInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};
const clean = (value) => String(value ?? '').trim();

const barberia_id = toInt(query.barberia_id || query.id_barberia);
const slug = clean(query.slug);
const servicio_id = toInt(query.servicio_id || query.id_servicio);
const barbero_id = toInt(query.barbero_id || query.id_barbero);
const fecha = clean(query.fecha || query.date);

if ((!barberia_id && !slug) || !servicio_id || !barbero_id || !/^\\d{4}-\\d{2}-\\d{2}$/.test(fecha)) {
  return [{
    json: {
      ok: false,
      code: 'datos_invalidos',
      status_code: 400,
      message: 'Faltan barberia_id o slug, servicio_id, barbero_id y fecha valida.',
      data: { barberia_id, slug, servicio_id, barbero_id, fecha }
    }
  }];
}

return [{ json: { ok: true, barberia_id, slug: slug || null, servicio_id, barbero_id, fecha } }];
`.trim();

  setIfTrueCondition(node(workflow, 'IF - query valida'));

  const pg = node(workflow, 'PG - Fetch Slots');
  pg.continueOnFail = true;
  pg.parameters.query = `
SELECT public.ba_reservas_public_slots(
  $1::int,
  $2::text,
  $3::int,
  $4::int,
  $5::date
) AS result;
`.trim();
  pg.parameters.options = {
    queryReplacement: '={{ [$json.barberia_id, $json.slug, $json.servicio_id, $json.barbero_id, $json.fecha] }}'
  };

  node(workflow, 'Format slots').parameters.jsCode = `
const first = $input.first().json || {};
if (first.error) {
  return [{
    json: {
      ok: false,
      code: 'error_postgres',
      message: first.error.message || 'Error consultando disponibilidad en PostgreSQL.',
      barberia_id: null,
      slug: null,
      servicio_id: null,
      barbero_id: null,
      fecha: null,
      slot_min: null,
      duracion_min: null,
      count: 0,
      slots: [],
      status_code: 500,
      data: { error: first.error.message || first.error }
    }
  }];
}
const result = first.result || first.ba_reservas_public_slots || first;
const data = result.data || {};
return [{
  json: {
    ok: Boolean(result.ok),
    code: result.code || (result.ok ? 'slots_disponibles' : 'datos_invalidos'),
    message: result.message || '',
    barberia_id: data.barberia_id ?? null,
    slug: data.slug ?? null,
    servicio_id: data.servicio_id ?? null,
    barbero_id: data.barbero_id ?? null,
    fecha: data.fecha ?? null,
    slot_min: data.slot_min ?? null,
    duracion_min: data.duracion_min ?? null,
    count: Number(data.count || 0),
    slots: Array.isArray(data.slots) ? data.slots : [],
    data
  }
}];
`.trim();

  node(workflow, 'Respond - ok').parameters.options.responseCode = '={{ $json.status_code || ($json.ok ? 200 : 400) }}';
  node(workflow, 'Respond - error').parameters.responseBody = '={{ $json }}';
}

function patchCreate(workflow) {
  node(workflow, 'Normalize payload').parameters.jsCode = `
const src = $json && typeof $json === 'object' ? $json : {};
let body = src.body && typeof src.body === 'object' ? src.body : src;
if (typeof body.payload === 'string') {
  try { body = JSON.parse(body.payload); } catch (_) {}
}
if (body.payload && typeof body.payload === 'object') body = body.payload;

const clean = (value) => String(value ?? '').trim();
const toInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
};

const cf = body.clientes_finales && typeof body.clientes_finales === 'object' ? body.clientes_finales : {};
const c = body.citas && typeof body.citas === 'object' ? body.citas : {};

const payload = {
  barberia_id: toInt(c.barberia_id || c.id_barberia || body.barberia_id || body.id_barberia),
  slug: clean(c.slug || body.slug),
  servicio_id: toInt(c.servicio_id || c.id_servicio || body.servicio_id || body.id_servicio),
  barbero_id: toInt(c.barbero_id || c.id_barbero || body.barbero_id || body.id_barbero),
  fecha: clean(c.fecha || body.fecha),
  hora: clean(c.hora || c.hora_inicio || body.hora || body.hora_inicio),
  cliente_nombre: clean(cf.nombre || cf.nombre_completo || body.cliente_nombre || body.nombre),
  cliente_tel: clean(cf.telefono || cf.celular || body.cliente_tel || body.telefono),
  cliente_email: clean(cf.email || body.cliente_email || body.email),
  notas: clean(c.notas || body.notas)
};

if ((!payload.barberia_id && !payload.slug) || !payload.servicio_id || !payload.barbero_id || !payload.fecha || !payload.hora || !payload.cliente_nombre || !payload.cliente_tel) {
  return [{
    json: {
      ok: false,
      code: 'datos_invalidos',
      status_code: 400,
      message: 'Faltan datos obligatorios para reservar.',
      data: payload
    }
  }];
}

return [{ json: { ok: true, payload } }];
`.trim();

  setIfTrueCondition(node(workflow, 'IF - payload valido'));

  const schemaNode = nodeAny(workflow, ['PG - schema reservas', 'PG - RPC crear reserva']);
  const schemaOldName = schemaNode.name;
  schemaNode.name = 'PG - RPC crear reserva';
  schemaNode.continueOnFail = true;
  renameConnectionNode(workflow, schemaOldName, schemaNode.name);
  schemaNode.parameters = {
    operation: 'executeQuery',
    query: `
SELECT public.ba_reservas_public_create(
  $1::int,
  $2::text,
  $3::int,
  $4::int,
  $5::date,
  $6::time,
  $7::text,
  $8::text,
  $9::text,
  $10::text
) AS result;
`.trim(),
    options: {
      queryReplacement: '={{ [$json.payload.barberia_id, $json.payload.slug || null, $json.payload.servicio_id, $json.payload.barbero_id, $json.payload.fecha, $json.payload.hora, $json.payload.cliente_nombre, $json.payload.cliente_tel, $json.payload.cliente_email || null, $json.payload.notas || null] }}'
    }
  };

  const buildNode = nodeAny(workflow, ['Build SQL dinamico', 'Format RPC reserva']);
  const buildOldName = buildNode.name;
  buildNode.name = 'Format RPC reserva';
  renameConnectionNode(workflow, buildOldName, buildNode.name);
  buildNode.parameters.jsCode = `
const first = $input.first().json || {};
if (first.error) {
  return [{
    json: {
      ok: false,
      code: 'error_postgres',
      message: first.error.message || 'Error creando reserva en PostgreSQL.',
      data: { error: first.error.message || first.error },
      status_code: 500
    }
  }];
}
const result = first.result || first.ba_reservas_public_create || first;
return [{
  json: {
    ok: Boolean(result.ok),
    code: result.code || (result.ok ? 'reserva_creada' : 'datos_invalidos'),
    message: result.message || '',
    data: result.data || {},
    status_code: result.ok ? 200 : 400
  }
}];
`.trim();

  const ifSql = nodeAny(workflow, ['IF - SQL listo', 'IF - RPC ok']);
  const ifSqlOldName = ifSql.name;
  ifSql.name = 'IF - RPC ok';
  renameConnectionNode(workflow, ifSqlOldName, ifSql.name);
  setIfTrueCondition(ifSql);

  const pgSave = nodeAny(workflow, ['PG - guardar reserva', 'Pass RPC result']);
  const pgSaveOldName = pgSave.name;
  pgSave.name = 'Pass RPC result';
  renameConnectionNode(workflow, pgSaveOldName, pgSave.name);
  pgSave.type = 'n8n-nodes-base.code';
  pgSave.typeVersion = 2;
  pgSave.parameters = {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: 'return $input.all();'
  };
  delete pgSave.credentials;

  node(workflow, 'Respond - ok').parameters.responseBody = '={{ $json }}';
  node(workflow, 'Respond - ok').parameters.options.responseCode = '={{ $json.status_code || ($json.ok ? 200 : 400) }}';
  node(workflow, 'Respond - error').parameters.responseBody = '={{ $json }}';
}

function readWorkflow(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function writeWorkflow(path, workflow) {
  fs.writeFileSync(path, `${JSON.stringify(workflow, null, 2)}\n`);
}

async function deployWorkflow(id, patcher) {
  const current = await workflowRequest('GET', id);
  if (current.statusCode !== 200) throw new Error(current.body);
  const workflow = current.json;
  patcher(workflow);
  const payload = {
    name: workflow.name,
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: {}
  };
  const updated = await workflowRequest('PUT', id, payload);
  if (updated.statusCode !== 200) throw new Error(updated.body);
  console.log(`deployed ${workflow.name} (${id})`);
}

async function main() {
  const slotsPath = 'pruebas/reservas_slots_workflow.json';
  const createPath = 'pruebas/reservas_save_workflow.json';

  const slots = readWorkflow(slotsPath);
  patchSlots(slots);
  writeWorkflow(slotsPath, slots);
  console.log(`patched ${slotsPath}`);

  const create = readWorkflow(createPath);
  patchCreate(create);
  writeWorkflow(createPath, create);
  console.log(`patched ${createPath}`);

  if (DEPLOY) {
    await deployWorkflow(SLOTS_WORKFLOW_ID, patchSlots);
    await deployWorkflow(CREATE_WORKFLOW_ID, patchCreate);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
