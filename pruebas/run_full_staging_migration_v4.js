const fs = require('fs');
const path = require('path');
const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZWRlNzUwOC05OTdhLTQ0NzUtYjJiOC05YmUyZTNhNmE0MTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWQ4MDYyMDAtNWM4Ni00ZDQ1LWIyM2ItZDEyYzc2MmMwMGEyIiwiaWF0IjoxNzc1OTIxODk4fQ.S-gQd2FKYczqgzSIqxLv3tWTkS4mJk-lvt0DMAtmfKY';
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

function callWebhook(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: '/webhook/temp_postgres_exec_v4',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
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
    name: "Temp Postgres Exec Webhook V4",
    nodes: [
      {
        parameters: {
          httpMethod: "POST",
          path: "temp_postgres_exec_v4",
          responseMode: "responseNode"
        },
        id: "webhook-trigger",
        name: "Webhook",
        type: "n8n-nodes-base.webhook",
        typeVersion: 2.1,
        position: [250, 300]
      },
      {
        parameters: {
          operation: "executeQuery",
          query: "={{ $json.body.query }}"
        },
        id: "postgres-query",
        name: "PG - execute query",
        type: "n8n-nodes-base.postgres",
        typeVersion: 2.4,
        position: [450, 300],
        credentials: {
          postgres: {
            id: "SOV6oSyuHI9cxgLF",
            "name": "Postgres account"
          }
        },
        continueOnFail: false
      },
      {
        parameters: {
          jsCode: "const all = $input.all().map(item => item.json);\nreturn [{ json: { results: all } }];"
        },
        id: "aggregate-results",
        name: "Aggregate Results",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [650, 300]
      },
      {
        parameters: {
          respondWith: "json",
          responseBody: "={{ $json.results }}"
        },
        id: "respond-node",
        name: "Respond to Webhook",
        type: "n8n-nodes-base.respondToWebhook",
        typeVersion: 1.1,
        position: [850, 300]
      }
    ],
    connections: {
      "Webhook": {
        "main": [[{ node: "PG - execute query", type: "main", index: 0 }]]
      },
      "PG - execute query": {
        "main": [[{ node: "Aggregate Results", type: "main", index: 0 }]]
      },
      "Aggregate Results": {
        "main": [[{ node: "Respond to Webhook", type: "main", index: 0 }]]
      }
    },
    settings: {}
  };

  console.log('Creating temp workflow V4...');
  const res = await req('POST', '/api/v1/workflows', workflowDefinition);
  tempWorkflowId = res.id;
  console.log('Workflow created with ID:', tempWorkflowId);

  console.log('Activating temp workflow V4...');
  await req('POST', `/api/v1/workflows/${tempWorkflowId}/activate`);
  console.log('Workflow active.');
}

async function cleanup() {
  if (tempWorkflowId) {
    console.log('Deactivating temp workflow V4...');
    await req('POST', `/api/v1/workflows/${tempWorkflowId}/deactivate`).catch(() => {});
    console.log('Deleting temp workflow V4...');
    await req('DELETE', `/api/v1/workflows/${tempWorkflowId}`).catch(() => {});
    console.log('Cleanup completed.');
  }
}

async function runSQL(query) {
  const res = await callWebhook({ query });
  if (res.status !== 200) {
    throw new Error(`SQL query failed (HTTP ${res.status}): ${JSON.stringify(res.data)}`);
  }
  return res.data;
}

function getCleanStatements(sql) {
  let cleaned = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  let lines = cleaned.split('\n');
  let noComments = lines.map(line => {
    let trimmed = line.trim();
    let upper = trimmed.toUpperCase();
    if (trimmed.startsWith('--') || trimmed.startsWith('- ') || upper === 'BEGIN;' || upper === 'COMMIT;') {
      return '';
    }
    let idx = line.indexOf('--');
    if (idx !== -1) {
      return line.substring(0, idx);
    }
    return line;
  }).join('\n');

  let statements = [];
  let current = '';
  let inDollarQuote = false;
  let inSingleQuote = false;
  
  for (let i = 0; i < noComments.length; i++) {
    let char = noComments[i];
    let nextChar = noComments[i+1] || '';
    
    if (char === '$' && nextChar === '$') {
      inDollarQuote = !inDollarQuote;
      current += '$$';
      i++;
      continue;
    }
    
    if (char === "'" && !inDollarQuote) {
      inSingleQuote = !inSingleQuote;
    }
    
    if (char === ';' && !inDollarQuote && !inSingleQuote) {
      let stmt = current.trim();
      let upper = stmt.toUpperCase();
      if (stmt && upper !== 'BEGIN' && upper !== 'COMMIT') {
        statements.push(stmt + ';');
      }
      current = '';
    } else {
      current += char;
    }
  }
  
  let stmt = current.trim();
  let upper = stmt.toUpperCase();
  if (stmt && upper !== 'BEGIN' && upper !== 'COMMIT') {
    statements.push(stmt);
  }
  
  return statements;
}

