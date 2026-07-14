const https = require('https');
const fs = require('fs');
const path = require('path');

const token = process.env.N8N_API_KEY;
if (!token) {
  console.error("N8N_API_KEY is required.");
  process.exit(1);
}

const targetWorkflows = {
  login: 'oAQzjkGzCuCjT1EP',
  session_me: 'iUZCTRli7ghGFrEb',
  dashboard_state: '6JugRzxsOGKBvgWW',
  config_update: 'dB102yaMhaxNSGpK',
  barberos: 'h3JdyaI26GbRqrzE',
  citas: 'jRi8fOiFwBGziCX5',
  servicios: 'mYdeHfxzpWfOxYIv',
  publicar: 'Qeou40pYsQPg2ROK'
};

function downloadWorkflow(id, filename) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: `/api/v1/workflows/${id}`,
      headers: {
        'X-N8N-API-KEY': token
      }
    };

    https.get(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(parsed, null, 2));
          console.log(`Saved workflow ${id} to ${filename}`);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  for (const [key, id] of Object.entries(targetWorkflows)) {
    try {
      await downloadWorkflow(id, `${key}_workflow.json`);
    } catch (e) {
      console.error(`Failed to download ${key} (${id}):`, e.message);
    }
  }
  console.log('Finished downloading workflows.');
})();
