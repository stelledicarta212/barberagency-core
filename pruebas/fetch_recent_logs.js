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

async function getExecutions(workflowId, limit = 5) {
  try {
    const res = await req('GET', `/api/v1/executions?workflowId=${workflowId}&limit=${limit}`);
    return res.data || [];
  } catch (e) {
    console.error(`Error getting executions for ${workflowId}:`, e.message);
    return [];
  }
}

async function getExecutionDetail(executionId) {
  try {
    return await req('GET', `/api/v1/executions/${executionId}?includeData=true`);
  } catch (e) {
    console.error(`Error getting execution detail for ${executionId}:`, e.message);
    return null;
  }
}

function parseNodeOutput(execData, nodeName) {
  try {
    const runData = execData.data.resultData.runData;
    const nodeRun = runData[nodeName];
    if (nodeRun && nodeRun[0] && nodeRun[0].data && nodeRun[0].data.main && nodeRun[0].data.main[0]) {
      return nodeRun[0].data.main[0].map(item => item.json);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

(async () => {
  const workflows = {
    login: { id: 'oAQzjkGzCuCjT1EP', name: 'BarberAgency - Dashboard Password Login' },
    session_me: { id: 'iUZCTRli7ghGFrEb', name: 'BarberAgency - Session Me v2' },
    dashboard_state: { id: '6JugRzxsOGKBvgWW', name: 'BarberAgency - Dashboard State Webhook' },
    config_update: { id: 'dB102yaMhaxNSGpK', name: 'BarberAgency - Configuracion Update' }
  };

  const results = {};

  for (const [key, wf] of Object.entries(workflows)) {
    console.log(`Fetching ${wf.name} (${wf.id})...`);
    results[key] = {
      id: wf.id,
      name: wf.name,
      executions: []
    };
    const execs = await getExecutions(wf.id, 5);
    for (const exec of execs) {
      const execEntry = {
        id: exec.id,
        startedAt: exec.startedAt,
        status: exec.status,
        finished: exec.finished,
        nodes: []
      };

      const detail = await getExecutionDetail(exec.id);
      if (detail) {
        const nodes = detail.data && detail.data.resultData && detail.data.resultData.runData 
          ? Object.keys(detail.data.resultData.runData) 
          : [];
        execEntry.nodes = nodes;

        // Try to parse webhook, postgres and respond nodes
        const webhookNode = nodes.find(n => n.toLowerCase().includes('webhook'));
        const pgNode = nodes.find(n => n.toLowerCase().includes('postgres'));
        const respondNode = nodes.find(n => n.toLowerCase().includes('respond'));

        if (webhookNode) {
          execEntry.webhookInput = parseNodeOutput(detail, webhookNode);
        }
        if (pgNode) {
          execEntry.pgOutput = parseNodeOutput(detail, pgNode);
        }
        if (respondNode) {
          execEntry.respondOutput = parseNodeOutput(detail, respondNode);
        }
      }
      results[key].executions.push(execEntry);
    }
  }

  const outputPath = path.join(__dirname, 'diagnostic_output.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`Saved output to ${outputPath}`);
})();
