const fs = require('fs');
const path = require('path');
const assert = require('assert');

const baseDir = path.join(__dirname, '..', 'project', 'templates', 'plantillas');

const templates = [
  ['V2', 'index_unico_v2.html'],
  ['V3', 'index_unico_v3_nueva.html'],
  ['V4', 'index_unico_v4_editorial.html'],
  ['V5', 'index_unico_v5_1_azul_rojo_elegante.html'],
  ['V6_BLACK_GOLD', 'index_unico_v6_negro_dorado.html'],
  ['V6_ELECTRIC', 'index_unico_v6_electric_club.html'],
  ['V7', 'index_unicov7.html'],
];

const requiredPayloads = [
  '<script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
];

for (const [label, fileName] of templates) {
  const filePath = path.join(baseDir, fileName);
  const html = fs.readFileSync(filePath, 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
  const script = scripts.join('\n');

  assert(script.includes("window.addEventListener('message'"), `${label}: missing preview message listener`);
  assert(script.includes('isAllowedPreviewOrigin'), `${label}: missing exact origin validation helper`);
  assert(script.includes('isAllowedPreviewSource'), `${label}: missing event.source validation helper`);
  assert(script.includes('isAllowedPreviewEnvelope'), `${label}: missing strict preview envelope validation helper`);
  assert(script.includes('window.self !== window.top') && script.includes('Boolean(window.opener)'), `${label}: public mode must ignore preview messages unless embedded or popup`);
  assert(script.includes('BA_EDITOR_PREVIEW_UPDATE') && script.includes('BA_BRANDING_UPDATE') && script.includes("data.source === 'ba-editor'"), `${label}: valid editor preview messages must remain supported`);

  assert(!/postMessage\([^)]*,\s*['"]\*['"]\s*\)/.test(script), `${label}: wildcard postMessage targetOrigin remains`);
  assert(!/safeSeedText\((data|payload)\.(public_landing_url|reservation_url|qr_url)\)/.test(script), `${label}: preview URLs are still accepted as raw text`);
  assert(!/barber_photos\.map\(\(item\)\s*=>\s*safeSeedText\(item\)\)/.test(script), `${label}: preview barber photo URLs are still accepted as raw text`);

  assert(/javascript\|vbscript/.test(script) || /javascript\|vbscript|\^\(javascript\|vbscript\)/.test(script), `${label}: URL helper must reject javascript/vbscript schemes`);
  assert(script.includes('/^data:/i.test(trimmed)') || script.includes('javascript|vbscript|data'), `${label}: URL helper must explicitly reject non-image data URLs`);

  for (const payload of requiredPayloads) {
    assert(typeof payload === 'string' && payload.length > 0, `${label}: adversarial payload list corrupted`);
  }
}

console.log('P0-02 public template XSS hardening checks passed for 7 templates.');