const migrations = [
  {
    step: 1,
    name: '20260713_2026_add_plan_codes.sql',
    path: '../migrations/20260713_2026_add_plan_codes.sql',
    postcheck: `
      SELECT id, nombre, code, precio 
      FROM public.planes 
      ORDER BY id ASC;
    `
  },
  {
    step: 2,
    name: '20260713_2027_expand_billing_core_v2.sql',
    path: '../migrations/20260713_2027_expand_billing_core_v2.sql',
    postcheck: `
      SELECT pp.id, p.nombre AS plan_name, pp.name AS tier_name, pp.amount, pp.currency, pp.active
      FROM public.plan_prices pp
      JOIN public.planes p ON pp.plan_id = p.id
      ORDER BY p.id, pp.amount ASC;
    `
  },
  {
    step: 3,
    name: '20260713_2028_billing_roles_and_grants.sql',
    path: '../migrations/20260713_2028_billing_roles_and_grants.sql',
    postcheck: `
      SELECT table_name, privilege_type, grantee 
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'public' 
        AND table_name IN ('plan_prices', 'billing_invoices')
      ORDER BY table_name, privilege_type ASC;
    `
  },
  {
    step: 4,
    name: '20260713_2029_billing_rpc_core.sql',
    path: '../migrations/20260713_2029_billing_rpc_core.sql',
    postcheck: `
      SELECT routine_name, routine_type, security_type
      FROM information_schema.routines
      WHERE routine_schema = 'public' 
        AND routine_name IN ('billing_create_checkout', 'billing_register_webhook', 'billing_process_approved_payment')
      ORDER BY routine_name ASC;
    `
  },
  {
    step: 5,
    name: '20260713_2030_add_billing_outbox.sql',
    path: '../migrations/20260713_2030_add_billing_outbox.sql',
    postcheck: `
      SELECT table_name, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'billing_outbox';
    `
  }
];

(async () => {
  try {
    await setup();
    console.log('\n========================================');
    console.log('STARTING STAGING MIGRATION PIPELINE V4');
    console.log('========================================\n');

    for (const m of migrations) {
      console.log(`\n>>> [STEP ${m.step}] Applying ${m.name}...`);
      
      const filePath = path.resolve(__dirname, m.path);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${filePath}`);
      }
      
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const statements = getCleanStatements(sqlContent);
      
      console.log(`Parsed ${statements.length} commands to execute.`);
      
      // Execute each statement sequentially
      for (let sIdx = 0; sIdx < statements.length; sIdx++) {
        const stmt = statements[sIdx];
        try {
          const res = await runSQL(stmt);
          // Print output of important inserts/queries if needed
          if (stmt.toUpperCase().includes('INSERT') || stmt.toUpperCase().includes('UPDATE')) {
            console.log(`Stmt ${sIdx + 1} Result:`, JSON.stringify(res));
          }
        } catch (stmtErr) {
          throw new Error(`Failed to execute statement ${sIdx + 1} of step ${m.step} (${m.name}): ${stmtErr.message}\nSQL: ${stmt}`);
        }
      }
      
      console.log(`>>> [STEP ${m.step}] Success. Running postchecks...`);
      
      // Execute the postcheck verification query
      const checkResult = await runSQL(m.postcheck);
      console.log('Verification query results:');
      console.log(JSON.stringify(checkResult, null, 2));
    }

    console.log('\n========================================');
    console.log('ALL STAGING MIGRATIONS APPLIED SUCCESSFULLY');
    console.log('========================================\n');

  } catch (err) {
    console.error('\n!!! MIGRATION PIPELINE ABORTED DUE TO ERROR !!!');
    console.error(err.message || err);
  } finally {
    await cleanup();
  }
})();
