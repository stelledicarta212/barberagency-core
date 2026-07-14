const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.N8N_API_KEY;
if (!API_KEY) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}

function downloadExecution(executionId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: `/api/v1/executions/${executionId}?includeData=true`,
      headers: {
        'X-N8N-API-KEY': API_KEY
      }
    };

    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
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
  const ids = ['476862', '476860', '476853', '476842', '476840'];
  for (const id of ids) {
    console.log(`\n================ STATE RUN ID: ${id} ================`);
    try {
      const exec = await downloadExecution(id);
      fs.writeFileSync(path.join(__dirname, `state_${id}.json`), JSON.stringify(exec, null, 2));

      // Get webhook query & cookie
      const webhookOut = parseNodeOutput(exec, 'Webhook');
      if (webhookOut && webhookOut[0]) {
        console.log('Query:', JSON.stringify(webhookOut[0].query));
        const cookie = webhookOut[0].headers?.cookie || '';
        const match = cookie.match(/(?:^|;\s*)ba_session=([^;]+)/);
        console.log('Cookie ba_session token starts with:', match ? match[1].substring(0, 15) + '...' : 'NONE');
      }

      // Get claims output
      const claimsOut = parseNodeOutput(exec, 'Code - claims input');
      if (claimsOut && claimsOut[0]) {
        console.log('Claims decoded:', JSON.stringify(claimsOut[0]));
      }

      // Get validation output
      const valOut = parseNodeOutput(exec, 'Postgres - session validate');
      if (valOut && valOut[0]) {
        console.log('Postgres Validate output:', JSON.stringify(valOut[0].results?.[0]));
      }

      // Check final response (could be Respond - ok or Respond - error)
      const respondOk = parseNodeOutput(exec, 'Respond - ok');
      const respondError = parseNodeOutput(exec, 'Respond - error') || parseNodeOutput(exec, 'Respond');
      if (respondOk) {
        console.log('Status: SUCCESS (200 OK)');
      } else if (respondError) {
        console.log('Status: FAILED');
        console.log('Error Response:', JSON.stringify(respondError, null, 2));
      } else {
        console.log('Status: UNKNOWN (No respond node captured)');
      }

    } catch (e) {
      console.error(`Failed to inspect execution ${id}:`, e.message);
    }
  }
})();
