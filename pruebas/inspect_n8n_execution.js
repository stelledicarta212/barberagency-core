const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0ZWRlNzUwOC05OTdhLTQ0NzUtYjJiOC05YmUyZTNhNmE0MTUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWQ4MDYyMDAtNWM4Ni00ZDQ1LWIyM2ItZDEyYzc2MmMwMGEyIiwiaWF0IjoxNzc1OTIxODk4fQ.S-gQd2FKYczqgzSIqxLv3tWTkS4mJk-lvt0DMAtmfKY';

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
    // console.log(`Error parsing ${nodeName}:`, e.message);
  }
  return null;
}

(async () => {
  const ids = ['476862'];
  for (const id of ids) {
    console.log(`\n================ INSPECTING EXECUTION ${id} ===============`);
    try {
      const exec = await downloadExecution(id);
      fs.writeFileSync(path.join(__dirname, `execution_${id}.json`), JSON.stringify(exec, null, 2));
      console.log(`Saved full execution response to execution_${id}.json`);

      // Check runData keys
      const runData = exec.data && exec.data.resultData ? exec.data.resultData.runData : null;
      if (runData) {
        console.log('Executed Nodes:', Object.keys(runData));
      } else {
        console.log('No runData found in execution detail.');
        continue;
      }

      // Webhook output
      const webhookOut = parseNodeOutput(exec, 'Webhook - login') || parseNodeOutput(exec, 'Webhook') || parseNodeOutput(exec, 'Webhook - login v2');
      console.log('Webhook Input:', JSON.stringify(webhookOut, null, 2));

      // Postgres query output
      const pgOut = parseNodeOutput(exec, 'Postgres - login') || parseNodeOutput(exec, 'PostgreSQL') || parseNodeOutput(exec, 'Postgres') || parseNodeOutput(exec, 'Postgres - login query');
      console.log('Postgres Node Output:', JSON.stringify(pgOut, null, 2));

      // Build response output
      const respOut = parseNodeOutput(exec, 'Respond - login') || parseNodeOutput(exec, 'Respond') || parseNodeOutput(exec, 'Code - build response') || parseNodeOutput(exec, 'Code - build response v2');
      console.log('Final Response Output:', JSON.stringify(respOut, null, 2));

    } catch (e) {
      console.error(`Failed to inspect execution ${id}:`, e);
    }
  }
})();
