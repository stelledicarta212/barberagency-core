const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const crypto = require('crypto');
const os = require('os');
const { spawn } = require('child_process');
const CDP = require('chrome-remote-interface');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(ROOT, 'project', 'templates', 'plantillas');
const OUT_DIR = path.join(ROOT, 'scratch', 'p0-02-browser-visual-regression');
const CHROME = fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HEADED = process.env.BA_P0_02_HEADED === '1';

const templates = [
  { id: 'v2', file: 'index_unico_v2.html' },
  { id: 'v3', file: 'index_unico_v3_nueva.html' },
  { id: 'v4', file: 'index_unico_v4_editorial.html' },
  { id: 'v5', file: 'index_unico_v5_1_azul_rojo_elegante.html' },
  { id: 'v6_black_gold', file: 'index_unico_v6_negro_dorado.html' },
  { id: 'v6_electric', file: 'index_unico_v6_electric_club.html' },
  { id: 'v7', file: 'index_unicov7.html' },
];

const viewports = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'tablet_landscape', width: 1024, height: 768 },
  { id: 'tablet_portrait', width: 820, height: 1180 },
  { id: 'mobile', width: 390, height: 844 },
];

const mimeByExt = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
}

function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/preview.html') {
      const file = path.basename(url.searchParams.get('file') || '');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html>
