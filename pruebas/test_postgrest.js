const https = require('https');

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://api.agencia2c.cloud${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    console.log('--- GET /barberias?id=eq.198 ---');
    const b = await get('/barberias?id=eq.198');
    console.log('Status:', b.status);
    console.log('Data:', JSON.stringify(b.data, null, 2));

    console.log('\n--- GET /servicios?barberia_id=eq.198 ---');
    const s = await get('/servicios?barberia_id=eq.198');
    console.log('Status:', s.status);
    console.log('Data:', JSON.stringify(s.data, null, 2));

    console.log('\n--- GET /horarios?barberia_id=eq.198 ---');
    const h = await get('/horarios?barberia_id=eq.198');
    console.log('Status:', h.status);
    console.log('Data:', JSON.stringify(h.data, null, 2));

    console.log('\n--- GET /barberos?barberia_id=eq.198 ---');
    const bar = await get('/barberos?barberia_id=eq.198');
    console.log('Status:', bar.status);
    console.log('Data:', JSON.stringify(bar.data, null, 2));

    console.log('\n--- GET /barberia_public_profiles?barberia_id=eq.198 ---');
    const p = await get('/barberia_public_profiles?barberia_id=eq.198');
    console.log('Status:', p.status);
    console.log('Data:', JSON.stringify(p.data, null, 2));

    console.log('\n--- GET /v_barberia_public_landing?barberia_id=eq.198 ---');
    const l = await get('/v_barberia_public_landing?barberia_id=eq.198');
    console.log('Status:', l.status);
    console.log('Data:', JSON.stringify(l.data, null, 2));

  } catch (e) {
    console.error(e);
  }
})();
