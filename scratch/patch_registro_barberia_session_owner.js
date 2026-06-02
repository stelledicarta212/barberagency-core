const https = require('https');
const fs = require('fs');

const source = fs.readFileSync('fetch_workflows.js', 'utf8');
const API_KEY = source.match(/'X-N8N-API-KEY':\s*'([^']+)'/)?.[1];
const HOST = 'barberagency-n8n.gymh5g.easypanel.host';
const WORKFLOW_ID = 'LsvB2cGDxvNTSL28';

function request(method, path, body = null) {
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

const parseCookieCode = `
const webhook = $('Webhook').first().json || {};
const headers = webhook.headers || {};
let body = webhook.body;
if (typeof body === 'string') {
  try { body = JSON.parse(body); } catch (_) { body = {}; }
}
body = body && typeof body === 'object' ? body : {};
const cookieHeader = (headers.cookie ?? headers.Cookie ?? '').toString();
const match = cookieHeader.match(/(?:^|;\\s*)ba_session=([^;]+)/);
const session_token = match ? match[1] : '';
return [{ json: { ...body, session_token } }];
`.trim();

const claimsCode = `
const jwt = $input.first().json || {};
const webhook = $('Webhook').first().json || {};
let body = webhook.body;
if (typeof body === 'string') {
  try { body = JSON.parse(body); } catch (_) { body = {}; }
}
body = body && typeof body === 'object' ? body : {};
const auth_ok = !jwt.error && !!jwt.payload?.user_id;
const auth_user_id = auth_ok ? Number(jwt.payload.user_id) : 0;

return [{
  json: {
    ...body,
    auth_ok,
    auth_user_id,
    auth_message: auth_ok ? '' : 'Sesion no valida',
  },
}];
`.trim();

const createBarberiaQuery = `
WITH input AS (
  SELECT
    COALESCE($1::boolean, false) AS auth_ok,
    COALESCE($2::int, 0) AS auth_user_id,
    COALESCE($3::int, 0) AS barberia_id,
    NULLIF(trim(COALESCE($4::text, '')), '') AS slug_input,
    NULLIF(trim(COALESCE($5::text, '')), '') AS nombre,
    NULLIF(trim(COALESCE($6::text, '')), '') AS telefono,
    NULLIF(lower(trim(COALESCE($7::text, ''))), '') AS admin_email,
    NULLIF(trim(COALESCE($8::text, '')), '') AS direccion,
    NULLIF(trim(COALESCE($9::text, '')), '') AS ciudad,
    GREATEST(5, COALESCE($10::int, 15)) AS slot_min
),
auth_user AS (
  SELECT u.id, u.email
  FROM public.usuarios u
  JOIN input i ON u.id = i.auth_user_id
  WHERE i.auth_ok = true
  LIMIT 1
),
owned_existing AS (
  SELECT b.id, b.slug
  FROM public.barberias b
  JOIN input i ON b.id = i.barberia_id
  JOIN auth_user au ON b.owner_id = au.id
  WHERE i.barberia_id > 0
    AND b.deleted_at IS NULL
  LIMIT 1
),
clean AS (
  SELECT
    i.*,
    COALESCE(
      NULLIF(regexp_replace(lower(trim(i.slug_input)), '[^a-z0-9]+', '-', 'g'), ''),
      NULLIF(regexp_replace(lower(trim(i.nombre)), '[^a-z0-9]+', '-', 'g'), ''),
      'barberia'
    ) AS base_slug
  FROM input i
),
final_slug AS (
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM owned_existing)
      THEN (SELECT slug FROM owned_existing LIMIT 1)
    WHEN EXISTS (SELECT 1 FROM public.barberias b WHERE b.slug = clean.base_slug)
      THEN clean.base_slug || '-' || substring(md5(random()::text), 1, 6)
    ELSE clean.base_slug
  END AS slug
  FROM clean
),
updated AS (
  UPDATE public.barberias b
  SET
    nombre = COALESCE(c.nombre, b.nombre),
    email_contacto = COALESCE(c.admin_email, au.email, b.email_contacto),
    telefono = COALESCE(c.telefono, b.telefono, ''),
    direccion = COALESCE(c.direccion, b.direccion),
    ciudad = COALESCE(c.ciudad, b.ciudad),
    slot_min = COALESCE(c.slot_min, b.slot_min, 15)
  FROM clean c
  CROSS JOIN auth_user au
  CROSS JOIN owned_existing oe
  WHERE b.id = oe.id
  RETURNING b.id, b.slug, b.nombre, b.owner_id, b.slot_min, b.direccion, b.ciudad
),
inserted AS (
  INSERT INTO public.barberias
    (nombre, slug, email_contacto, telefono, direccion, ciudad, slot_min, estado, owner_id, created_at)
  SELECT
    COALESCE(c.nombre, 'Barberia'),
    fs.slug,
    COALESCE(c.admin_email, au.email),
    COALESCE(c.telefono, ''),
    c.direccion,
    c.ciudad,
    c.slot_min,
    'activa',
    au.id,
    NOW()
  FROM clean c
  JOIN auth_user au ON true
  CROSS JOIN final_slug fs
  WHERE c.barberia_id <= 0
  RETURNING id, slug, nombre, owner_id, slot_min, direccion, ciudad
),
result AS (
  SELECT * FROM updated
  UNION ALL
  SELECT * FROM inserted
)
SELECT
  COALESCE((SELECT true FROM result LIMIT 1), false) AS ok,
  CASE
    WHEN NOT (SELECT auth_ok FROM input LIMIT 1) THEN 'Sesion no valida'
    WHEN NOT EXISTS (SELECT 1 FROM auth_user) THEN 'Usuario de sesion no encontrado'
    WHEN (SELECT barberia_id FROM input LIMIT 1) > 0 AND NOT EXISTS (SELECT 1 FROM owned_existing) THEN 'La barberia no pertenece al usuario de sesion'
    WHEN NOT EXISTS (SELECT 1 FROM result) THEN 'No se pudo crear o actualizar barberia'
    WHEN EXISTS (SELECT 1 FROM updated) THEN 'Barberia actualizada'
    ELSE 'Barberia creada'
  END AS message,
  (SELECT id FROM result LIMIT 1) AS id,
  (SELECT slug FROM result LIMIT 1) AS slug,
  (SELECT nombre FROM result LIMIT 1) AS nombre,
  (SELECT owner_id FROM result LIMIT 1) AS owner_id,
  (SELECT slot_min FROM result LIMIT 1) AS slot_min,
  (SELECT direccion FROM result LIMIT 1) AS direccion,
  (SELECT ciudad FROM result LIMIT 1) AS ciudad;
`.trim();

const createBarberiaReplacement = '={{ [Boolean($json.auth_ok), Number($json.auth_user_id ?? 0), Number($json.barberia_id ?? $json.barberia?.id ?? $json.draft?.barberia?.id ?? 0), ($json.slug ?? $json.barberia?.slug ?? $json.draft?.barberia?.slug ?? "").toString(), ($json.nombre ?? $json.barberia?.nombre ?? $json.draft?.barberia?.nombre ?? "").toString(), ($json.telefono ?? $json.barberia?.telefono ?? $json.draft?.barberia?.telefono ?? "").toString(), ($json.admin?.email ?? $json.accesos?.admin?.email ?? $json.draft?.accesos?.admin?.email ?? $json.admin_email ?? "").toString(), ($json.direccion ?? $json.barberia?.direccion ?? $json.draft?.barberia?.direccion ?? "").toString(), ($json.ciudad ?? $json.barberia?.ciudad ?? $json.draft?.barberia?.ciudad ?? "").toString(), Number($json.slot_min ?? $json.barberia?.slot_min ?? $json.draft?.barberia?.slot_min ?? 15)] }}';

function replaceOwnerUpdate(sql) {
  const replacement = `owner_update AS (
  SELECT b.id, b.slug, b.owner_id
  FROM public.barberias b
  JOIN input i ON b.id = i.barberia_id
  LIMIT 1
)`;
  const pattern = /owner_update AS \(\s*UPDATE public\.barberias b\s*SET owner_id = au\.id\s*FROM admin_upsert au, input i\s*WHERE b\.id = i\.barberia_id\s*RETURNING b\.id, b\.slug, b\.owner_id\s*\)/m;
  const next = sql.replace(pattern, replacement);
  if (next === sql && !/owner_update AS \(\s*SELECT b\.id, b\.slug, b\.owner_id/m.test(sql)) {
    throw new Error('No se pudo reemplazar owner_update en Sincronizar fuente verdad');
  }
  return next;
}

function replaceBarberUserDedupe(sql) {
  let next = sql;
  const insertPattern = `barber_users AS (
  INSERT INTO public.usuarios (nombre, email, role, password_hash)
  SELECT
    COALESCE(nombre, 'Barbero'),
    email,
    'barbero',
    CASE WHEN password IS NULL THEN NULL ELSE public.fn_password_hash(password) END
  FROM barber_access
  WHERE email IS NOT NULL
  ON CONFLICT (email) DO UPDATE
  SET
    nombre = COALESCE(NULLIF(EXCLUDED.nombre, ''), public.usuarios.nombre),
    role = 'barbero',
    password_hash = COALESCE(EXCLUDED.password_hash, public.usuarios.password_hash)
  RETURNING id, nombre, email, role
)`;
  const replacement = `barber_access_distinct AS (
  SELECT DISTINCT ON (email)
    nombre,
    email,
    password
  FROM barber_access
  WHERE email IS NOT NULL
  ORDER BY email, rn
),
barber_users AS (
  INSERT INTO public.usuarios (nombre, email, role, password_hash)
  SELECT
    COALESCE(nombre, 'Barbero'),
    email,
    'barbero',
    CASE WHEN password IS NULL THEN NULL ELSE public.fn_password_hash(password) END
  FROM barber_access_distinct
  ON CONFLICT (email) DO UPDATE
  SET
    nombre = COALESCE(NULLIF(EXCLUDED.nombre, ''), public.usuarios.nombre),
    role = 'barbero',
    password_hash = COALESCE(EXCLUDED.password_hash, public.usuarios.password_hash)
  RETURNING id, nombre, email, role
)`;
  next = next.replace(insertPattern, replacement);
  if (next === sql && !/barber_access_distinct AS \(/m.test(sql)) {
    throw new Error('No se pudo agregar deduplicacion de emails de barberos');
  }
  return next;
}

function replaceSyncCollectionsCleanup(sql) {
  let next = sql;
  if (!/service_cleanup AS \(/m.test(next)) {
    next = next.replace(
      /service_rows AS \(/m,
      `service_cleanup AS (
  DELETE FROM public.servicios s
  USING valid_input i
  WHERE s.barberia_id = i.barberia_id
    AND NOT EXISTS (SELECT 1 FROM public.citas c WHERE c.barberia_id = i.barberia_id)
  RETURNING s.id
),
service_cleanup_guard AS (
  SELECT count(*) AS total FROM service_cleanup
),
service_rows AS (`
    );
  }

  if (!/barber_cleanup AS \(/m.test(next)) {
    next = next.replace(
      /barber_access AS \(/m,
      `barber_cleanup AS (
  DELETE FROM public.barberos b
  USING valid_input i
  WHERE b.barberia_id = i.barberia_id
    AND NOT EXISTS (SELECT 1 FROM public.citas c WHERE c.barberia_id = i.barberia_id)
  RETURNING b.id
),
barber_cleanup_guard AS (
  SELECT count(*) AS total FROM barber_cleanup
),
barber_access AS (`
    );
  }

  if (!/service_cleanup AS \(/m.test(next) || !/barber_cleanup AS \(/m.test(next)) {
    throw new Error('No se pudo agregar limpieza controlada de colecciones');
  }
  return next;
}

async function main() {
  if (!API_KEY) throw new Error('No se pudo leer API key desde fetch_workflows.js');

  const currentRes = await request('GET', `/api/v1/workflows/${WORKFLOW_ID}`);
  if (currentRes.statusCode !== 200) {
    throw new Error(`No se pudo leer workflow: ${currentRes.statusCode} ${currentRes.body}`);
  }

  const wf = JSON.parse(currentRes.body);
  fs.writeFileSync('scratch/registro_barberia_before_session_owner_patch.json', JSON.stringify(wf, null, 2));

  const webhook = wf.nodes.find((node) => node.name === 'Webhook');
  const limpiar = wf.nodes.find((node) => node.name === 'limpiar datos');
  const crear = wf.nodes.find((node) => node.name === 'Crear barberia');
  const sync = wf.nodes.find((node) => node.name === 'Sincronizar fuente verdad');
  const respond = wf.nodes.find((node) => node.name === 'Respond to Webhook');
  if (!webhook || !limpiar || !crear || !sync || !respond) {
    throw new Error('No se encontraron nodos esperados');
  }

  let parse = wf.nodes.find((node) => node.name === 'Code - parse session cookie');
  if (!parse) {
    parse = {
      id: 'code-parse-session-cookie',
      name: 'Code - parse session cookie',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-360, 180],
      parameters: { jsCode: parseCookieCode },
    };
    wf.nodes.push(parse);
  } else {
    parse.parameters.jsCode = parseCookieCode;
  }

  let jwt = wf.nodes.find((node) => node.name === 'JWT - Verify session');
  if (!jwt) {
    jwt = {
      id: 'jwt-verify-registro-session',
      name: 'JWT - Verify session',
      type: 'n8n-nodes-base.jwt',
      typeVersion: 1,
      position: [-120, 180],
      parameters: {
        operation: 'verify',
        token: '={{ $json.session_token }}',
        options: { algorithm: 'HS256' },
      },
      credentials: {
        jwtAuth: {
          id: 'mNWhzdM1ihAaBkZM',
          name: 'JWT Auth account',
        },
      },
      continueOnFail: true,
    };
    wf.nodes.push(jwt);
  }

  let claims = wf.nodes.find((node) => node.name === 'Code - session claims');
  if (!claims) {
    claims = {
      id: 'code-registro-session-claims',
      name: 'Code - session claims',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [80, 180],
      parameters: { jsCode: claimsCode },
    };
    wf.nodes.push(claims);
  } else {
    claims.parameters.jsCode = claimsCode;
  }

  crear.parameters.query = createBarberiaQuery;
  crear.parameters.options = crear.parameters.options || {};
  crear.parameters.options.queryReplacement = createBarberiaReplacement;

  sync.parameters.query = replaceSyncCollectionsCleanup(replaceBarberUserDedupe(replaceOwnerUpdate(sync.parameters.query)));

  respond.parameters.responseBody = '={{ $node["Crear barberia"].json.ok ? { success: true, ok: true, message: "Barberia registrada correctamente", barberia_id: $node["Crear barberia"].json.id, slug: $node["Crear barberia"].json.slug, owner_id: $node["Crear barberia"].json.owner_id } : { success: false, ok: false, message: $node["Crear barberia"].json.message } }}';
  respond.parameters.options.responseCode = '={{ $node["Crear barberia"].json.ok ? 200 : 401 }}';
  const headers = respond.parameters.options.responseHeaders.entries;
  const allowHeaders = headers.find((h) => h.name === 'Access-Control-Allow-Headers');
  if (allowHeaders) allowHeaders.value = 'Content-Type, Accept';
  const allowCreds = headers.find((h) => h.name === 'Access-Control-Allow-Credentials');
  if (!allowCreds) headers.push({ name: 'Access-Control-Allow-Credentials', value: 'true' });

  wf.connections = wf.connections || {};
  wf.connections.Webhook = { main: [[{ node: 'Code - parse session cookie', type: 'main', index: 0 }]] };
  wf.connections['Code - parse session cookie'] = { main: [[{ node: 'JWT - Verify session', type: 'main', index: 0 }]] };
  wf.connections['JWT - Verify session'] = { main: [[{ node: 'Code - session claims', type: 'main', index: 0 }]] };
  wf.connections['Code - session claims'] = { main: [[{ node: 'limpiar datos', type: 'main', index: 0 }]] };
  wf.connections['limpiar datos'] = { main: [[{ node: 'Crear barberia', type: 'main', index: 0 }]] };

  sync.parameters.options = sync.parameters.options || {};
  sync.parameters.options.queryReplacement = '={{ [Number($node["Crear barberia"].json["id"] ?? 0), JSON.stringify($node["Code - session claims"].json.draft ?? $node["Code - session claims"].json ?? {})] }}';

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: {},
  };
  fs.writeFileSync('scratch/registro_barberia_after_session_owner_patch.json', JSON.stringify(payload, null, 2));

  const putRes = await request('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, payload);
  console.log('PUT', putRes.statusCode, putRes.body.slice(0, 500));
  if (putRes.statusCode !== 200) process.exit(1);

  const deactivateRes = await request('POST', `/api/v1/workflows/${WORKFLOW_ID}/deactivate`);
  console.log('DEACTIVATE', deactivateRes.statusCode);
  const activateRes = await request('POST', `/api/v1/workflows/${WORKFLOW_ID}/activate`);
  console.log('ACTIVATE', activateRes.statusCode, activateRes.body.slice(0, 500));
  if (activateRes.statusCode !== 200) process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
