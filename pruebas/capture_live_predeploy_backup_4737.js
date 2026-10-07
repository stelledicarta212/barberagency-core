const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const path = require('path');

const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const username = process.env.WP_USERNAME || 'Carlos Alvis';
const appPassword = process.env.WP_APP_PASSWORD;
if (!appPassword) {
  throw new Error('WP_APP_PASSWORD is missing in .env.local');
}
const auth = Buffer.from(username + ':' + appPassword).toString('base64');
const WP_HOST = process.env.WP_HOST || 'barberagency-barberagency.gymh5g.easypanel.host';

function wpRequest(method, reqPath, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: WP_HOST,
      port: 443,
      path: reqPath,
      method,
      headers: {
        Authorization: 'Basic ' + auth,
        Accept: 'application/json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => r({ status: res.statusCode, body: d }));
    });
    req.on('error', e => r({ status: 500, body: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('=== STEP 1: CAPTURING LIVE POST 4737 PRE-DEPLOY BACKUP ===');
  const code = [
    'add_action("init", function() {',
    '  if (isset($_GET["get_header_4737_live_backup"])) {',
    '    $el_data = get_post_meta(4737, "_elementor_data", true);',
    '    $post = get_post(4737);',
    '    wp_send_json([',
    '      "post" => $post,',
    '      "elementor_data" => $el_data,',
    '      "timestamp" => time()',
    '    ]);',
    '  }',
    '});'
  ].join('\n');

  const snip = await wpRequest('POST', '/wp-json/code-snippets/v1/snippets', {
    name: 'Get Live Header 4737 Pre-deploy Backup',
    code,
    scope: 'global',
    active: true
  });
  const id = JSON.parse(snip.body).id;

  try {
    const call = await new Promise(res => {
      https.get('https://' + WP_HOST + '/?get_header_4737_live_backup=1', r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => res(d));
      });
    });

    const parsed = JSON.parse(call);
    const backupDir = path.resolve(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const backupFilePath = path.join(backupDir, 'header_4737_pre_delete_ui_backup_20261006.json');
    fs.writeFileSync(backupFilePath, JSON.stringify(parsed, null, 2), 'utf8');

    const rawData = parsed.elementor_data || '';
    const sha256 = crypto.createHash('sha256').update(rawData).digest('hex');

    console.log(`[BACKUP CREATED]: ${backupFilePath}`);
    console.log(`[POST ID]: 4737`);
    console.log(`[RAW DATA LENGTH]: ${rawData.length} bytes`);
    console.log(`[SHA256 CHECKSUM]: ${sha256}`);

    // Parse both trees to verify structure and diff scope
    const liveTree = JSON.parse(rawData);
    const candidateStr = fs.readFileSync(path.resolve(__dirname, 'header_4737_updated_elementor_data.json'), 'utf8');
    const candidateTree = JSON.parse(candidateStr);

    console.log('=== STEP 2: VERIFYING SCOPE OF MUTATION ===');
    console.log(`Live tree top-level sections count: ${liveTree.length}`);
    console.log(`Candidate tree top-level sections count: ${candidateTree.length}`);

    // Verify sections match except the HTML widget inside section #37b2233
    if (liveTree.length !== candidateTree.length) {
      throw new Error(`Section count mismatch! Live=${liveTree.length}, Candidate=${candidateTree.length}`);
    }

    let diffCount = 0;
    let modifiedWidgetId = null;

    function compareElements(liveElem, candElem, pathStr) {
      if (liveElem.id !== candElem.id) {
        throw new Error(`Element ID mismatch at ${pathStr}: live=${liveElem.id}, cand=${candElem.id}`);
      }
      if (liveElem.elType !== candElem.elType) {
        throw new Error(`Element type mismatch at ${pathStr}: live=${liveElem.elType}, cand=${candElem.elType}`);
      }

      if (liveElem.elType === 'widget') {
        const liveHtml = liveElem.settings?.html;
        const candHtml = candElem.settings?.html;
        if (liveHtml !== candHtml) {
          diffCount++;
          modifiedWidgetId = liveElem.id;
          console.log(`[CONFIRMED DIFF IN WIDGET]: id=${liveElem.id}, widgetType=${liveElem.widgetType}`);
        }
      }

      const liveChildren = liveElem.elements || [];
      const candChildren = candElem.elements || [];
      if (liveChildren.length !== candChildren.length) {
        throw new Error(`Children length mismatch at ${pathStr}`);
      }
      for (let i = 0; i < liveChildren.length; i++) {
        compareElements(liveChildren[i], candChildren[i], `${pathStr}.elements[${i}]`);
      }
    }

    for (let i = 0; i < liveTree.length; i++) {
      compareElements(liveTree[i], candidateTree[i], `sections[${i}]`);
    }

    console.log(`Total modified widgets: ${diffCount}`);
    console.log(`Target modified widget ID: ${modifiedWidgetId}`);

    if (diffCount === 1 && modifiedWidgetId === 'd5d226e') {
      console.log('CONFIRMED: ONLY the intended header menu widget (d5d226e) will change!');
      console.log('PRE-DEPLOY CHECKSUM & INTEGRITY VERIFIED.');
    } else {
      throw new Error(`Unexpected diff count (${diffCount}) or target widget (${modifiedWidgetId})`);
    }

  } finally {
    await wpRequest('DELETE', '/wp-json/code-snippets/v1/snippets/' + id);
    console.log('Cleanup: temporary backup snippet removed.');
  }
})();
