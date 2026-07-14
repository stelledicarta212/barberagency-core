const https = require('https');

const token = process.env.N8N_API_KEY;
if (!token) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}
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

function callWebhook(headers = {}, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: '/webhook/temp_step_test_2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
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
    name: "Temp Step Test 2 Webhook",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "temp_step_test_2",
          responseMode: "responseNode"
        },
        id: "webhook-trigger",
        name: "Webhook - Servicios Admin",
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
        id: "verify-jwt",
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
          jsCode: "const i = $input.first().json || {};\nconst body = $('Webhook - Servicios Admin').first().json.body || {};\nconst action = body.action || '';\nconst auth_ok = !i.error && !!i.payload?.user_id;\nconst user_id = auth_ok ? Number(i.payload.user_id) : 0;\n\nconst params = [\n  user_id,\n  Number(body.barberia_id ?? 0),\n  action,\n  Number(body.id ?? 0),\n  auth_ok\n];\n\nreturn [{ json: { \n  auth_ok, \n  user_id, \n  barberia_id: Number(body.barberia_id ?? 0),\n  action,\n  servicio_id: Number(body.id ?? 0),\n  params,\n  body\n} }];"
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
          query: "WITH auth_check AS (\n  SELECT id FROM public.usuarios WHERE id = $1 LIMIT 1\n),\nbarberia_check AS (\n  SELECT id FROM public.barberias WHERE id = $2 AND owner_id = $1 AND deleted_at IS NULL LIMIT 1\n),\nservicio_check AS (\n  SELECT 1\n  WHERE $3::text = 'add_servicio' OR EXISTS (\n    SELECT 1 FROM public.servicios WHERE id = $4::int AND barberia_id = $2\n  )\n)\nSELECT\n  $5::boolean AS auth_ok_jwt,\n  EXISTS (SELECT 1 FROM auth_check) AS auth_ok,\n  EXISTS (SELECT 1 FROM barberia_check) AS barberia_ok,\n  EXISTS (SELECT 1 FROM servicio_check) AS servicio_ok;",
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
          jsCode: "const i = $input.first().json || {};\nconst claims = $('Code - claims input').first().json;\n\nlet ok = false;\nlet status_code = 200;\nlet message = '';\n\nif (!i.auth_ok_jwt || !i.auth_ok) {\n  status_code = 401;\n  message = 'Sesion no valida';\n} else if (!i.barberia_ok) {\n  status_code = 403;\n  message = 'No tienes permisos para esta barberia';\n} else if (!i.servicio_ok) {\n  status_code = 403;\n  message = 'El servicio no pertenece a esta barberia o no existe';\n} else {\n  ok = true;\n}\n\nreturn [{ json: { ok, status_code, message, action: claims.action, body: claims.body } }];"
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
          },
          options: {}
        },
        id: "if-validated",
        name: "IF - validated",
        type: "n8n-nodes-base.if",
        typeVersion: 2.2,
        position: [1300, 300]
      },
      {
        parameters: {
          respondWith: "json",
          responseBody: "={{ { ok: false, message: $json.message || 'Error de validación' } }}",
          options: {
            responseCode: 401
          }
        },
        id: "respond-error",
        name: "Respond - error",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [1500, 400]
      },
      {
        parameters: {
          respondWith: "json",
          responseBody: "={{ { ok: true, msg: 'ok branch reached!' } }}",
          options: {
            responseCode: 200
          }
        },
        id: "respond-ok",
        name: "Respond - ok",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [1500, 200]
      }
    ],
    connections: {
      "Webhook - Servicios Admin": {
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
          [{ node: "Respond - ok", type: "main", index: 0 }],
          [{ node: "Respond - error", type: "main", index: 0 }]
        ]
      }
    },
    settings: {}
  };

  console.log('Creating test 2 workflow...');
  const res = await req('POST', '/api/v1/workflows', workflowDefinition);
  tempWorkflowId = res.id;
  console.log('Workflow created with ID:', tempWorkflowId);

  console.log('Activating test 2 workflow...');
  await req('POST', `/api/v1/workflows/${tempWorkflowId}/activate`);
  console.log('Workflow active.');
}

async function cleanup() {
  if (tempWorkflowId) {
    console.log('Deactivating test 2 workflow...');
    await req('POST', `/api/v1/workflows/${tempWorkflowId}/deactivate`).catch(() => {});
    console.log('Deleting test 2 workflow...');
    await req('DELETE', `/api/v1/workflows/${tempWorkflowId}`).catch(() => {});
    console.log('Cleanup completed.');
  }
}

(async () => {
  try {
    await setup();
    console.log('Calling test 2 webhook without cookie...');
    const result = await callWebhook({}, { barberia_id: 1, action: 'add_servicio' });
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await cleanup();
  }
})();
