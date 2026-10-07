const fs = require('fs');
const https = require('https');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const username = process.env.WP_USERNAME || 'Carlos Alvis';
const appPassword = process.env.WP_APP_PASSWORD;
if (!appPassword) {
  throw new Error('WP_APP_PASSWORD is missing in .env.local');
}
const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
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
  console.log('=== STARTING CONTROLLED PROMOTION: HEADER POST 4737 ===');

  // Verify backup
  const backupFile = path.resolve(__dirname, 'backups/header_4737_pre_delete_ui_backup_20261006.json');
  if (!fs.existsSync(backupFile)) {
    throw new Error('ABORTING: Pre-deploy backup does not exist!');
  }
  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  if (!backup.elementor_data || backup.elementor_data.length === 0) {
    throw new Error('ABORTING: Pre-deploy backup elementor_data is empty!');
  }
  console.log('Pre-deploy backup confirmed present and verified.');

  // Load candidate elementor data
  const candidateFile = path.resolve(__dirname, 'header_4737_updated_elementor_data.json');
  const elDataStr = fs.readFileSync(candidateFile, 'utf8');

  // Confirm target delete logic is in candidate
  if (!elDataStr.includes('ba-barberia-delete-btn') || !elDataStr.includes('openDeleteModal')) {
    throw new Error('ABORTING: Candidate elementor_data is missing delete button logic!');
  }
  console.log('Candidate elementor data verified with delete button and modal.');

  console.log('Deploying via temporary WordPress AJAX snippet...');
  const snippetCode = [
    'function handle_header_4737_promote() {',
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
    '  wp_send_json(["ok" => true, "msg" => "Header 4737 promoted successfully and Elementor cache cleared"]);',
    '}',
    'add_action("wp_ajax_apply_header_4737_promote", "handle_header_4737_promote");',
    'add_action("wp_ajax_nopriv_apply_header_4737_promote", "handle_header_4737_promote");'
  ].join('\n');

  const snip = await wpRequest('POST', '/wp-json/code-snippets/v1/snippets', {
    name: 'Apply Header 4737 Promotion (Temporary)',
    code: snippetCode,
    scope: 'global',
    active: true
  });

  const snipBody = JSON.parse(snip.body);
  if (!snipBody || !snipBody.id) {
    throw new Error('Failed to create promotion snippet: ' + snip.body);
  }
  const id = snipBody.id;
  console.log('Temporary promotion snippet created with ID:', id);

  try {
    const postBody = JSON.stringify({ elementor_data: elDataStr });
    console.log(`Sending payload (${Buffer.byteLength(postBody)} bytes)...`);

    const updateRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: WP_HOST,
        port: 443,
        path: '/wp-admin/admin-ajax.php?action=apply_header_4737_promote',
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

    console.log('Promotion response:', updateRes.status, updateRes.body);
    const parsedUpdate = JSON.parse(updateRes.body);
    if (!parsedUpdate.ok) {
      throw new Error('Promotion failed: ' + updateRes.body);
    }
  } finally {
    await wpRequest('DELETE', '/wp-json/code-snippets/v1/snippets/' + id);
    console.log('Cleanup: Temporary promotion snippet deleted.');
  }

  console.log('Verifying live homepage markup...');
  const liveHtml = await new Promise(res => {
    https.get('https://' + WP_HOST + '/', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(d));
    });
  });

  const hasDeleteBtn = liveHtml.includes('ba-barberia-delete-btn');
  const hasDeleteModal = liveHtml.includes('ba-delete-modal-overlay') || liveHtml.includes('baDeleteModal');
  const hasBlockedNotice = liveHtml.includes('No puedes eliminar esta barbería mientras tenga un plan activo');

  console.log('Live Verification Check:');
  console.log('- hasDeleteBtn:', hasDeleteBtn);
  console.log('- hasDeleteModal:', hasDeleteModal);
  console.log('- hasBlockedNotice:', hasBlockedNotice);

  if (hasDeleteBtn && hasDeleteModal && hasBlockedNotice) {
    console.log('DEPLOY SUCCESS: Live Elementor Post 4737 contains all delete barberia UI elements!');
  } else {
    throw new Error('DEPLOY VERIFICATION FAILED: Live HTML does not contain required delete UI nodes!');
  }
})();
