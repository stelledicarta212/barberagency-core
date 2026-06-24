const assert = require('assert');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../project/templates/plantillas/index_unico_v3_nueva.html');
const html = fs.readFileSync(templatePath, 'utf8');
const normalizerMatch = html.match(/function normalizeV3GoldPalette\(branding = \{\}\) \{[\s\S]*?\n    \}/);

assert(normalizerMatch, 'normalizeV3GoldPalette function was not found');

const normalizeV3GoldPalette = new Function(
  `${normalizerMatch[0]}\nreturn normalizeV3GoldPalette;`
)();

const cyanPayload = {
  logo_url: 'https://example.test/logo.png',
  hero_title: 'Dynamic title',
  palette_primary: '#22d3ee',
  palette_secondary: '#38bdf8',
  palette_accent: '#06b6d4',
  color_primary: '#22d3ee',
  color_secondary: '#38bdf8'
};

const normalized = normalizeV3GoldPalette(cyanPayload);

assert.strictEqual(normalized.palette_primary, '#d4a049');
assert.strictEqual(normalized.palette_secondary, '#9b6a2f');
assert.strictEqual(normalized.palette_accent, '#f2c15f');
assert.strictEqual(normalized.color_primary, '#d4a049');
assert.strictEqual(normalized.color_secondary, '#9b6a2f');
assert.strictEqual(normalized.color_accent, '#f2c15f');
assert.strictEqual(normalized.logo_url, cyanPayload.logo_url, 'Logo must remain dynamic');
assert.strictEqual(normalized.hero_title, cyanPayload.hero_title, 'Content must remain dynamic');

const paletteApplyMatch = html.match(/function applyBrandingPalette\(payload\) \{[\s\S]*?\n    \}/);
assert(paletteApplyMatch, 'applyBrandingPalette function was not found');

const appliedVariables = {};
const fakeLandingRoot = {
  style: {
    setProperty(name, value) {
      appliedVariables[name] = value;
    },
    removeProperty(name) {
      delete appliedVariables[name];
    }
  }
};
const applyBrandingPalette = new Function(
  'html',
  `${normalizerMatch[0]}\n${paletteApplyMatch[0]}\nreturn applyBrandingPalette;`
)(fakeLandingRoot);

applyBrandingPalette(cyanPayload);
assert.deepStrictEqual(appliedVariables, {
  '--main': '#d4a049',
  '--main2': '#9b6a2f',
  '--hot': '#f2c15f'
});

assert(html.includes('raw = normalizeV3GoldPalette(raw);'), 'Runtime branding does not normalize API payloads');
assert(html.includes('const branding = normalizeV3GoldPalette(payload.branding || payload.config || {});'), 'Public landing branding does not normalize route context');
assert(html.includes('const branding = normalizeV3GoldPalette(payload);'), 'Message branding does not normalize updates');
assert(html.includes('border: 1.5px solid rgba(212, 160, 73, 0.72)'), 'Service/barber borders are not gold');
assert(html.includes('0 0 34px rgba(212, 160, 73, 0.24)'), 'Hover/selected glow is not gold');
assert(html.includes('border-color: #d4a049 !important'), 'Form focus is not gold');
assert(html.includes('linear-gradient(135deg, #f2c15f, #d4a049, #9b6a2f)'), 'Buttons are not gold');

console.log('PASS V3 normalizes cyan dynamic branding to gold while preserving content and media');
