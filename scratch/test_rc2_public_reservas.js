const fs = require('fs');
const https = require('https');

const N8N_HOST = 'barberagency-n8n.gymh5g.easypanel.host';
const DB_CRED_ID = 'SOV6oSyuHI9cxgLF';
const BASE = `https://${N8N_HOST}`;
const BARBERIA_ID = 185;
const SLUG = 'barberia-185';
const SERVICIO_ID = 435;
const SERVICIO_AJENO_ID = 1;
const BARBERO_ID = 400;
const BARBERO_AJENO_ID = 3;
const FECHA = '2026-06-10';
const FECHA_DESCANSO = '2026-06-11';
const HORA = '08:00';

const createdCitaIds = [];

function readApiKey() {
  const src = fs.readFileSync('scratch/fetch_active_workflow.js', 'utf8');
  const match = src.match(/X-N8N-API-KEY': '([^']+)'/);
  if (!match) throw new Error('No se pudo leer API key de n8n');
  return match[1];
}

function requestUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.stringify(options.body) : null;
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || 'GET',
      headers: {
        ...(body ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        } : {}),
        ...(options.headers || {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch (_) {}
        resolve({ status: res.statusCode, raw, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function apiRequest(method, path, bodyObject = null) {
  return requestUrl(`${BASE}${path}`, {
    method,
    body: bodyObject,
    headers: { 'X-N8N-API-KEY': readApiKey() }
  });
}

function sqlWorkflow(sql) {
  const path = `barberagency/admin/rc2-test-sql-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    name: `BarberAgency - RC2 Test SQL ${Date.now()}`,
    nodes: [
      {
        parameters: { httpMethod: 'POST', path, responseMode: 'responseNode', options: {} },
        id: 'webhook',
        name: 'Webhook - SQL',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1.1,
        position: [100, 300]
      },
      {
        parameters: {
          operation: 'executeQuery',
          query: sql,
          options: {}
        },
        id: 'postgres',
        name: 'PG - SQL',
        type: 'n8n-nodes-base.postgres',
        typeVersion: 2.4,
        position: [320, 300],
        credentials: { postgres: { id: DB_CRED_ID, name: 'Postgres account' } }
      },
      {
        parameters: {
          respondWith: 'json',
          responseBody: '={{ $json }}',
          options: { responseCode: 200 }
        },
        id: 'respond',
        name: 'Respond - SQL',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [560, 300]
      }
    ],
    connections: {
      'Webhook - SQL': { main: [[{ node: 'PG - SQL', type: 'main', index: 0 }]] },
      'PG - SQL': { main: [[{ node: 'Respond - SQL', type: 'main', index: 0 }]] }
    },
    settings: {}
  };
}

async function runSql(sql) {
  const workflow = sqlWorkflow(sql);
  const create = await apiRequest('POST', '/api/v1/workflows', workflow);
  if (![200, 201].includes(create.status)) throw new Error(`create sql wf: ${create.raw}`);
  const workflowId = create.json.id;
  try {
    const activate = await apiRequest('POST', `/api/v1/workflows/${workflowId}/activate`);
    if (![200, 201].includes(activate.status) && !String(activate.raw).includes('already active')) {
      throw new Error(`activate sql wf: ${activate.raw}`);
    }
    const run = await requestUrl(`${BASE}/webhook/${workflow.nodes[0].parameters.path}`, { method: 'POST', body: { run: true } });
    if (![200, 201].includes(run.status)) throw new Error(`run sql wf: ${run.raw}`);
    return run.json;
  } finally {
    await apiRequest('POST', `/api/v1/workflows/${workflowId}/deactivate`).catch(() => {});
  }
}

function slotsUrl(params) {
  const query = new URLSearchParams(params);
  return `${BASE}/webhook/barberagency/reservas/slots?${query.toString()}`;
}

function reservaPayload(overrides = {}) {
  return {
    clientes_finales: {
      nombre_completo: overrides.nombre || 'RC2 QA Cliente',
      telefono: overrides.telefono || `300RC2${Date.now().toString().slice(-6)}`
    },
    citas: {
      id_barberia: overrides.barberia_id ?? BARBERIA_ID,
      slug: overrides.slug,
      id_servicio: overrides.servicio_id ?? SERVICIO_ID,
      id_barbero: overrides.barbero_id ?? BARBERO_ID,
      fecha: overrides.fecha ?? FECHA,
      hora: overrides.hora ?? HORA
    }
  };
}

async function httpTest(name, requestPromise, expect) {
  const res = await requestPromise;
  const pass = expect(res);
  const body = res.json || res.raw;
  console.log(JSON.stringify({ name, pass, status: res.status, body }, null, 2));
  if (!pass) throw new Error(`FAIL ${name}`);
  return res;
}

async function main() {
  await runSql(`
    UPDATE public.citas
    SET estado = 'cancelada'
    WHERE barberia_id = ${BARBERIA_ID}
      AND barbero_id = ${BARBERO_ID}
      AND fecha IN ('${FECHA}', '${FECHA_DESCANSO}')
      AND cliente_tel LIKE '300RC2%';

    DELETE FROM public.barberos_descansos
    WHERE barberia_id = ${BARBERIA_ID}
      AND barbero_id = ${BARBERO_ID}
      AND fecha = '${FECHA_DESCANSO}';

    SELECT json_build_object('ok', true, 'code', 'preclean') AS result;
  `);

  await httpTest(
    'slots con servicio propio',
    requestUrl(slotsUrl({ barberia_id: BARBERIA_ID, fecha: FECHA, barbero_id: BARBERO_ID, servicio_id: SERVICIO_ID })),
    (res) => res.status === 200 && res.json?.ok === true && res.json?.count > 0
  );

  await httpTest(
    'slots con servicio ajeno',
    requestUrl(slotsUrl({ barberia_id: BARBERIA_ID, fecha: FECHA, barbero_id: BARBERO_ID, servicio_id: SERVICIO_AJENO_ID })),
    (res) => res.status === 400 && res.json?.ok === false && res.json?.code === 'servicio_no_pertenece'
  );

  await httpTest(
    'slots con barbero ajeno',
    requestUrl(slotsUrl({ barberia_id: BARBERIA_ID, fecha: FECHA, barbero_id: BARBERO_AJENO_ID, servicio_id: SERVICIO_ID })),
    (res) => res.status === 400 && res.json?.ok === false && res.json?.code === 'barbero_no_pertenece'
  );

  const valid = await httpTest(
    'create valido',
    requestUrl(`${BASE}/webhook/barberagency/reservas/create`, {
      method: 'POST',
      body: reservaPayload({ telefono: '300RC20001' })
    }),
    (res) => res.status === 200 && res.json?.ok === true && res.json?.code === 'reserva_creada' && Boolean(res.json?.data?.cita_id)
  );
  createdCitaIds.push(Number(valid.json.data.cita_id));

  await httpTest(
    'create con servicio ajeno',
    requestUrl(`${BASE}/webhook/barberagency/reservas/create`, {
      method: 'POST',
      body: reservaPayload({ telefono: '300RC20002', servicio_id: SERVICIO_AJENO_ID, hora: '09:00' })
    }),
    (res) => res.status === 400 && res.json?.ok === false && res.json?.code === 'servicio_no_pertenece'
  );

  await httpTest(
    'create con barbero ajeno',
    requestUrl(`${BASE}/webhook/barberagency/reservas/create`, {
      method: 'POST',
      body: reservaPayload({ telefono: '300RC20003', barbero_id: BARBERO_AJENO_ID, hora: '09:00' })
    }),
    (res) => res.status === 400 && res.json?.ok === false && res.json?.code === 'barbero_no_pertenece'
  );

  await httpTest(
    'create fuera de horario',
    requestUrl(`${BASE}/webhook/barberagency/reservas/create`, {
      method: 'POST',
      body: reservaPayload({ telefono: '300RC20004', hora: '03:00' })
    }),
    (res) => res.status === 400 && res.json?.ok === false && res.json?.code === 'fuera_de_horario'
  );

  await runSql(`
    INSERT INTO public.barberos_descansos (barberia_id, barbero_id, fecha)
    VALUES (${BARBERIA_ID}, ${BARBERO_ID}, '${FECHA_DESCANSO}')
    ON CONFLICT (barbero_id, fecha) DO NOTHING;
    SELECT json_build_object('ok', true, 'code', 'descanso_insertado') AS result;
  `);

  await httpTest(
    'create en descanso',
    requestUrl(`${BASE}/webhook/barberagency/reservas/create`, {
      method: 'POST',
      body: reservaPayload({ telefono: '300RC20005', fecha: FECHA_DESCANSO })
    }),
    (res) => res.status === 400 && res.json?.ok === false && res.json?.code === 'descanso_barbero'
  );

  await runSql(`
    DELETE FROM public.barberos_descansos
    WHERE barberia_id = ${BARBERIA_ID}
      AND barbero_id = ${BARBERO_ID}
      AND fecha = '${FECHA_DESCANSO}';
    SELECT json_build_object('ok', true, 'code', 'descanso_limpio') AS result;
  `);

  await httpTest(
    'create solapada',
    requestUrl(`${BASE}/webhook/barberagency/reservas/create`, {
      method: 'POST',
      body: reservaPayload({ telefono: '300RC20006' })
    }),
    (res) => res.status === 400 && res.json?.ok === false && res.json?.code === 'slot_ocupado'
  );

  await runSql(`
    UPDATE public.citas
    SET estado = 'cancelada'
    WHERE id = ${createdCitaIds[0]};
    SELECT json_build_object('ok', true, 'code', 'slot_cancelado') AS result;
  `);

  const afterCancel = await httpTest(
    'create valido despues de cancelar slot',
    requestUrl(`${BASE}/webhook/barberagency/reservas/create`, {
      method: 'POST',
      body: reservaPayload({ telefono: '300RC20007' })
    }),
    (res) => res.status === 200 && res.json?.ok === true && res.json?.code === 'reserva_creada' && Boolean(res.json?.data?.cita_id)
  );
  createdCitaIds.push(Number(afterCancel.json.data.cita_id));

  await httpTest(
    'create con datos incompletos',
    requestUrl(`${BASE}/webhook/barberagency/reservas/create`, {
      method: 'POST',
      body: { clientes_finales: { nombre_completo: 'RC2 incompleto' }, citas: { id_barberia: BARBERIA_ID } }
    }),
    (res) => res.status === 400 && res.json?.ok === false && res.json?.code === 'datos_invalidos'
  );

  const evidence = await runSql(`
    SELECT json_build_object(
      'citas',
      (
        SELECT COALESCE(json_agg(row_to_json(x)), '[]'::json)
        FROM (
          SELECT id, barberia_id, barbero_id, servicio_id, cliente_id, cliente_nombre, cliente_tel, fecha, hora_inicio, hora_fin, estado
          FROM public.citas
          WHERE barberia_id = ${BARBERIA_ID}
            AND cliente_tel LIKE '300RC2%'
          ORDER BY id DESC
          LIMIT 10
        ) x
      ),
      'clientes_finales',
      (
        SELECT COALESCE(json_agg(row_to_json(y)), '[]'::json)
        FROM (
          SELECT id, barberia_id, nombre, telefono
          FROM public.clientes_finales
          WHERE barberia_id = ${BARBERIA_ID}
            AND telefono LIKE '300RC2%'
          ORDER BY id DESC
          LIMIT 10
        ) y
      )
    ) AS result;
  `);
  console.log(JSON.stringify({ name: 'evidencia_sql', pass: true, body: evidence }, null, 2));

  if (createdCitaIds.length) {
    await runSql(`
      UPDATE public.citas
      SET estado = 'cancelada'
      WHERE id IN (${createdCitaIds.join(',')});
      SELECT json_build_object('ok', true, 'code', 'cleanup_canceladas', 'cita_ids', ARRAY[${createdCitaIds.join(',')}]) AS result;
    `);
  }
}

main().catch(async (error) => {
  console.error(error.message);
  if (createdCitaIds.length) {
    try {
      await runSql(`UPDATE public.citas SET estado = 'cancelada' WHERE id IN (${createdCitaIds.join(',')}); SELECT json_build_object('ok', true) AS result;`);
    } catch (_) {}
  }
  process.exit(1);
});
