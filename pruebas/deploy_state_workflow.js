const https = require('https');
const fs = require('fs');
const path = require('path');

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
  try {
    console.log('Building Dashboard State Workflow definition...');
    const definition = {
      name: "BarberAgency - Dashboard State Webhook",
      nodes: [
        {
          parameters: {
            httpMethod: "GET",
            path: "barberagency/dashboard/state",
            responseMode: "responseNode",
            options: {}
          },
          id: "webhook-trigger-id",
          name: "Webhook",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1.1,
          position: [100, 400]
        },
        {
          parameters: {
            jsCode: "const i = $input.first().json || {};\nconst h = i.headers || {};\nconst cookieHeader = (h.cookie ?? h.Cookie ?? '').toString();\nconst m = cookieHeader.match(/(?:^|;\\s*)ba_session=([^;]+)/);\nconst session_token = m ? m[1] : '';\nreturn [{ json: { session_token } }];"
          },
          id: "parse-cookie",
          name: "Code - parse cookie",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [300, 400]
        },
        {
          parameters: {
            operation: "verify",
            token: "={{ $json.session_token }}",
            options: {
              algorithm: "HS256"
            }
          },
          id: "verify-session",
          name: "JWT - Verify session",
          type: "n8n-nodes-base.jwt",
          typeVersion: 1,
          position: [500, 400],
          credentials: {
            jwtAuth: {
              id: "mNWhzdM1ihAaBkZM",
              name: "JWT Auth account"
            }
          },
          continueOnFail: true
        },
        {
          parameters: {
            jsCode: "const i = $input.first().json || {};\nconst query = $('Webhook').first().json.query || {};\n\nconst slug = query.slug || query.barberia_slug || null;\nconst idRaw = query.barberia_id || query.id_barberia || null;\nconst barberia_id = idRaw ? Number(idRaw) : 0;\n\nconst auth_ok = !i.error && !!i.payload?.user_id;\nconst user_id = auth_ok ? Number(i.payload.user_id) : 0;\n\nconst params = [\n  user_id,\n  barberia_id,\n  slug,\n  auth_ok\n];\n\nreturn [{ json: { \n  auth_ok, \n  user_id, \n  barberia_id,\n  slug,\n  params\n} }];"
          },
          id: "claims-input",
          name: "Code - claims input",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [700, 400]
        },
        {
          parameters: {
            resource: "database",
            operation: "executeQuery",
            query: "WITH target_barberia AS (\n  SELECT id, slug, owner_id, email_contacto FROM public.barberias\n  WHERE (\n    ($2::int > 0 AND id = $2::int) OR\n    (($2::int IS NULL OR $2::int = 0) AND slug = $3::text)\n  ) AND deleted_at IS NULL\n),\nauth_check AS (\n  SELECT id, role, email FROM public.usuarios WHERE id = $1 LIMIT 1\n),\nbarberia_check AS (\n  SELECT tb.id FROM target_barberia tb\n  LEFT JOIN auth_check ac ON true\n  WHERE (\n    tb.owner_id = $1 OR\n    lower(COALESCE(tb.email_contacto, '')) = lower(COALESCE(ac.email, '')) OR\n    EXISTS (SELECT 1 FROM public.barberos WHERE usuario_id = $1 AND barberia_id = tb.id)\n  )\n  AND ($2::int IS NULL OR $2::int = 0 OR tb.slug IS NULL OR $3::text IS NULL OR tb.slug = $3::text)\n  LIMIT 1\n)\nSELECT\n  $4::boolean AS auth_ok_jwt,\n  EXISTS (SELECT 1 FROM auth_check) AS auth_ok,\n  EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,\n  COALESCE(\n    (SELECT role FROM auth_check) IN ('admin', 'owner', 'super_admin', 'barbero', 'cajero'),\n    false\n  ) AS role_ok,\n  (SELECT id FROM target_barberia LIMIT 1) AS validated_barberia_id,\n  (SELECT role FROM auth_check) AS user_role;",
            options: {
              queryReplacement: "={{ $json.params }}"
            }
          },
          id: "session-validate",
          name: "Postgres - session validate",
          type: "n8n-nodes-base.postgres",
          typeVersion: 2.4,
          position: [900, 400],
          credentials: {
            postgres: {
              id: "SOV6oSyuHI9cxgLF",
              name: "Postgres account"
            }
          }
        },
        {
          parameters: {
            jsCode: "const i = $input.first().json || {};\n\nlet ok = false;\nlet status_code = 200;\nlet message = '';\n\nif (!i.auth_ok_jwt || !i.auth_ok) {\n  status_code = 401;\n  message = 'Sesion no valida';\n} else if (!i.barberia_ok) {\n  status_code = 403;\n  message = 'No tienes permisos para esta barberia o no existe';\n} else if (!i.role_ok) {\n  status_code = 403;\n  message = 'Tu rol no tiene permisos para acceder al dashboard';\n} else {\n  ok = true;\n}\n\nreturn [{ json: { ok, status_code, message, validated_barberia_id: i.validated_barberia_id } }];"
          },
          id: "check-validation",
          name: "Check validation",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [1100, 400]
        },
        {
          parameters: {
            conditions: {
              combinator: "and",
              conditions: [
                {
                  leftValue: "={{ $json.ok }}",
                  rightValue: true,
                  caseSensitive: true,
                  operator: {
                    type: "boolean",
                    operation: "equals"
                  }
                }
              ]
            },
            looseTypeValidation: true,
            options: {}
          },
          id: "if-validation-ok",
          name: "IF - Validation OK",
          type: "n8n-nodes-base.if",
          typeVersion: 2.2,
          position: [1300, 400]
        },
        {
          parameters: {
            respondWith: "json",
            responseBody: "={{ { ok: false, message: $json.message } }}",
            options: {
              responseCode: "={{ $json.status_code }}",
              responseHeaders: {
                entries: [
                  {
                    name: "Access-Control-Allow-Origin",
                    value: "https://barberagency-barberagency.gymh5g.easypanel.host"
                  },
                  {
                    name: "Access-Control-Allow-Methods",
                    value: "GET, OPTIONS"
                  },
                  {
                    name: "Access-Control-Allow-Headers",
                    value: "*"
                  },
                  {
                    name: "Access-Control-Allow-Credentials",
                    value: "true"
                  }
                ]
              }
            }
          },
          id: "respond-error",
          name: "Respond - error",
          type: "n8n-nodes-base.respondToWebhook",
          typeVersion: 1.1,
          position: [1500, 550]
        },
        {
          parameters: {
            resource: "database",
            operation: "executeQuery",
            query: "SELECT json_build_object(\n  'barberia', (SELECT row_to_json(b) FROM (SELECT * FROM public.barberias WHERE id = $1) b),\n  'servicios', (SELECT COALESCE(json_agg(s), '[]'::json) FROM (SELECT * FROM public.servicios WHERE barberia_id = $1) s),\n  'barberos', (SELECT COALESCE(json_agg(ba), '[]'::json) FROM (SELECT * FROM public.barberos WHERE barberia_id = $1 ) ba),\n  'horarios', (SELECT COALESCE(json_agg(h), '[]'::json) FROM (SELECT * FROM public.horarios WHERE barberia_id = $1 ORDER BY dia_semana ASC) h),\n  'clientes', (SELECT COALESCE(json_agg(cl), '[]'::json) FROM (SELECT * FROM public.clientes_finales WHERE barberia_id = $1 ORDER BY id DESC) cl),\n  'reservas', (\n    SELECT COALESCE(json_agg(ci), '[]'::json) FROM (\n      SELECT\n        c.*,\n        c.barberia_id AS dashboard_barberia_id,\n        c.barbero_id AS dashboard_barbero_id,\n        c.servicio_id AS dashboard_servicio_id,\n        c.cliente_id AS dashboard_cliente_id,\n        s.nombre AS servicio_nombre,\n        s.precio AS precio,\n        b.nombre AS barbero_nombre,\n        COALESCE(cf.nombre, c.cliente_nombre) AS dashboard_cliente_nombre,\n        COALESCE(cf.telefono, c.cliente_tel) AS dashboard_cliente_tel,\n        p.id AS pago_id,\n        p.total AS total_pagado,\n        p.metodo AS metodo_pago,\n        p.pagado_en AS pagado_en\n      FROM public.citas c\n      LEFT JOIN public.servicios s ON c.servicio_id = s.id\n      LEFT JOIN public.barberos b ON c.barbero_id = b.id\n      LEFT JOIN public.clientes_finales cf ON c.cliente_id = cf.id\n      LEFT JOIN public.pagos p ON c.id = p.cita_id\n      WHERE c.barberia_id = $1\n      ORDER BY c.fecha DESC, c.hora_inicio DESC\n    ) ci\n  )\n) AS result;",
            options: {
              queryReplacement: "={{ [$json.validated_barberia_id] }}"
            }
          },
          id: "pg-fetch-aggregated-data",
          name: "PG - Fetch Aggregated Data",
          type: "n8n-nodes-base.postgres",
          typeVersion: 2.4,
          position: [1500, 250],
          credentials: {
            postgres: {
              id: "SOV6oSyuHI9cxgLF",
              name: "Postgres account"
            }
          }
        },
        {
          parameters: {
            mode: "runOnceForAllItems",
            language: "javaScript",
            jsCode: "const data = $input.first().json.result || {};\nconst barberia = data.barberia || {};\nconst servicios = data.servicios || [];\nconst barberos = data.barberos || [];\nconst horarios = data.horarios || [];\nconst clientes = data.clientes || [];\nconst reservas = data.reservas || [];\n\nconst firstText = (...values) => values.map(v => (v ?? '').toString().trim()).find(Boolean) || '';\nconst firstNumber = (...values) => {\n  for (const value of values) {\n    const n = Number(value);\n    if (Number.isFinite(n) && n > 0) return n;\n  }\n  return null;\n};\n\nconst mappedServices = servicios.map(s => ({\n  id: s.id,\n  barberia_id: s.barberia_id,\n  nombre: s.nombre,\n  duracion_min: s.duracion_min,\n  precio: s.precio,\n  activo: s.activo,\n  imagen_url: s.imagen_url\n}));\n\nconst mappedBarbers = barberos.map(b => ({\n  id: b.id,\n  barberia_id: b.barberia_id,\n  nombre: b.nombre,\n  activo: b.activo,\n  usuario_id: b.usuario_id,\n  foto_url: b.foto_url\n}));\n\nconst mappedHours = horarios.map(h => ({\n  id: h.id,\n  barberia_id: h.barberia_id,\n  dia_semana: h.dia_semana,\n  activo: h.activo,\n  hora_abre: h.hora_abre,\n  hora_cierra: h.hora_cierra\n}));\n\nconst mappedClients = clientes.map(c => ({\n  id: c.id,\n  barberia_id: firstNumber(c.barberia_id),\n  nombre: firstText(c.nombre),\n  telefono: firstText(c.telefono),\n  created_at: c.created_at\n}));\n\nconst mappedReservations = reservas.map(c => ({\n  id: c.id,\n  barberia_id: firstNumber(c.dashboard_barberia_id, c.barberia_id),\n  barbero_id: firstNumber(c.dashboard_barbero_id, c.barbero_id),\n  id_barbero: firstNumber(c.dashboard_barbero_id, c.barbero_id),\n  servicio_id: firstNumber(c.dashboard_servicio_id, c.servicio_id),\n  id_servicio: firstNumber(c.dashboard_servicio_id, c.servicio_id),\n  cliente_id: firstNumber(c.dashboard_cliente_id, c.cliente_id),\n  cliente_nombre: firstText(c.dashboard_cliente_nombre, c.cliente_nombre),\n  cliente_tel: firstText(c.dashboard_cliente_tel, c.cliente_tel),\n  fecha: firstText(c.fecha),\n  hora_inicio: firstText(c.hora_inicio),\n  hora_fin: firstText(c.hora_fin),\n  servicio_nombre: firstText(c.servicio_nombre),\n  barbero_nombre: firstText(c.barbero_nombre),\n  estado: firstText(c.estado) || 'confirmada',\n  total: Number(c.total || c.precio || 0),\n  pago_id: c.pago_id ? Number(c.pago_id) : null,\n  total_pagado: c.total_pagado ? Number(c.total_pagado) : null,\n  metodo_pago: c.metodo_pago || null,\n  pagado_en: c.pagado_en || null,\n  created_at: c.created_at\n}));\n\nconst now = new Date();\nconst todayDay = now.getDate();\nconst todayMonth = now.getMonth();\nconst todayYear = now.getFullYear();\nconst todayDateString = todayYear + \"-\" + String(todayMonth + 1).padStart(2, \"0\") + \"-\" + String(todayDay).padStart(2, \"0\");\n\nconst todayCitas = mappedReservations.filter(r => String(r.fecha || '').startsWith(todayDateString));\nconst monthlyIncome = mappedReservations.reduce((sum, r) => sum + Number(r.total || 0), 0);\n\nconst response = {\n  ok: true,\n  identity: {\n    barberia_id: barberia.id || null,\n    slug: barberia.slug || null\n  },\n  seed: {\n    id: barberia.id,\n    nombre: barberia.nombre,\n    slug: barberia.slug,\n    services: mappedServices,\n    barbers: mappedBarbers,\n    hours: mappedHours,\n    clients: mappedClients,\n    appointments: mappedReservations\n  },\n  merged: {\n    biz_name: barberia.nombre,\n    biz_slug: barberia.slug,\n    services: mappedServices,\n    barbers: mappedBarbers,\n    hours: mappedHours,\n    clients: mappedClients,\n    appointments: mappedReservations\n  },\n  barberia: barberia,\n  reservas: mappedReservations,\n  clientes: mappedClients,\n  metricas: {\n    ingresos_mensuales: monthlyIncome,\n    citas_hoy: todayCitas.length,\n    nuevos_clientes: mappedClients.length\n  },\n  barberos: mappedBarbers,\n  servicios: mappedServices\n};\n\nreturn [{ json: response }];"
          },
          id: "code-format-response",
          name: "Format Response",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [1700, 250]
        },
        {
          parameters: {
            respondWith: "json",
            responseBody: "={{ $json }}",
            options: {
              responseCode: 200,
              responseHeaders: {
                entries: [
                  {
                    name: "Access-Control-Allow-Origin",
                    value: "https://barberagency-barberagency.gymh5g.easypanel.host"
                  },
                  {
                    name: "Access-Control-Allow-Methods",
                    value: "GET, OPTIONS"
                  },
                  {
                    name: "Access-Control-Allow-Headers",
                    value: "*"
                  },
                  {
                    name: "Access-Control-Allow-Credentials",
                    value: "true"
                  }
                ]
              }
            }
          },
          id: "respond-ok",
          name: "Respond - ok",
          type: "n8n-nodes-base.respondToWebhook",
          typeVersion: 1.1,
          position: [1900, 250]
        }
      ],
      connections: {
        "Webhook": {
          "main": [[{ node: "Code - parse cookie", type: "main", index: 0 }]]
        },
        "Code - parse cookie": {
          "main": [[{ node: "JWT - Verify session", type: "main", index: 0 }]]
        },
        "JWT - Verify session": {
          "main": [[{ node: "Code - claims input", type: "main", index: 0 }]]
        },
        "Code - claims input": {
          "main": [[{ node: "Postgres - session validate", type: "main", index: 0 }]]
        },
        "Postgres - session validate": {
          "main": [[{ node: "Check validation", type: "main", index: 0 }]]
        },
        "Check validation": {
          "main": [[{ node: "IF - Validation OK", type: "main", index: 0 }]]
        },
        "IF - Validation OK": {
          "main": [
            [{ node: "PG - Fetch Aggregated Data", type: "main", index: 0 }],
            [{ node: "Respond - error", type: "main", index: 0 }]
          ]
        },
        "PG - Fetch Aggregated Data": {
          "main": [[{ node: "Format Response", type: "main", index: 0 }]]
        },
        "Format Response": {
          "main": [[{ node: "Respond - ok", type: "main", index: 0 }]]
        }
      },
      settings: {}
    };

    console.log('Checking for existing Dashboard State Workflow...');
    const wfs = await req('GET', '/api/v1/workflows');
    const existing = wfs.data.find(w => w.name === definition.name);
    
    let workflowId = '6JugRzxsOGKBvgWW';
    if (existing) {
      console.log(`Found existing workflow with ID: ${existing.id}. Updating it...`);
      workflowId = existing.id;
      
      // Save backup
      fs.writeFileSync(
        path.join(__dirname, 'dashboard_state_workflow_backup.json'), 
        JSON.stringify(existing, null, 2), 
        'utf8'
      );
      console.log('Backup saved to dashboard_state_workflow_backup.json');

      await req('PUT', `/api/v1/workflows/${workflowId}`, {
        name: definition.name,
        nodes: definition.nodes,
        connections: definition.connections,
        settings: definition.settings
      });
      console.log('Workflow updated successfully.');
    } else {
      console.log('Workflow not found. Creating a new one...');
      const created = await req('POST', '/api/v1/workflows', definition);
      workflowId = created.id;
      console.log(`Workflow created with ID: ${workflowId}`);
    }

    console.log('Making sure the workflow is active...');
    // Deactivate first
    await req('POST', `/api/v1/workflows/${workflowId}/deactivate`).catch(() => {});
    // Reactivate
    const activation = await req('POST', `/api/v1/workflows/${workflowId}/activate`);
    console.log('Workflow is active:', activation.active);
    
    // Also save the definition we deployed
    fs.writeFileSync(
      path.join(__dirname, 'dashboard_state_workflow.json'), 
      JSON.stringify(definition, null, 2), 
      'utf8'
    );
    console.log('Saved current definition to dashboard_state_workflow.json');
    console.log('--- DEPLOYMENT SUCCESSFUL ---');

  } catch (error) {
    console.error('Error during deployment:', error);
    process.exit(1);
  }
})();
