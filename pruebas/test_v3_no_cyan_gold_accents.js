const assert = require('assert');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../project/templates/plantillas/index_unico_v3_nueva.html');
const html = fs.readFileSync(templatePath, 'utf8');

const forbidden = [
  '#22d3ee',
  '#06b6d4',
  '#38bdf8',
  '#0ea5e9',
  '#0891b2',
  '#00e5ff',
  '#00ffff',
  '#00a47a',
  '#007d86',
  'cyan',
  'aqua',
  'teal',
  'turquoise'
];

for (const token of forbidden) {
  assert(!html.toLowerCase().includes(token), `V3 still contains forbidden cold accent: ${token}`);
}

assert(html.includes('--v3-gold: #d4a049'), 'Missing official V3 gold variable');
assert(html.includes('--v3-gold-strong: #f2c15f'), 'Missing strong V3 gold variable');
assert(html.includes('border: 1.5px solid rgba(212, 160, 73, 0.72)'), 'Cards do not use the required gold border');
assert(html.includes("#landingRoot .service-card:hover"), 'Missing gold service hover state');
assert(html.includes("#landingRoot .service-card[aria-selected='true']"), 'Missing gold service selected state');
assert(html.includes("#landingRoot .barber-card:hover"), 'Missing gold barber hover state');
assert(html.includes("#landingRoot .barber-card[aria-selected='true']"), 'Missing gold barber selected state');
assert(html.includes('0 0 34px rgba(212, 160, 73, 0.24)'), 'Missing strong gold card glow');
assert(html.includes("#landingRoot .service-price-chip"), 'Missing gold service price chip override');
assert(html.includes('border-color: #d4a049 !important'), 'Form focus does not use gold');
assert(html.includes("#landingRoot[data-theme='light'] .service-card"), 'Missing light theme service treatment');
assert(html.includes("#landingRoot[data-theme='dark'] .service-card"), 'Missing dark theme service treatment');
assert(html.includes("#landingRoot[data-theme='light'] .barber-card"), 'Missing light theme barber treatment');
assert(html.includes("#landingRoot[data-theme='dark'] .barber-card"), 'Missing dark theme barber treatment');
assert(html.includes("#landingRoot[data-theme='light'] #mapa .panel"), 'Missing light theme map glow');
assert(html.includes("#landingRoot[data-theme='dark'] #mapa .panel"), 'Missing dark theme map glow');
assert(html.includes("rootStyle.setProperty('--main', '#d4a049')"), 'Dynamic branding can reintroduce a non-gold primary accent');
assert(html.includes("rootStyle.setProperty('--main2', '#9b6a2f')"), 'Dynamic branding can reintroduce a non-bronze secondary accent');
assert(html.includes("rootStyle.setProperty('--hot', '#f2c15f')"), 'Dynamic branding can reintroduce a non-gold hot accent');

console.log('PASS V3 uses gold accents with no cyan tokens in light/dark card, form and map states');
