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
    console.log('Building Citas Admin Workflow definition...');
    const definition = {
      name: "BarberAgency - Dashboard Citas Admin",
      nodes: [
        {
          parameters: {
            httpMethod: "POST",
            path: "barberagency/dashboard/citas",
            responseMode: "responseNode",
            options: {
              responseHeaders: {
                entries: [
                  {
                    name: "Access-Control-Allow-Origin",
                    "value": "https://barberagency-barberagency.gymh5g.easypanel.host"
                  },
                  {
                    name: "Access-Control-Allow-Methods",
                    "value": "POST, OPTIONS"
                  },
                  {
                    name: "Access-Control-Allow-Headers",
                    "value": "*"
                  },
                  {
                    name: "Access-Control-Allow-Credentials",
                    "value": "true"
                  }
                ]
              }
            }
          },
          id: "webhook-trigger",
          name: "Webhook - Citas Admin",
          type: "n8n-nodes-base.webhook",
          typeVersion: 2.1,
          position: [100, 300]
        },
        {
          parameters: {
            jsCode: "const i = $input.first().json || {};\nconst h = i.headers || {};\nconst cookieHeader = (h.cookie ?? h.Cookie ?? '').toString();\nconst m = cookieHeader.match(/(?:^|;\\s*)ba_session=([^;]+)/);\nconst session_token = m ? m[1] : '';\nreturn [{ json: { session_token } }];"
          },
          id: "parse-cookie",
          name: "Code - parse cookie",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [300, 300]
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
          position: [500, 300],
          credentials: {
            jwtAuth: {
              id: "mNWhzdM1ihAaBkZM",
              "name": "JWT Auth account"
            }
          },
          continueOnFail: true
        },
        {
          parameters: {
            jsCode: "const i = $input.first().json || {};\nconst body = $('Webhook - Citas Admin').first().json.body || {};\nconst action = body.action || '';\nconst auth_ok = !i.error && !!i.payload?.user_id;\nconst user_id = auth_ok ? Number(i.payload.user_id) : 0;\n\nconst params = [\n  user_id,\n  Number(body.barberia_id ?? 0),\n  action,\n  Number(body.id ?? body.cita_id ?? 0),\n  body.barbero_id ? Number(body.barbero_id) : null,\n  body.servicio_id ? Number(body.servicio_id) : null,\n  auth_ok\n];\n\nreturn [{ json: { \n  auth_ok, \n  user_id, \n  barberia_id: Number(body.barberia_id ?? 0),\n  action,\n  cita_id: Number(body.id ?? body.cita_id ?? 0),\n  params,\n  body\n} }];"
          },
          id: "claims-input",
          name: "Code - claims input",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [700, 300]
        },
        {
          parameters: {
            resource: "database",
            operation: "executeQuery",
            query: "WITH auth_check AS (\n  SELECT id FROM public.usuarios WHERE id = $1 LIMIT 1\n),\nbarberia_check AS (\n  SELECT id FROM public.barberias WHERE id = $2 AND owner_id = $1 AND deleted_at IS NULL LIMIT 1\n),\nbarbero_check AS (\n  SELECT 1 WHERE $5::int IS NULL OR EXISTS (\n    SELECT 1 FROM public.barberos WHERE id = $5::int AND barberia_id = $2\n  )\n),\nservicio_check AS (\n  SELECT 1 WHERE $6::int IS NULL OR EXISTS (\n    SELECT 1 FROM public.servicios WHERE id = $6::int AND barberia_id = $2\n  )\n),\ncita_check AS (\n  SELECT 1 WHERE $3::text = 'add_cita' OR EXISTS (\n    SELECT 1 FROM public.citas WHERE id = $4::int AND barberia_id = $2\n  )\n)\nSELECT\n  $7::boolean AS auth_ok_jwt,\n  EXISTS (SELECT 1 FROM auth_check) AS auth_ok,\n  EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,\n  EXISTS (SELECT 1 FROM barbero_check) AS barbero_ok,\n  EXISTS (SELECT 1 FROM servicio_check) AS servicio_ok,\n  EXISTS (SELECT 1 FROM cita_check) AS cita_ok;",
            options: {
              queryReplacement: "={{ $json.params }}"
            }
          },
          id: "session-validate",
          name: "Postgres - session validate",
          type: "n8n-nodes-base.postgres",
          typeVersion: 2.4,
          position: [900, 300],
          credentials: {
            postgres: {
              id: "SOV6oSyuHI9cxgLF",
              "name": "Postgres account"
            }
          }
        },
        {
          parameters: {
            jsCode: "const i = $input.first().json || {};\nconst claims = $('Code - claims input').first().json;\n\nlet ok = false;\nlet status_code = 200;\nlet message = '';\n\nif (!i.auth_ok_jwt || !i.auth_ok) {\n  status_code = 401;\n  message = 'Sesion no valida';\n} else if (!i.barberia_ok) {\n  status_code = 403;\n  message = 'No tienes permisos para esta barberia';\n} else if (!i.barbero_ok) {\n  status_code = 400;\n  message = 'El barbero no pertenece a esta barberia o no existe';\n} else if (!i.servicio_ok) {\n  status_code = 400;\n  message = 'El servicio no pertenece a esta barberia o no existe';\n} else if (!i.cita_ok) {\n  status_code = 403;\n  message = 'La cita no pertenece a esta barberia o no existe';\n} else {\n  ok = true;\n}\n\nreturn [{ json: { ok, status_code, message, action: claims.action, body: claims.body } }];"
          },
          id: "check-validation",
          name: "Check validation",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [1100, 300]
        },
        {
          parameters: {
            conditions: {
              options: {
                caseSensitive: true,
                typeValidation: "loose"
              },
              conditions: [
                {
                  id: "check-ok",
                  leftValue: "={{ $json.ok ? 'true' : 'false' }}",
                  rightValue: "true",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                }
              ],
              combinator: "and"
            }
          },
          id: "if-validated",
          name: "IF - validated",
          type: "n8n-nodes-base.if",
          typeVersion: 2.2,
          position: [1300, 300]
        },
        {
          parameters: {
            conditions: {
              options: {
                caseSensitive: true,
                typeValidation: "loose"
              },
              conditions: [
                {
                  id: "needs-client",
                  leftValue: "={{ $json.action }}",
                  rightValue: "cancel_cita",
                  operator: {
                    type: "string",
                    operation: "notEquals"
                  }
                }
              ]
            }
          },
          id: "if-needs-client",
          name: "IF - needs client",
          type: "n8n-nodes-base.if",
          typeVersion: 2.2,
          position: [1500, 300]
        },
        {
          parameters: {
            operation: "executeQuery",
            query: "INSERT INTO public.clientes_finales (barberia_id, nombre, telefono)\nVALUES ($1, $2, $3)\nON CONFLICT (barberia_id, telefono) \nDO UPDATE SET nombre = COALESCE(NULLIF(EXCLUDED.nombre, ''), clientes_finales.nombre)\nRETURNING id;",
            options: {
              queryReplacement: "={{ [Number($('Code - claims input').first().json.body.barberia_id), $('Code - claims input').first().json.body.cliente_nombre, $('Code - claims input').first().json.body.cliente_tel] }}"
            }
          },
          id: "pg-upsert-client",
          name: "PG - upsert client",
          type: "n8n-nodes-base.postgres",
          typeVersion: 2.4,
          position: [1700, 200],
          credentials: {
            postgres: {
              id: "SOV6oSyuHI9cxgLF",
              name: "Postgres account"
            }
          },
          continueOnFail: true
        },
        {
          parameters: {
            jsCode: "const i = $input.first().json || {};\nconst claims = $('Code - claims input').first().json;\nconst body = claims.body || {};\nconst action = claims.action || '';\nlet query = '';\nlet params = [];\n\nlet cliente_id = null;\nif (action !== 'cancel_cita') {\n  try {\n    const clientRes = $('PG - upsert client').first().json;\n    if (clientRes.error) {\n      return [{ json: { ok: false, message: 'Error al registrar o buscar el cliente: ' + (clientRes.error.message || '') } }];\n    }\n    cliente_id = clientRes.id;\n  } catch (e) {\n  }\n}\n\nif (action === 'add_cita') {\n  query = `\n    INSERT INTO public.citas (\n      barberia_id, cliente_nombre, cliente_tel, barbero_id, servicio_id, fecha, hora_inicio, estado, cliente_id\n    )\n    VALUES (\n      $1, $2, $3, $4, $5, $6::date, $7::time, $8, $9\n    )\n    RETURNING *;\n  `;\n  params = [\n    Number(body.barberia_id),\n    body.cliente_nombre,\n    body.cliente_tel,\n    body.barbero_id ? Number(body.barbero_id) : null,\n    body.servicio_id ? Number(body.servicio_id) : null,\n    body.fecha,\n    body.hora_inicio,\n    body.estado || 'confirmada',\n    cliente_id ? Number(cliente_id) : null\n  ];\n} else if (action === 'update_cita') {\n  query = `\n    UPDATE public.citas\n    SET\n      cliente_nombre = $2,\n      cliente_tel = $3,\n      barbero_id = $4,\n      servicio_id = $5,\n      fecha = $6::date,\n      hora_inicio = $7::time,\n      estado = $8,\n      cliente_id = $9\n    WHERE id = $10 AND barberia_id = $1\n    RETURNING *;\n  `;\n  params = [\n    Number(body.barberia_id),\n    body.cliente_nombre,\n    body.cliente_tel,\n    body.barbero_id ? Number(body.barbero_id) : null,\n    body.servicio_id ? Number(body.servicio_id) : null,\n    body.fecha,\n    body.hora_inicio,\n    body.estado || 'confirmada',\n    cliente_id ? Number(cliente_id) : null,\n    Number(body.id)\n  ];\n} else if (action === 'cancel_cita') {\n  query = `\n    UPDATE public.citas\n    SET estado = 'cancelada'\n    WHERE id = $1 AND barberia_id = $2\n    RETURNING *;\n  `;\n  params = [\n    Number(body.id),\n    Number(body.barberia_id)\n  ];\n} else {\n  return [{ json: { ok: false, message: 'Accion no permitida o desconocida.' } }];\n}\n\nreturn [{ json: { ok: true, query, params } }];"
          },
          id: "build-query",
          name: "Build query",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [1900, 300]
        },
        {
          parameters: {
            conditions: {
              options: {
                caseSensitive: true,
                typeValidation: "loose"
              },
              conditions: [
                {
                  id: "sql-ok",
                  leftValue: "={{ $json.ok ? 'true' : 'false' }}",
                  rightValue: "true",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                }
              ]
            }
          },
          id: "if-sql-ok",
          name: "IF - SQL listo",
          type: "n8n-nodes-base.if",
          typeVersion: 2.2,
          position: [2100, 300]
        },
        {
          parameters: {
            operation: "executeQuery",
            query: "={{ $json.query }}",
            options: {
              queryReplacement: "={{ $json.params }}"
            }
          },
          id: "pg-execute-query",
          name: "PG - execute query",
          type: "n8n-nodes-base.postgres",
          typeVersion: 2.4,
          position: [2300, 200],
          credentials: {
            postgres: {
              id: "SOV6oSyuHI9cxgLF",
              name: "Postgres account"
            }
          },
          continueOnFail: true
        },
        {
          parameters: {
            jsCode: "const input = $input.first().json;\nif (input.error) {\n  let errMsg = input.message || (input.error && input.error.description) || 'Error al ejecutar consulta en base de datos.';\n  errMsg = errMsg.replace(/^ERROR:\\s*/, '').split('\\n')[0];\n  if (errMsg.includes('ex_citas_no_solape')) {\n    errMsg = 'El barbero seleccionado ya tiene una cita agendada en ese horario.';\n  }\n  return [{ json: { ok: false, status_code: 400, message: errMsg } }];\n}\nreturn [{ json: { ok: true, data: input } }];"
          },
          id: "check-pg-output",
          name: "Check PG output",
          type: "n8n-nodes-base.code",
          typeVersion: 2,
          position: [2500, 200]
        },
        {
          parameters: {
            conditions: {
              options: {
                caseSensitive: true,
                typeValidation: "loose"
              },
              conditions: [
                {
                  id: "pg-ok",
                  leftValue: "={{ $json.ok ? 'true' : 'false' }}",
                  rightValue: "true",
                  operator: {
                    type: "string",
                    operation: "equals"
                  }
                }
              ]
            }
          },
          id: "if-pg-ok",
          name: "IF - PG ok",
          type: "n8n-nodes-base.if",
          typeVersion: 2.2,
          position: [2700, 200]
        },
        {
          parameters: {
            respondWith: "json",
            responseBody: "={{ { ok: true, message: \"Operacion realizada con exito.\", data: $json.data } }}",
            options: {
              responseCode: 200,
              responseHeaders: {
                entries: [
                  {
                    name: "Access-Control-Allow-Origin",
                    "value": "https://barberagency-barberagency.gymh5g.easypanel.host"
                  },
                  {
                    name: "Access-Control-Allow-Methods",
                    "value": "POST, OPTIONS"
                  },
                  {
                    name: "Access-Control-Allow-Headers",
                    "value": "*"
                  },
                  {
                    name: "Access-Control-Allow-Credentials",
                    "value": "true"
                  }
                ]
              }
            }
          },
          id: "respond-ok",
          name: "Respond - ok",
          type: "n8n-nodes-base.respondToWebhook",
          typeVersion: 1.1,
          position: [2900, 150]
        },
        {
          parameters: {
            respondWith: "json",
            responseBody: "={{ { ok: false, message: $json.message || \"Error al procesar operacion.\" } }}",
            options: {
              responseCode: "={{ Number($json.status_code ?? 400) }}",
              responseHeaders: {
                entries: [
                  {
                    name: "Access-Control-Allow-Origin",
                    "value": "https://barberagency-barberagency.gymh5g.easypanel.host"
                  },
                  {
                    name: "Access-Control-Allow-Methods",
                    "value": "POST, OPTIONS"
                  },
                  {
                    name: "Access-Control-Allow-Headers",
                    "value": "*"
                  },
                  {
                    name: "Access-Control-Allow-Credentials",
                    "value": "true"
                  }
                ]
              }
            }
          },
          id: "respond-error",
          name: "Respond - error",
          type: "n8n-nodes-base.respondToWebhook",
          typeVersion: 1.1,
          position: [2900, 450]
        }
      ],
      connections: {
        "Webhook - Citas Admin": {
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
          "main": [[{ node: "IF - validated", type: "main", index: 0 }]]
        },
        "IF - validated": {
          "main": [
            [{ node: "IF - needs client", type: "main", index: 0 }],
            [{ node: "Respond - error", type: "main", index: 0 }]
          ]
        },
        "IF - needs client": {
          "main": [
            [{ node: "PG - upsert client", type: "main", index: 0 }],
            [{ node: "Build query", type: "main", index: 0 }]
          ]
        },
        "PG - upsert client": {
          "main": [[{ node: "Build query", type: "main", index: 0 }]]
        },
        "Build query": {
          "main": [[{ node: "IF - SQL listo", type: "main", index: 0 }]]
        },
        "IF - SQL listo": {
          "main": [
            [{ node: "PG - execute query", type: "main", index: 0 }],
            [{ node: "Respond - error", type: "main", index: 0 }]
          ]
        },
        "PG - execute query": {
          "main": [[{ node: "Check PG output", type: "main", index: 0 }]]
        },
        "Check PG output": {
          "main": [[{ node: "IF - PG ok", type: "main", index: 0 }]]
        },
        "IF - PG ok": {
          "main": [
            [{ node: "Respond - ok", type: "main", index: 0 }],
            [{ node: "Respond - error", type: "main", index: 0 }]
          ]
        }
      },
      settings: {}
    };

    console.log('Checking for existing Citas Admin Workflow...');
    const wfs = await req('GET', '/api/v1/workflows');
    const existing = wfs.data.find(w => w.name === definition.name);
    
    let workflowId = '';
    if (existing) {
      workflowId = existing.id;
      console.log(`Found existing workflow with ID: ${workflowId}. Updating...`);
      await req('PUT', `/api/v1/workflows/${workflowId}`, {
        name: definition.name,
        nodes: definition.nodes,
        connections: definition.connections,
        settings: existing.settings || {}
      });
      console.log('Workflow updated.');
    } else {
      console.log('Creating new workflow in n8n...');
      const created = await req('POST', '/api/v1/workflows', definition);
      workflowId = created.id;
      console.log(`Workflow created with ID: ${workflowId}.`);
    }

    console.log('Deactivating workflow if active...');
    await req('POST', `/api/v1/workflows/${workflowId}/deactivate`).catch(() => {});
    
    console.log('Activating workflow...');
    const activation = await req('POST', `/api/v1/workflows/${workflowId}/activate`);
    console.log('Activation response:', JSON.stringify(activation, null, 2));
    
    console.log('DEPLOY SUCCESSFUL! 🚀');

    // Also write it to a local JSON backup file
    const backupPath = path.join(__dirname, 'citas_workflow.json');
    fs.writeFileSync(backupPath, JSON.stringify(definition, null, 2));
    console.log(`Saved definition backup to: ${backupPath}`);
  } catch (err) {
    console.error('DEPLOY ERROR:', err.message);
    process.exit(1);
  }
})();
