const https = require('https');

require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const token = process.env.N8N_API_KEY;
if (!token) {
  throw new Error('N8N_API_KEY environment variable is required');
}

const options = {
  hostname: 'barberagency-n8n.gymh5g.easypanel.host',
  port: 443,
  path: '/api/v1/workflows',
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': token
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', chunk => {
    data += chunk;
  });
  res.on('end', () => {
    const workflows = JSON.parse(data).data;
    console.table(workflows.map(w => ({ id: w.id, name: w.name, active: w.active })));
  });
});

req.on('error', error => {
  console.error(error);
});

req.end();