<html><head><meta charset="utf-8"><title>Preview ${file}</title></head>
<body style="margin:0"><iframe id="preview" src="/${file}" style="width:100vw;height:100vh;border:0"></iframe>
<script>
const iframe = document.getElementById('preview');
const payload = {
  source: 'ba-editor',
  type: 'BA_BRANDING_UPDATE',
  payload: {
    source: 'ba-editor',
    use_custom_palette: true,
    hero_title: 'P0 Visual Barber',
    hero_subtitle: 'Preview hidratado sin HTML ejecutable',
    public_landing_url: 'https://barberagency-barberagency.gymh5g.easypanel.host/b/p0-visual',
    reservation_url: 'https://barberagency-barberagency.gymh5g.easypanel.host/b/p0-visual#reservas',
    qr_url: 'https://quickchart.io/qr?size=160&text=p0-visual',
    services: [{ id: 991, id_servicio: 991, nombre: 'Servicio <scr' + 'ipt>inerte</scr' + 'ipt>', precio: 25000, imagen_url: 'javascript:alert(1)' }],
    barbers: [{ id: 881, id_barbero: 881, nombre: 'Barbero <img onerror=alert(1)>', especialidad: 'SVG <svg onload=alert(1)>', foto_url: 'data:text/html,<scr' + 'ipt>alert(1)</scr' + 'ipt>' }],
    hours: [{ dia: 'lunes', activo: true, hora_abre: '08:00', hora_cierra: '18:00' }]
  }
};
iframe.addEventListener('load', () => {
  iframe.contentWindow.postMessage(payload, window.location.origin);
  window.setTimeout(() => {
    try {
      iframe.contentWindow.postMessage({ source: 'evil', type: 'BA_BRANDING_UPDATE', payload: { hero_title: 'EVIL_MUTATION' } }, 'https://evil.example');
    } catch (error) {
      window.__foreignPostMessageError = String(error);
    }
  }, 250);
});
</script></body></html>`);
      return;
    }

    const decoded = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    const target = path.resolve(TEMPLATE_DIR, decoded || 'index_unico_v2.html');
    if (!target.startsWith(TEMPLATE_DIR) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': mimeByExt.get(path.extname(target).toLowerCase()) || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function jsonGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (err) { reject(err); }
      });
    }).on('error', reject);
  });
}

async function jsonPut(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: 'PUT' }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (err) { reject(new Error(`${err.message}: ${data.slice(0, 160)}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = new URL(wsUrl);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.handshakeDone = false;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async open() {
    const key = crypto.randomBytes(16).toString('base64');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP websocket handshake timeout')), 5000);
      this.socket = net.createConnection({
        host: this.wsUrl.hostname,
        port: Number(this.wsUrl.port),
      });
      this.socket.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      this.socket.once('connect', () => {
        console.log('WS TCP connected');
        this.socket.write([
          `GET ${this.wsUrl.pathname}${this.wsUrl.search} HTTP/1.1`,
          `Host: ${this.wsUrl.host}`,
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${key}`,
          'Sec-WebSocket-Version: 13',
          '\r\n',
        ].join('\r\n'));
      });
      this.socket.on('data', (chunk) => {
        if (!this.handshakeDone) console.log(`WS data before handshake ${chunk.length}: ${chunk.toString('utf8').replace(/\r/g, '\\r').replace(/\n/g, '\\n')}`);
        this.buffer = Buffer.concat([this.buffer, chunk]);
        if (!this.handshakeDone) {
          let headerEnd = this.buffer.indexOf('\r\n\r\n');
          let headerSepLength = 4;
          if (headerEnd === -1) {
            headerEnd = this.buffer.indexOf('\n\n');
            headerSepLength = 2;
          }
          if (headerEnd === -1) return;
          const header = this.buffer.slice(0, headerEnd).toString('utf8');
          this.buffer = this.buffer.slice(headerEnd + headerSepLength);
          if (!/^HTTP\/1\.1 101/i.test(header)) {
            clearTimeout(timer);
            reject(new Error(`CDP websocket handshake failed: ${header}`));
            return;
          }
          this.handshakeDone = true;
          clearTimeout(timer);
          resolve();
        }
        this.drainFrames();
      });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    console.log(`CDP SEND ${id} ${method}`);
    this.writeFrame(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  writeFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    const mask = crypto.randomBytes(4);
    let header;
    if (payload.length < 126) {
      header = Buffer.from([0x81, 0x80 | payload.length]);
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i += 1) masked[i] = payload[i] ^ mask[i % 4];
    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  drainFrames() {
    while (this.buffer.length >= 2) {
      const first = this.buffer[0];
      const second = this.buffer[1];
      const opcode = first & 0x0f;
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (this.buffer.length < offset + 2) return;
        length = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (this.buffer.length < offset + 8) return;
        length = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
      }
      const masked = Boolean(second & 0x80);
      let mask;
      if (masked) {
        if (this.buffer.length < offset + 4) return;
        mask = this.buffer.slice(offset, offset + 4);
        offset += 4;
      }
      if (this.buffer.length < offset + length) return;
      let payload = this.buffer.slice(offset, offset + length);
      this.buffer = this.buffer.slice(offset + length);
      if (masked) {
        const unmasked = Buffer.alloc(payload.length);
        for (let i = 0; i < payload.length; i += 1) unmasked[i] = payload[i] ^ mask[i % 4];
        payload = unmasked;
      }
      if (opcode === 0x8) return;
      if (opcode !== 0x1) continue;
      const msg = JSON.parse(payload.toString('utf8'));
      if (msg.id && this.pending.has(msg.id)) {
        console.log(`CDP RECV ${msg.id}`);
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result || {});
      } else if (msg.method) {
        this.events.push(msg);
      }
    }
  }

  close() {
    if (this.socket) this.socket.end();
  }
}

async function startChrome(port) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-p0-02-chrome-'));
  const args = [
    ...(HEADED ? ['--window-size=1440,900'] : [
      '--headless=new',
      '--disable-gpu',
      '--disable-gpu-compositing',
      '--use-angle=swiftshader',
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-accelerated-2d-canvas',
      '--disable-accelerated-video-decode',
      '--disable-features=UseSkiaRenderer,Vulkan,DawnGraphite,CanvasOopRasterization,VizDisplayCompositor',
    ]),
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    '--remote-debugging-address=127.0.0.1',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];
  const chrome = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const chromeLog = path.join(OUT_DIR, 'chrome-debug.log');
  chrome.stdout.on('data', (chunk) => fs.appendFileSync(chromeLog, chunk));
  chrome.stderr.on('data', (chunk) => fs.appendFileSync(chromeLog, chunk));
  for (let i = 0; i < 80; i += 1) {
    try {
      await jsonGet(`http://127.0.0.1:${port}/json/version`);
      return { chrome, userDataDir };
    } catch (_) {
      await sleep(125);
    }
  }
  throw new Error('Chrome CDP did not start');
}

async function newPage(port) {
  const target = await CDP.New({ port, url: 'about:blank' });
  const client = await CDP({ port, target });
  const cdp = {
    events: [],
    send(method, params = {}) {
      return client.send(method, params);
    },
    close() {
      return client.close();
    },
  };
  client.on('Runtime.consoleAPICalled', (params) => cdp.events.push({ method: 'Runtime.consoleAPICalled', params }));
  client.on('Runtime.exceptionThrown', (params) => cdp.events.push({ method: 'Runtime.exceptionThrown', params }));
  client.on('Log.entryAdded', (params) => cdp.events.push({ method: 'Log.entryAdded', params }));
  client.on('Network.loadingFailed', (params) => cdp.events.push({ method: 'Network.loadingFailed', params }));
  await Promise.all([
    cdp.send('Page.enable'),
    cdp.send('Runtime.enable'),
    cdp.send('Log.enable'),
    cdp.send('Network.enable'),
  ]);
  return cdp;
}

async function navigate(cdp, url) {
  await cdp.send('Page.navigate', { url });
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const ready = await cdp.send('Runtime.evaluate', {
      expression: 'document.readyState',
      returnByValue: true,
    });
    if (ready.result?.value === 'interactive' || ready.result?.value === 'complete') break;
    await sleep(100);
  }
  await sleep(500);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}

async function screenshot(cdp, filePath) {
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(filePath, Buffer.from(result.data, 'base64'));
}

function summarizeEvents(events) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedResources = [];
  for (const ev of events) {
    if (ev.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(ev.params?.type)) {
      consoleErrors.push((ev.params.args || []).map((arg) => arg.value || arg.description || '').join(' '));
    }
    if (ev.method === 'Runtime.exceptionThrown') {
      pageErrors.push(
        ev.params?.exceptionDetails?.exception?.description ||
        ev.params?.exceptionDetails?.text ||
        JSON.stringify(ev.params?.exceptionDetails || {})
      );
    }
    if (ev.method === 'Log.entryAdded' && ev.params?.entry?.level === 'error') {
      consoleErrors.push(ev.params.entry.text || 'log error');
    }
    if (ev.method === 'Network.loadingFailed') {
      const url = ev.params?.requestId || '';
      const text = ev.params?.errorText || 'loading failed';
      if (!/ERR_ABORTED/i.test(text)) failedResources.push(`${url}: ${text}`);
    }
  }
  return { consoleErrors, pageErrors, failedResources };
}

