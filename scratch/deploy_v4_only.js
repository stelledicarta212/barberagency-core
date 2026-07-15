const fs = require('fs');
const https = require('https');
const path = require('path');

const authSource = fs.readFileSync('scratch/wp_auth_get_pages.js', 'utf8');
const username = (authSource.match(/const username = '([^']+)'/) || [])[1];
const appPassword = (authSource.match(/const appPassword = '([^']+)'/) || [])[1];
const host = (authSource.match(/const host = '([^']+)'/) || [])[1];

if (!username || !appPassword || !host) {
  throw new Error('Could not read WordPress credentials from existing auth script');
}

const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

const PAGE_ID = 1568;
const WIDGET_ID = 'b1285a3';
const TEMPLATE_FILE = 'project/templates/plantillas/index_unico_v4_editorial.html';
const EXPECTED_SLUG = 'index_unico_v4_editorial';

function request(method, requestPath, bodyObject = null) {
  const body = bodyObject ? JSON.stringify(bodyObject) : null;
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      port: 443,
      path: requestPath,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function findAndUpdateWidget(elements, widgetId, html) {
  if (!Array.isArray(elements)) return false;
  for (const el of elements) {
    if (el?.elType === 'widget' && el?.widgetType === 'html' && el?.id === widgetId) {
      el.settings = el.settings || {};
      el.settings.html = html;
      return true;
    }
    if (findAndUpdateWidget(el?.elements, widgetId, html)) return true;
  }
  return false;
}

async function clearElementorCache() {
  console.log('[WP] Regenerating Elementor cache...');
  const response = await request('DELETE', '/wp-json/elementor/v1/cache');
  if (response.statusCode !== 200 && response.statusCode !== 204) {
    throw new Error(`Regeneración Elementor falló con HTTP ${response.statusCode}.`);
  }
  console.log(`Elementor cache cleared. HTTP Status: ${response.statusCode}`);
}

async function main() {
  console.log('=== STARTING V4 ONLY DEPLOYMENT ===');

  const sourceHtml = fs.readFileSync(TEMPLATE_FILE, 'utf8');
  console.log(`Loaded local template: ${TEMPLATE_FILE} (${sourceHtml.length} bytes)`);

  console.log(`Fetching Page ID ${PAGE_ID}...`);
  const pageRes = await request('GET', `/wp-json/wp/v2/pages/${PAGE_ID}?context=edit`);
  if (pageRes.statusCode !== 200) {
    throw new Error(`Could not fetch page ${PAGE_ID}: ${pageRes.statusCode}`);
  }

  const page = JSON.parse(pageRes.body);
  if (page.slug !== EXPECTED_SLUG) {
    throw new Error(`Page slug mismatch. Expected ${EXPECTED_SLUG}, got ${page.slug}`);
  }

  const stamp = Date.now();
  const backupPath = `scratch/wp_page_1568_backup_before_deploy_${stamp}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(page, null, 2));
  console.log(`Saved backup of current page state to: ${backupPath}`);

  const elementorDataRaw = page.meta?._elementor_data || '';
  if (!elementorDataRaw) {
    throw new Error('No Elementor data found in page metadata.');
  }

  const elementorData = JSON.parse(elementorDataRaw);
  const widgetUpdated = findAndUpdateWidget(elementorData, WIDGET_ID, sourceHtml);
  if (!widgetUpdated) {
    throw new Error(`Could not find Elementor HTML widget ${WIDGET_ID} in page metadata.`);
  }

  const wrappedContent = `<!-- wp:html -->\n${sourceHtml}\n<!-- /wp:html -->`;
  const updatePayload = {
    content: wrappedContent,
    template: page.template || 'elementor_canvas',
    meta: {
      _elementor_data: JSON.stringify(elementorData),
      _elementor_edit_mode: 'builder',
      _wp_page_template: page.template || 'elementor_canvas',
    },
  };

  console.log(`Submitting update to WordPress API for Page ID ${PAGE_ID}...`);
  const updateRes = await request('POST', `/wp-json/wp/v2/pages/${PAGE_ID}`, updatePayload);
  if (updateRes.statusCode !== 200) {
    throw new Error(`Update request failed: HTTP ${updateRes.statusCode}. Response: ${updateRes.body}`);
  }
  console.log('WordPress page content and Elementor metadata updated successfully!');

  await clearElementorCache();

  console.log('Deployment completed successfully!');
}

main().catch(error => {
  console.error('Deployment FAILED:', error.message);
  process.exit(1);
});
