const https = require('https');
const fs = require('fs');
const path = require('path');

const options = {
  hostname: 'barberagency-n8n.gymh5g.easypanel.host',
  port: 443,
  path: '/api/v1/executions?workflowId=mYdeHfxzpWfOxYIv&limit=5',
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': process.env.N8N_API_KEY
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
      fs.writeFileSync(path.join(__dirname, 'servicios_workflow.json'), JSON.stringify(parsed, null, 2));
      console.log('Saved to servicios_workflow.json successfully!');
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
