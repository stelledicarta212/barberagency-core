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
  const ids = ['476864', '476858', '476856', '476854', '476851'];
  for (const id of ids) {
    console.log(`\n================ CONFIG UPDATE ID: ${id} ================`);
    try {
      const exec = await downloadExecution(id);
      
      const parseReq = parseNodeOutput(exec, 'Code - parse request');
      if (parseReq && parseReq[0] && parseReq[0].request) {
        const req = parseReq[0].request;
        console.log('Mode:', req.mode);
        console.log('Barberia ID:', req.barberia_id);
        console.log('Barberia Slug:', req.slug);
        console.log('Barberia Name:', req.barberia?.nombre);
        console.log('Admin payload:', JSON.stringify(req.admin));
      }

      const formatResponse = parseNodeOutput(exec, 'Code - format response');
      if (formatResponse && formatResponse[0] && formatResponse[0].body) {
        const body = formatResponse[0].body;
        console.log('Response body:', JSON.stringify({
          ok: body.ok,
          message: body.message,
          owner_id_actual: body.data?.owner_id_actual,
          owner_id_original: body.data?.owner_id_original,
          email_contacto: body.data?.barberia?.email_contacto
        }));
      }

    } catch (e) {
      console.error(`Failed to inspect execution ${id}:`, e.message);
    }
  }
})();