const publicChecks = `(() => {
  window.__baXssExecuted = false;
  const body = document.body;
  const text = body ? body.innerText || '' : '';
  const services = document.querySelectorAll('[data-service-id], .service-card, .service-item, .ba-service-card, article[class*="service"]').length;
  const barbers = document.querySelectorAll('[data-barber-id], .barber-card, .barber-item, .ba-barber-card, article[class*="barber"]').length;
  const ctas = [...document.querySelectorAll('a,button')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 8 && r.height > 8 && /reserv|agenda|cita|book/i.test(el.textContent || el.href || '');
  });
  const imgs = [...document.images];
  const visibleImages = imgs.filter((img) => {
    const r = img.getBoundingClientRect();
    return r.width > 16 && r.height > 16;
  }).length;
  const overflow = Math.ceil(document.documentElement.scrollWidth) > Math.ceil(window.innerWidth) + 2;
  const clipping = document.body.scrollHeight < Math.min(450, window.innerHeight * 0.6);
  window.postMessage({ source: 'ba-editor', type: 'BA_BRANDING_UPDATE', payload: { hero_title: 'UNTRUSTED_PUBLIC_MUTATION' } }, '*');
  return new Promise((resolve) => setTimeout(() => {
    resolve({
      title: document.title,
      textLength: text.length,
      branding: Boolean(document.querySelector('.navbar-brand, .brand, .footer-brand, [data-ba-live-name]')) || /barber|nova|cut|style|agency/i.test(text),
      barberiaName: /barber|nova|cut|style|agency/i.test(text),
      services,
      barbers,
      ctas: ctas.length,
      images: visibleImages,
      overflow,
      clipping,
      publicRejected: !document.body.innerText.includes('UNTRUSTED_PUBLIC_MUTATION'),
      xssExecuted: Boolean(window.__baXssExecuted),
    });
  }, 350));
})()`;

