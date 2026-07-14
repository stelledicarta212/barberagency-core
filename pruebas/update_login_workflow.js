const https = require('https');

const API_KEY = process.env.N8N_API_KEY;
if (!API_KEY) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}
const WORKFLOW_ID = 'oAQzjkGzCuCjT1EP';
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
  console.log('=== UPDATING N8N LOGIN WORKFLOW ===');
    // 1. Define nodes
    const nodes = [
      {
        "parameters": {
          "httpMethod": "POST",
          "path": "barberagency/dashboard/login",
          "responseMode": "responseNode",
          "options": {}
        },
        "id": "webhook-dashboard-login",
        "name": "Webhook",
        "type": "n8n-nodes-base.webhook",
        "typeVersion": 1.1,
        "position": [
          100,
          300
        ]
      },
      {
        "parameters": {
          "mode": "runOnceForAllItems",
          "language": "javaScript",
          "jsCode": "\n            const input = $input.first().json || {};\n            const body = input.body && typeof input.body === \"object\" ? input.body : input;\n            const barberiaId = Number(body.barberia_id || body.id_barberia || 0);\n            return [{\n              json: {\n                email: String(body.email || \"\").trim().toLowerCase(),\n                password: String(body.password || \"\"),\n                slug: String(body.slug || body.barberia_slug || \"\").trim(),\n                barberia_id: Number.isFinite(barberiaId) && barberiaId > 0 ? barberiaId : null\n              }\n            }];\n          "
        },
        "id": "code-normalize-login",
        "name": "Code - normalize",
        "type": "n8n-nodes-base.code",
        "typeVersion": 2,
        "position": [
          320,
          300
        ]
      },
      {
        "parameters": {
          "resource": "database",
          "operation": "executeQuery",
          "query": "\n            WITH input AS (\n              SELECT\n                NULLIF(lower(trim($1::text)), '') AS email_in,\n                NULLIF($2::text, '') AS password_in,\n                NULLIF(trim($3::text), '') AS slug_in,\n                $4::int AS barberia_id_in\n            ),\n            target_barberia AS (\n              SELECT b.*\n              FROM public.barberias b\n              JOIN input i ON (b.id = i.barberia_id_in OR b.slug = i.slug_in)\n              WHERE b.deleted_at IS NULL\n              ORDER BY b.id DESC\n              LIMIT 1\n            ),\n            auth_user AS (\n              SELECT u.id, u.nombre, u.email, u.role\n              FROM public.usuarios u\n              JOIN input i ON lower(u.email) = i.email_in\n              WHERE i.password_in IS NOT NULL\n                AND u.password_hash IS NOT NULL\n                AND public.fn_password_verify(i.password_in, u.password_hash) = true\n              LIMIT 1\n            ),\n            barber_match AS (\n              SELECT b.id AS barbero_id, b.nombre AS barbero_nombre\n              FROM public.barberos b\n              JOIN target_barberia tb ON tb.id = b.barberia_id\n              JOIN auth_user u ON u.id = b.usuario_id\n              WHERE b.activo = true\n              LIMIT 1\n            ),\n            resolved AS (\n              SELECT\n                tb.id AS barberia_id,\n                tb.slug,\n                tb.nombre AS barberia_nombre,\n                tb.owner_id,\n                tb.email_contacto,\n                u.id AS user_id,\n                u.nombre AS user_nombre,\n                u.email,\n                COALESCE(NULLIF(u.role, ''), 'guest') AS db_role,\n                bm.barbero_id,\n                bm.barbero_nombre,\n                CASE\n                  WHEN u.id IS NULL THEN 'invalid_credentials'\n                  WHEN tb.id IS NULL THEN 'barberia_not_found'\n                  WHEN COALESCE(NULLIF(u.role, ''), 'guest') IN ('admin', 'owner', 'super_admin')\n                    AND (\n                      tb.owner_id = u.id OR \n                      EXISTS (\n                        SELECT 1 FROM public.barberia_miembros m \n                        WHERE m.barberia_id = tb.id \n                          AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) \n                          AND m.rol IN ('owner', 'admin', 'super_admin')\n                          AND m.activo = true\n                      )\n                    )\n                    THEN 'allowed_admin'\n                  WHEN COALESCE(NULLIF(u.role, ''), 'guest') = 'barbero' AND (\n                    bm.barbero_id IS NOT NULL OR\n                    EXISTS (\n                      SELECT 1 FROM public.barberia_miembros m \n                      WHERE m.barberia_id = tb.id \n                        AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) \n                        AND m.rol = 'barbero'\n                        AND m.activo = true\n                    )\n                  )\n                    THEN 'allowed_barbero'\n                  WHEN COALESCE(NULLIF(u.role, ''), 'guest') = 'cajero' AND (\n                    tb.owner_id = u.id OR \n                    bm.barbero_id IS NOT NULL OR\n                    EXISTS (\n                      SELECT 1 FROM public.barberia_miembros m \n                      WHERE m.barberia_id = tb.id \n                        AND (m.usuario_id = u.id OR lower(m.email) = lower(u.email)) \n                        AND m.rol IN ('owner', 'admin', 'cajero')\n                        AND m.activo = true\n                    )\n                  )\n                    THEN 'allowed_cajero'\n                  ELSE 'forbidden'\n                END AS access_status\n              FROM input i\n              LEFT JOIN target_barberia tb ON true\n              LEFT JOIN auth_user u ON true\n              LEFT JOIN barber_match bm ON true\n            )\n            SELECT json_build_object(\n              'ok', access_status IN ('allowed_admin', 'allowed_barbero', 'allowed_cajero'),\n              'status', access_status,\n              'identity', json_build_object('barberia_id', barberia_id, 'slug', slug),\n              'user', json_build_object('id', user_id, 'nombre', user_nombre, 'email', email, 'role', db_role, 'barbero_id', barbero_id),\n              'role', CASE\n                WHEN access_status = 'allowed_admin' THEN 'admin'\n                WHEN access_status = 'allowed_barbero' THEN 'barbero'\n                WHEN access_status = 'allowed_cajero' THEN 'cajero'\n                ELSE db_role\n              END,\n              'message', CASE\n                WHEN access_status = 'invalid_credentials' THEN 'Credenciales invalidas'\n                WHEN access_status = 'barberia_not_found' THEN 'Barberia no encontrada'\n                WHEN access_status = 'forbidden' THEN 'Usuario sin acceso a esta barberia'\n                ELSE 'Login correcto'\n              END\n            ) AS result\n            FROM resolved;\n          ",
        "options": {
          "queryReplacement": "={{ [($json.email ?? '').toString(), ($json.password ?? '').toString(), ($json.slug ?? '').toString(), Number($json.barberia_id ?? 0)] }}"
        }
      },
      "id": "pg-login",
      "name": "PG - login",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.4,
      "position": [
        560,
        300
      ],
      "credentials": {
        "postgres": {
          "id": "SOV6oSyuHI9cxgLF",
          "name": "Postgres account"
        }
      }
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "\n            const result = $input.first().json.result || {};\n            const role = result.role || result.user?.role || \"admin\";\n            const all = {\n              canViewDashboard: true,\n              canViewAppointments: true,\n              canViewClients: true,\n              canViewBarbers: true,\n              canViewServices: true,\n              canViewLoyalty: true,\n              canViewPOS: true,\n              canViewSettings: true,\n              canViewSupport: true,\n              canEditLanding: true,\n              canPublishLanding: true,\n              canChargePOS: true,\n              canViewGlobalFinance: true\n            };\n            const matrix = {\n              admin: all,\n              owner: all,\n              super_admin: all,\n              barbero: {\n                canViewDashboard: true,\n                canViewAppointments: true,\n                canViewClients: false,\n                canViewBarbers: false,\n                canViewServices: false,\n                canViewLoyalty: false,\n                canViewPOS: false,\n                canViewSettings: false,\n                canViewSupport: true,\n                canEditLanding: false,\n                canPublishLanding: false,\n                canChargePOS: false,\n                canViewGlobalFinance: false\n              },\n              cajero: {\n                canViewDashboard: true,\n                canViewAppointments: true,\n                canViewClients: true,\n                canViewBarbers: false,\n                canViewServices: false,\n                canViewLoyalty: false,\n                canViewPOS: true,\n                canViewSettings: false,\n                canViewSupport: true,\n                canEditLanding: false,\n                canPublishLanding: false,\n                canChargePOS: true,\n                canViewGlobalFinance: false\n              }\n            };\n            const none = {\n              canViewDashboard: false,\n              canViewAppointments: false,\n              canViewClients: false,\n              canViewBarbers: false,\n              canViewServices: false,\n              canViewLoyalty: false,\n              canViewPOS: false,\n              canViewSettings: false,\n              canViewSupport: false,\n              canEditLanding: false,\n              canPublishLanding: false,\n              canChargePOS: false,\n              canViewGlobalFinance: false\n            };\n            const response = {\n              ...result,\n              permissions: result.ok ? (matrix[role] || matrix.admin) : none\n            };\n            return [{ json: response }];\n          "
      },
      "id": "code-format-login",
      "name": "Code - format",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        760,
        300
      ]
    },
    {
      "parameters": {
        "operation": "sign",
        "useJson": true,
        "claimsJson": "={{ { \"role\":\"authenticated\", \"sub\": String($json.user.id), \"user_id\": Number($json.user.id), \"email\": ($json.user.email ?? null), \"exp\": Math.floor(Date.now()/1000) + 604800 } }}",
        "options": {
          "algorithm": "HS256"
        }
      },
      "id": "session-jwt-sign",
      "name": "JWT - Sign session",
      "type": "n8n-nodes-base.jwt",
      "typeVersion": 1,
      "position": [
        940,
        300
      ],
      "credentials": {
        "jwtAuth": {
          "id": "mNWhzdM1ihAaBkZM",
          "name": "JWT Auth account"
        }
      }
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const pgItems = $items('Code - format', 0, 0) || [];\nconst base = pgItems[0]?.json || {};\nconst jwtOut = $input.first().json || {};\nconst token = jwtOut.token ?? null;\n\nconst clearCookie = 'ba_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax';\n\nif (!base.ok || !base.user?.id) {\n  return [{\n    json: {\n      ...base,\n      set_cookie: clearCookie,\n    }\n  }];\n}\n\nif (!token) {\n  return [{\n    json: {\n      ...base,\n      ok: false,\n      message: 'Token de session no generado',\n      set_cookie: clearCookie,\n    }\n  }];\n}\n\nconst maxAge = 604800;\nconst cookie = 'ba_session=' + token + '; Path=/; Max-Age=' + maxAge + '; HttpOnly; Secure; SameSite=Lax';\n\nreturn [{\n  json: {\n    ...base,\n    set_cookie: cookie,\n  }\n}];"
      },
      "id": "code-build-cookie",
      "name": "Code - build cookie",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1120,
        300
      ]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json }}",
        "options": {
          "responseCode": "={{ $json.ok ? 200 : ($json.status === 'barberia_not_found' ? 404 : ($json.status === 'forbidden' ? 403 : 401)) }}",
          "responseHeaders": {
            "entries": [
              {
                "name": "Access-Control-Allow-Origin",
                "value": "*"
              },
              {
                "name": "Access-Control-Allow-Methods",
                "value": "POST, OPTIONS"
              },
              {
                "name": "Access-Control-Allow-Headers",
                "value": "*"
              },
              {
                "name": "Set-Cookie",
                "value": "={{ $json.set_cookie }}"
              }
            ]
          }
        }
      },
      "id": "respond-login",
      "name": "Respond",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [
        1300,
        300
      ]
    }
  ];

  // 2. Define connections
  const connections = {
    "Webhook": {
      "main": [
        [
          {
            "node": "Code - normalize",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code - normalize": {
      "main": [
        [
          {
            "node": "PG - login",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "PG - login": {
      "main": [
        [
          {
            "node": "Code - format",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code - format": {
      "main": [
        [
          {
            "node": "JWT - Sign session",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "JWT - Sign session": {
      "main": [
        [
          {
            "node": "Code - build cookie",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Code - build cookie": {
      "main": [
        [
          {
            "node": "Respond",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  };

  try {
    // 3. Deactivate
    console.log('Deactivating workflow...');
    await req('POST', `/api/v1/workflows/${WORKFLOW_ID}/deactivate`);
    
    // 4. Update
    console.log('Updating workflow definition...');
    await req('PUT', `/api/v1/workflows/${WORKFLOW_ID}`, {
      name: "BarberAgency - Dashboard Password Login",
      nodes,
      connections,
      settings: {}
    });
    
    // 5. Activate
    console.log('Activating workflow...');
    await req('POST', `/api/v1/workflows/${WORKFLOW_ID}/activate`);
    
    console.log('Workflow successfully updated and activated! 🎉');
  } catch (err) {
    console.error('Error updating workflow:', err);
  }
})();
