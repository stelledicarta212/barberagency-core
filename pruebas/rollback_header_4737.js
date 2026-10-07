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
  console.log('=== INITIATING ROLLBACK FOR HEADER POST 4737 ===');

  const backupFile = path.resolve(__dirname, 'backups/header_4737_pre_delete_ui_backup_20261006.json');
  if (!fs.existsSync(backupFile)) {
    throw new Error('ROLLBACK ABORTED: Pre-deploy backup file not found!');
  }

  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const originalDataStr = backup.elementor_data;
  if (!originalDataStr) {
    throw new Error('ROLLBACK ABORTED: elementor_data in backup is empty!');
  }

  const snippetCode = [
    'function handle_header_4737_rollback() {',
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
    '  wp_send_json(["ok" => true, "msg" => "Header 4737 restored to pre-deploy baseline"]);',
    '}',
    'add_action("wp_ajax_apply_header_4737_rollback", "handle_header_4737_rollback");',
    'add_action("wp_ajax_nopriv_apply_header_4737_rollback", "handle_header_4737_rollback");'
  ].join('\n');

  const snip = await wpRequest('POST', '/wp-json/code-snippets/v1/snippets', {
    name: 'Rollback Header 4737 (Temporary)',
    code: snippetCode,
    scope: 'global',
    active: true
  });

  const snipBody = JSON.parse(snip.body);
  const id = snipBody.id;
  console.log('Temporary rollback snippet created with ID:', id);

  try {
    const postBody = JSON.stringify({ elementor_data: originalDataStr });
    const rollbackRes = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: WP_HOST,
        port: 443,
        path: '/wp-admin/admin-ajax.php?action=apply_header_4737_rollback',
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

    console.log('Rollback response:', rollbackRes.status, rollbackRes.body);
  } finally {
    await wpRequest('DELETE', '/wp-json/code-snippets/v1/snippets/' + id);
    console.log('Cleanup: Temporary rollback snippet deleted.');
  }

  console.log('ROLLBACK COMPLETED: Header 4737 returned to baseline.');
})();