const previewChecks = `(() => {
  const iframe = document.getElementById('preview');
  const doc = iframe && iframe.contentDocument;
  if (!doc) return { ok: false, reason: 'missing preview iframe document' };
  const text = doc.body.innerText || '';
  const services = doc.querySelectorAll('[data-service-id], .service-card, .service-item, article[class*="service"]').length;
  const barbers = doc.querySelectorAll('[data-barber-id], .barber-card, .barber-item, article[class*="barber"]').length;
  const unsafeUrl = [...doc.querySelectorAll('img,a,iframe')].some((node) => /^(javascript|vbscript|data:text\\/html)/i.test(node.src || node.href || ''));
  const overflow = Math.ceil(doc.documentElement.scrollWidth) > Math.ceil(iframe.clientWidth) + 2;
  return {
    ok: text.includes('P0 Visual Barber') || text.includes('Servicio <script>inerte</script') || services > 0,
    trustedMutation: text.includes('P0 Visual Barber') || services > 0 || barbers > 0,
    foreignRejected: !text.includes('EVIL_MUTATION'),
    services,
    barbers,
    unsafeUrl,
    overflow,
    xssExecuted: Boolean(iframe.contentWindow.__baXssExecuted),
  };
})()`;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const serverPort = server.address().port;
  const cdpPort = 9222 + Math.floor(Math.random() * 1000);
  const { chrome } = await startChrome(cdpPort);
  const report = {
    generatedAt: new Date().toISOString(),
    outDir: OUT_DIR,
    templates: {},
  };

  try {
    for (const template of templates) {
      report.templates[template.id] = { viewports: {}, preview: null };
      for (const viewport of viewports) {
        console.log(`RUN ${template.id} ${viewport.id}`);
        const cdp = await newPage(cdpPort);
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: viewport.width,
          height: viewport.height,
          deviceScaleFactor: 1,
          mobile: viewport.width < 600,
        });
        const url = `http://127.0.0.1:${serverPort}/${encodeURIComponent(template.file)}`;
        await navigate(cdp, url);
        const checks = await evaluate(cdp, publicChecks);
        const shot = path.join(OUT_DIR, `${safeName(template.id)}-${viewport.id}.png`);
        await screenshot(cdp, shot);
        const events = summarizeEvents(cdp.events);
        cdp.close();
        report.templates[template.id].viewports[viewport.id] = { checks, screenshot: shot, ...events };
        console.log(`DONE ${template.id} ${viewport.id}`);
      }

      console.log(`RUN ${template.id} preview`);
      const cdp = await newPage(cdpPort);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const previewUrl = `http://127.0.0.1:${serverPort}/preview.html?file=${encodeURIComponent(template.file)}`;
      console.log(`PREVIEW_NAV ${template.id}`);
      await navigate(cdp, previewUrl);
      await sleep(900);
      console.log(`PREVIEW_EVAL ${template.id}`);
      const checks = await evaluate(cdp, previewChecks);
      const shot = path.join(OUT_DIR, `${safeName(template.id)}-preview-desktop.png`);
      console.log(`PREVIEW_SHOT ${template.id}`);
      await screenshot(cdp, shot);
      const events = summarizeEvents(cdp.events);
      cdp.close();
      report.templates[template.id].preview = { checks, screenshot: shot, ...events };
      console.log(`DONE ${template.id} preview`);
    }
  } finally {
    chrome.kill();
    server.close();
  }

  const reportPath = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ reportPath, outDir: OUT_DIR, templates: Object.keys(report.templates) }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
