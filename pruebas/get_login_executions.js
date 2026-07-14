const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.N8N_API_KEY;
if (!API_KEY) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}
const WORKFLOW_ID = 'oAQzjkGzCuCjT1EP';

const options = {
  hostname: 'barberagency-n8n.gymh5g.easypanel.host',
  port: 443,
  path: `/api/v1/executions?workflowId=${WORKFLOW_ID}&limit=5`,
  headers: {
    'X-N8N-API-KEY': API_KEY
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      fs.writeFileSync(path.join(__dirname, 'login_executions.json'), JSON.stringify(parsed, null, 2));
      console.log('Saved login executions successfully!');
      if (parsed.data && parsed.data.length > 0) {
        console.log(`Found ${parsed.data.length} executions.`);
        parsed.data.forEach((exec, index) => {
          console.log(`Execution ${index}: ID ${exec.id}, finished: ${exec.finished}, status: ${exec.status}`);
        });
      } else {
        console.log('No executions found.');
      }
    } catch (e) {
      console.error('Error parsing JSON:', e.message);
      console.log('Raw output:', data);
    }
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
