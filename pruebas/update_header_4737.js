const fs = require('fs');
const https = require('https');

const CREDENTIAL_SOURCE = 'C:/Users/calvi/OneDrive/n8n/Visual studio/barberagency-core/scratch/wp_auth_get_pages.js';
const text = fs.readFileSync(CREDENTIAL_SOURCE, 'utf8');
const username = text.match(/const username = '([^']+)'/)[1];
const appPassword = text.match(/const appPassword = '([^']+)'/)[1];
const auth = Buffer.from(username + ':' + appPassword).toString('base64');
const WP_HOST = 'barberagency-barberagency.gymh5g.easypanel.host';

function wpRequest(method, path, body) {
  return new Promise(r => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: WP_HOST,
      port: 443,
      path,
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
  console.log('1. Loading existing post 4737 elementor_data...');
  const backup = JSON.parse(fs.readFileSync('pruebas/backups/header_oficial_4737_backup_pre_part_a.json', 'utf8'));
  let elDataStr = backup.elementor_data;

  // Verify target strings exist
  const targetCountPill = '`${state.count} barber\\u00edas`';
  const newCountPill = '`${state.count} en tu cuenta`';
  if (!elDataStr.includes(targetCountPill)) {
    throw new Error('Target count pill string not found in elementor_data');
  }

  const targetExpiredCss = 'color:#ff928c;';
  if (!elDataStr.includes(targetExpiredCss)) {
    throw new Error('Target expired css color not found in elementor_data');
  }

  console.log('2. Applying replacements to elementor_data...');
  elDataStr = elDataStr.replace(targetCountPill, newCountPill);
  elDataStr = elDataStr.replace('color:#ff928c;', 'color:#d67f7f;');
  elDataStr = elDataStr.replace('background:rgba(220,75,70,.09);', 'background:rgba(180,70,70,.06);');
  elDataStr = elDataStr.replace('border-color:rgba(220,75,70,.25);', 'border-color:rgba(210,90,90,.16);');

  // Double check replacements took place
  if (elDataStr.includes(targetCountPill)) {
    throw new Error('Replacement of count pill failed');
  }
  if (elDataStr.includes('color:#ff928c;')) {
    throw new Error('Replacement of expired color failed');
  }
  console.log('Replacements successful in memory.');

  fs.writeFileSync('pruebas/header_4737_updated_elementor_data.json', elDataStr, 'utf8');

  console.log('3. Applying update via WordPress snippet...');
  const snippetCode = [
    'function handle_header_4737_update() {',
    '  $new_data = file_get_contents("php://input");',
    '  $payload = json_decode($new_data, true);',
    '  if (!$payload || empty($payload["elementor_data"])) {',
    '    wp_send_json(["ok" => false, "error" => "empty_or_invalid_payload"]);',
    '    return;',
    '  }',
    '  update_post_meta(4737, "_elementor_data", wp_slash($payload["elementor_data"]));',
    '  delete_post_meta(4737, "_elementor_css");',
    '  delete_post_meta(4737, "_elementor_element_cache");',
    '  clean_post_cache(4737);',
    '  if (class_exists("\\\\Elementor\\\\Plugin")) {',
    '    \\Elementor\\Plugin::$instance->files_manager->clear_cache();',
    '  }',
    '  wp_send_json(["ok" => true, "msg" => "Header 4737 updated and cache cleared"]);',
    '}',
    'add_action("wp_ajax_apply_header_4737_update", "handle_header_4737_update");',
    'add_action("wp_ajax_nopriv_apply_header_4737_update", "handle_header_4737_update");'
  ].join('\n');

  const snip = await wpRequest('POST', '/wp-json/code-snippets/v1/snippets', {
    name: 'Apply Header 4737 Update',
    code: snippetCode,
    scope: 'global',
    active: true
  });
  const id = JSON.parse(snip.body).id;
  console.log('Temporary snippet created:', id);

  try {
    const postBody = JSON.stringify({ elementor_data: elDataStr });
    const updateRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: WP_HOST,
        port: 443,
        path: '/wp-admin/admin-ajax.php?action=apply_header_4737_update',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postBody)
        }
      }, (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      });
      req.on('error', reject);
      req.write(postBody);
      req.end();
    });

    console.log('Update result:', updateRes.status, updateRes.body);
  } finally {
    await wpRequest('DELETE', '/wp-json/code-snippets/v1/snippets/' + id);
    console.log('Temporary snippet deleted.');
  }

  console.log('4. Verifying live homepage...');
  const liveHtml = await new Promise(res => {
    https.get('https://' + WP_HOST + '/', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(d));
    });
  });

  const hasNewPill = liveHtml.includes('${state.count} en tu cuenta');
  const hasOldPill = liveHtml.includes('${state.count} barberías');
  const hasMutedColor = liveHtml.includes('#d67f7f');
  const hasOldColor = liveHtml.includes('#ff928c');

  console.log('Live Verification:');
  console.log('- Has new pill text ("${state.count} en tu cuenta"):', hasNewPill);
  console.log('- Has old pill text ("${state.count} barberías"):', hasOldPill);
  console.log('- Has muted red (#d67f7f):', hasMutedColor);
  console.log('- Has old aggressive red (#ff928c):', hasOldColor);

  if (hasNewPill && !hasOldPill && hasMutedColor && !hasOldColor) {
    console.log('SUCCESS: Live header is verified updated!');
  } else {
    console.warn('WARNING: Live check did not completely match expectations.');
  }
})();
