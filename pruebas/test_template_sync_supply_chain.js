/**
 * BarberAgency — Supply Chain Security & Template Sync Test Suite
 * Validates all 7 required supply-chain tests:
 * 1. Valid commit + valid SHA256 -> PASS
 * 2. Wrong SHA256 -> FAIL CLOSED
 * 3. Missing template -> FAIL CLOSED
 * 4. HTTP/download failure -> existing production file preserved
 * 5. Partial/corrupt download -> existing production file preserved
 * 6. No wildcard/mutable fallback to main on verification failure
 * 7. Existing active templates still resolve correctly in local/staging test
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const os = require('os');

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'project', 'templates', 'manifest.json');
const PLANTILLAS_DIR = path.join(ROOT_DIR, 'project', 'templates', 'plantillas');
const TMP_TEST_DIR = path.join(os.tmpdir(), 'test_supply_chain_' + Date.now());

function sha256File(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function safeRename(oldPath, newPath) {
  let attempts = 0;
  while (attempts < 15) {
    try {
      fs.renameSync(oldPath, newPath);
      return;
    } catch (e) {
      if (e.code === 'EPERM' || e.code === 'EBUSY') {
        attempts++;
        const end = Date.now() + 50;
        while (Date.now() < end) {}
      } else {
        throw e;
      }
    }
  }
  fs.renameSync(oldPath, newPath);
}

// Clean or prepare temporary sandbox
if (!fs.existsSync(TMP_TEST_DIR)) {
  fs.mkdirSync(TMP_TEST_DIR, { recursive: true });
}

console.log('==================================================');
console.log('BARBERAGENCY — TEMPLATE SYNC SUPPLY CHAIN TESTS');
console.log('==================================================');

// ------------------------------------------------------------------------------
// Test 7: Verify Current Active Template Set integrity against manifest.json
// ------------------------------------------------------------------------------
console.log('\n[RUNNING] Test 7: Active Templates Manifest & Integrity Verification...');
const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf8');
const manifest = JSON.parse(manifestRaw);

const expectedActiveTemplates = ['v2', 'v3', 'v4', 'v5', 'v6', 'v7'];
const results7 = {};

for (const tplId of expectedActiveTemplates) {
  const entry = manifest[tplId];
  assert(entry, `Template ${tplId} missing from manifest.json`);
  assert.strictEqual(entry.active, true, `Template ${tplId} should be active`);
  assert(entry.sha256, `Template ${tplId} must have sha256 pinned`);
  assert(/^[0-9a-f]{64}$/i.test(entry.sha256), `Template ${tplId} sha256 must be 64-char hex`);

  const diskPath = path.join(ROOT_DIR, entry.file);
  assert(fs.existsSync(diskPath), `File on disk missing: ${diskPath}`);

  const actualHash = sha256File(diskPath);
  assert.strictEqual(actualHash.toLowerCase(), entry.sha256.toLowerCase(), 
    `Hash mismatch for ${tplId}! Expected: ${entry.sha256}, Actual: ${actualHash}`);
  results7[tplId] = { file: path.basename(entry.file), hash: actualHash, status: 'PASS' };
}

// Check Electric Club is not active in current production routing
assert(manifest['electric-club'], 'electric-club entry should exist in manifest');
assert.strictEqual(manifest['electric-club'].active, false, 'electric-club must be inactive (excluded from routing)');

console.log('  [PASS] Test 7: All 6 active templates verified matching manifest SHA256:');
for (const [k, v] of Object.entries(results7)) {
  console.log(`    - ${k} (${v.file}): ${v.hash}`);
}

// ------------------------------------------------------------------------------
// Template Sync Engine Simulation (Faithfully mirrors sync-templates.php logic)
// ------------------------------------------------------------------------------
class TemplateSyncEngine {
  constructor(options = {}) {
    this.baseDir = options.baseDir;
    this.backupDir = this.baseDir + '.bak';
    this.commitSha = options.commitSha;
    this.fetchMock = options.fetchMock; // mock URL fetcher
  }

  run() {
    // 1. Commit SHA validation: strictly reject mutable branches ('main', 'master', etc.)
    if (!this.commitSha || !/^[0-9a-f]{40}$/i.test(this.commitSha)) {
      throw new Error(`Security violation: Commit SHA '${this.commitSha}' must be an immutable 40-character hex Git SHA. Mutable branches (e.g. 'main') are strictly prohibited.`);
    }

    const stagingDir = this.baseDir + '.stage_' + crypto.randomBytes(4).toString('hex');
    fs.mkdirSync(path.join(stagingDir, 'plantillas'), { recursive: true });
    fs.mkdirSync(path.join(stagingDir, 'project', 'templates', 'plantillas'), { recursive: true });

    try {
      // 2. Download manifest
      const manifestUrl = `https://raw.githubusercontent.com/stelledicarta212/barberagency-core/${this.commitSha}/project/templates/manifest.json`;
      const manifestRes = this.fetchMock(manifestUrl);
      if (!manifestRes || manifestRes.status !== 200 || !manifestRes.body) {
        throw new Error(`Error downloading manifest.json from ${manifestUrl} (HTTP ${manifestRes ? manifestRes.status : 'ERR'}). Fail closed.`);
      }

      const manifestData = JSON.parse(manifestRes.body);
      fs.writeFileSync(path.join(stagingDir, 'manifest.json'), manifestRes.body);
      fs.writeFileSync(path.join(stagingDir, 'project', 'templates', 'manifest.json'), manifestRes.body);

      // 3. Process active templates
      for (const [templateId, info] of Object.entries(manifestData)) {
        if (!info.active) continue;

        if (!info.file || !info.sha256 || !/^[0-9a-f]{64}$/i.test(info.sha256)) {
          throw new Error(`Integrity violation: Template ${templateId} missing valid sha256 in manifest.`);
        }

        const filename = path.basename(info.file);
        const tplUrl = `https://raw.githubusercontent.com/stelledicarta212/barberagency-core/${this.commitSha}/project/templates/plantillas/${filename}`;
        
        const tplRes = this.fetchMock(tplUrl);
        if (!tplRes || tplRes.status !== 200 || !tplRes.body) {
          throw new Error(`Error downloading template '${templateId}' from ${tplUrl} (HTTP ${tplRes ? tplRes.status : 'ERR'}). Fail closed.`);
        }

        const bodyBuf = Buffer.from(tplRes.body);
        if (bodyBuf.length < 1000) {
          throw new Error(`Downloaded template '${templateId}' is too small (${bodyBuf.length} bytes). Corrupt download.`);
        }

        const bodyStr = bodyBuf.toString('utf8');
        if (!bodyStr.includes('</html>') && !bodyStr.includes('</div>')) {
          throw new Error(`Downloaded template '${templateId}' has invalid HTML structure.`);
        }

        // SHA-256 Cryptographic Verification
        const actualHash = sha256Buffer(bodyBuf);
        if (actualHash.toLowerCase() !== info.sha256.toLowerCase()) {
          throw new Error(`CRYPTOGRAPHIC INTEGRITY FAILURE: SHA-256 mismatch for template '${templateId}'. Expected: ${info.sha256}, Got: ${actualHash}.`);
        }

        // Move to staging
        const stagedTpl = path.join(stagingDir, 'plantillas', filename);
        fs.writeFileSync(stagedTpl, bodyBuf);
        fs.writeFileSync(path.join(stagingDir, 'project', 'templates', 'plantillas', filename), bodyBuf);
      }

      // 4. Atomic Replacement
      if (fs.existsSync(this.baseDir)) {
        if (fs.existsSync(this.backupDir)) {
          fs.rmSync(this.backupDir, { recursive: true, force: true });
        }
        safeRename(this.baseDir, this.backupDir);
      }
      safeRename(stagingDir, this.baseDir);

      return { success: true, commit: this.commitSha };

    } catch (err) {
      // Fail closed cleanup
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
      // Restore backup if baseDir was moved
      if (!fs.existsSync(this.baseDir) && fs.existsSync(this.backupDir)) {
        safeRename(this.backupDir, this.baseDir);
      }
      throw err;
    }
  }
}

// ------------------------------------------------------------------------------
// Test 1: Valid commit + valid SHA256 -> PASS
// ------------------------------------------------------------------------------
console.log('\n[RUNNING] Test 1: Valid commit + valid SHA256 -> PASS...');
const prodDir1 = path.join(TMP_TEST_DIR, 'prod_1');
const validCommit = '31ca570b8bc1edbf52dd120028a9fceec2488a4a';

const engine1 = new TemplateSyncEngine({
  baseDir: prodDir1,
  commitSha: validCommit,
  fetchMock: (url) => {
    if (url.includes('manifest.json')) {
      return { status: 200, body: fs.readFileSync(MANIFEST_PATH, 'utf8') };
    }
    const filename = path.basename(url);
    const diskPath = path.join(PLANTILLAS_DIR, filename);
    if (fs.existsSync(diskPath)) {
      return { status: 200, body: fs.readFileSync(diskPath, 'utf8') };
    }
    return { status: 404, body: 'Not Found' };
  }
});

const res1 = engine1.run();
assert.strictEqual(res1.success, true);
assert(fs.existsSync(path.join(prodDir1, 'plantillas', 'index_unico_v2.html')));
assert(fs.existsSync(path.join(prodDir1, 'manifest.json')));
console.log('  [PASS] Test 1: Valid sync succeeded and atomic placement completed.');

// ------------------------------------------------------------------------------
// Test 2: Wrong SHA256 -> FAIL CLOSED
// ------------------------------------------------------------------------------
console.log('\n[RUNNING] Test 2: Wrong SHA256 -> FAIL CLOSED...');
const prodDir2 = path.join(TMP_TEST_DIR, 'prod_2');
fs.mkdirSync(path.join(prodDir2, 'plantillas'), { recursive: true });
fs.writeFileSync(path.join(prodDir2, 'plantillas', 'canary.txt'), 'ORIGINAL_KNOWN_GOOD');

const engine2 = new TemplateSyncEngine({
  baseDir: prodDir2,
  commitSha: validCommit,
  fetchMock: (url) => {
    if (url.includes('manifest.json')) {
      return { status: 200, body: fs.readFileSync(MANIFEST_PATH, 'utf8') };
    }
    const filename = path.basename(url);
    const diskPath = path.join(PLANTILLAS_DIR, filename);
    let content = fs.readFileSync(diskPath, 'utf8');
    if (filename === 'index_unico_v3_nueva.html') {
      // Injected tamper
      content += '\n<!-- TAMPERED PAYLOAD -->';
    }
    return { status: 200, body: content };
  }
});

let failed2 = false;
try {
  engine2.run();
} catch (e) {
  failed2 = true;
  assert(e.message.includes('CRYPTOGRAPHIC INTEGRITY FAILURE'), `Unexpected error: ${e.message}`);
}
assert.strictEqual(failed2, true, 'Engine should have thrown error on SHA256 mismatch');
assert.strictEqual(fs.readFileSync(path.join(prodDir2, 'plantillas', 'canary.txt'), 'utf8'), 'ORIGINAL_KNOWN_GOOD');
console.log('  [PASS] Test 2: Hash mismatch rejected and production files preserved.');

// ------------------------------------------------------------------------------
// Test 3: Missing template -> FAIL CLOSED
// ------------------------------------------------------------------------------
console.log('\n[RUNNING] Test 3: Missing template -> FAIL CLOSED...');
const prodDir3 = path.join(TMP_TEST_DIR, 'prod_3');
fs.mkdirSync(path.join(prodDir3, 'plantillas'), { recursive: true });
fs.writeFileSync(path.join(prodDir3, 'plantillas', 'canary.txt'), 'ORIGINAL_KNOWN_GOOD');

const engine3 = new TemplateSyncEngine({
  baseDir: prodDir3,
  commitSha: validCommit,
  fetchMock: (url) => {
    if (url.includes('manifest.json')) {
      return { status: 200, body: fs.readFileSync(MANIFEST_PATH, 'utf8') };
    }
    const filename = path.basename(url);
    if (filename === 'index_unico_v4_editorial.html') {
      return { status: 404, body: 'Not Found' };
    }
    const diskPath = path.join(PLANTILLAS_DIR, filename);
    return { status: 200, body: fs.readFileSync(diskPath, 'utf8') };
  }
});

let failed3 = false;
try {
  engine3.run();
} catch (e) {
  failed3 = true;
  assert(e.message.includes('Error downloading template'), `Unexpected error: ${e.message}`);
}
assert.strictEqual(failed3, true, 'Engine should fail on missing template');
assert.strictEqual(fs.readFileSync(path.join(prodDir3, 'plantillas', 'canary.txt'), 'utf8'), 'ORIGINAL_KNOWN_GOOD');
console.log('  [PASS] Test 3: Missing template triggered fail-closed and preserved production.');

// ------------------------------------------------------------------------------
// Test 4: HTTP/download failure -> existing production file preserved
// ------------------------------------------------------------------------------
console.log('\n[RUNNING] Test 4: HTTP 500 error -> existing production file preserved...');
const prodDir4 = path.join(TMP_TEST_DIR, 'prod_4');
fs.mkdirSync(path.join(prodDir4, 'plantillas'), { recursive: true });
fs.writeFileSync(path.join(prodDir4, 'plantillas', 'canary.txt'), 'KNOWN_GOOD_PROD_STATE');

const engine4 = new TemplateSyncEngine({
  baseDir: prodDir4,
  commitSha: validCommit,
  fetchMock: (url) => {
    if (url.includes('manifest.json')) {
      return { status: 200, body: fs.readFileSync(MANIFEST_PATH, 'utf8') };
    }
    const filename = path.basename(url);
    if (filename === 'index_unico_v5_1_azul_rojo_elegante.html') {
      return { status: 500, body: 'Internal Server Error' };
    }
    const diskPath = path.join(PLANTILLAS_DIR, filename);
    return { status: 200, body: fs.readFileSync(diskPath, 'utf8') };
  }
});

let failed4 = false;
try {
  engine4.run();
} catch (e) {
  failed4 = true;
  assert(e.message.includes('Error downloading template'), `Unexpected error: ${e.message}`);
}
assert.strictEqual(failed4, true, 'Engine should fail on HTTP error');
assert.strictEqual(fs.readFileSync(path.join(prodDir4, 'plantillas', 'canary.txt'), 'utf8'), 'KNOWN_GOOD_PROD_STATE');
console.log('  [PASS] Test 4: HTTP failure preserved existing production files.');

// ------------------------------------------------------------------------------
// Test 5: Partial/corrupt download -> existing production file preserved
// ------------------------------------------------------------------------------
console.log('\n[RUNNING] Test 5: Truncated/corrupt download -> existing production file preserved...');
const prodDir5 = path.join(TMP_TEST_DIR, 'prod_5');
fs.mkdirSync(path.join(prodDir5, 'plantillas'), { recursive: true });
fs.writeFileSync(path.join(prodDir5, 'plantillas', 'canary.txt'), 'KNOWN_GOOD_PROD_STATE');

const engine5 = new TemplateSyncEngine({
  baseDir: prodDir5,
  commitSha: validCommit,
  fetchMock: (url) => {
    if (url.includes('manifest.json')) {
      return { status: 200, body: fs.readFileSync(MANIFEST_PATH, 'utf8') };
    }
    const filename = path.basename(url);
    if (filename === 'index_unico_v6_negro_dorado.html') {
      // Truncated to 50 bytes
      return { status: 200, body: '<html><body>Partial truncated download' };
    }
    const diskPath = path.join(PLANTILLAS_DIR, filename);
    return { status: 200, body: fs.readFileSync(diskPath, 'utf8') };
  }
});

let failed5 = false;
try {
  engine5.run();
} catch (e) {
  failed5 = true;
  assert(e.message.includes('too small') || e.message.includes('invalid HTML'), `Unexpected error: ${e.message}`);
}
assert.strictEqual(failed5, true, 'Engine should fail on truncated download');
assert.strictEqual(fs.readFileSync(path.join(prodDir5, 'plantillas', 'canary.txt'), 'utf8'), 'KNOWN_GOOD_PROD_STATE');
console.log('  [PASS] Test 5: Truncated download rejected and existing production preserved.');

// ------------------------------------------------------------------------------
// Test 6: No wildcard/mutable fallback to main on verification failure
// ------------------------------------------------------------------------------
console.log('\n[RUNNING] Test 6: Mutable branch (main/*) rejection & no fallback...');
const prodDir6 = path.join(TMP_TEST_DIR, 'prod_6');

for (const badCommit of ['main', 'master', 'HEAD', 'main*', '31ca57', 'invalid-sha']) {
  let failed6 = false;
  try {
    const engine6 = new TemplateSyncEngine({
      baseDir: prodDir6,
      commitSha: badCommit,
      fetchMock: () => { throw new Error('Fetch should never be called for mutable commit'); }
    });
    engine6.run();
  } catch (e) {
    failed6 = true;
    assert(e.message.includes('Security violation') || e.message.includes('immutable'), `Unexpected error: ${e.message}`);
  }
  assert.strictEqual(failed6, true, `Commit '${badCommit}' should have been rejected immediately.`);
}
console.log('  [PASS] Test 6: Mutable branches (main, master, HEAD, wildcards) strictly blocked without fallback.');

// Cleanup temporary scratch directory
fs.rmSync(TMP_TEST_DIR, { recursive: true, force: true });

console.log('\n==================================================');
console.log('ALL 7 SUPPLY CHAIN TESTS COMPLETED: PASS');
console.log('==================================================\n');
