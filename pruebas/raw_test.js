const https = require('https');
const { setup, cleanup } = require('./run_postgres_query');

(async () => {
  try {
    await setup();
    
    const body = {
      query: "SELECT * FROM public.subscriptions LIMIT 1;",
      params: []
    };

    const data = JSON.stringify(body);
    const options = {
      hostname: 'barberagency-n8n.gymh5g.easypanel.host',
      port: 443,
      path: '/webhook/temp_postgres_exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    console.log('Sending raw request...');
    const r = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', async () => {
        console.log('Status Code:', res.statusCode);
        console.log('Raw Response:', raw);
        await cleanup();
      });
    });
    r.on('error', async (err) => {
      console.error(err);
      await cleanup();
    });
    r.write(data);
    r.end();

  } catch (e) {
    console.error(e);
  }
})();
