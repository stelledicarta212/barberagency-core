const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const registroPath = path.resolve(__dirname, '..', 'project', 'templates', 'plantillas', 'registrobarberia.html');
const editorPath = path.resolve(__dirname, '..', 'project', 'templates', 'editor', 'landing_editor_v2_unico_vscode.html');
const registroHtml = fs.readFileSync(registroPath, 'utf8');
const editorHtml = fs.readFileSync(editorPath, 'utf8');

function extractFunction(html, name) {
  const marker = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = marker.exec(html);
  assert(match, `No se encontro la funcion ${name}`);
  const start = match.index;
  const paramsStart = html.indexOf('(', start);
  let paramsDepth = 0;
  let paramsEnd = -1;
  for (let index = paramsStart; index < html.length; index += 1) {
    if (html[index] === '(') paramsDepth += 1;
    if (html[index] === ')') paramsDepth -= 1;
    if (paramsDepth === 0) {
      paramsEnd = index;
      break;
    }
  }
  const bodyStart = html.indexOf('{', paramsEnd);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === '{') depth += 1;
    if (html[index] === '}') depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`No se pudo extraer ${name}`);
}

function validateInlineSyntax(html, filename) {
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    if (!match[1].trim()) continue;
    new vm.Script(match[1], { filename: `${filename}#${count + 1}` });
    count += 1;
  }
  assert(count > 0, `No se encontraron scripts en ${filename}`);
}

function makeBarbers(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: 439 + index,
    id_barbero: 439 + index,
    nombre: `Barbero ${index + 1}`,
    foto_url: `https://img.test/barber-${index + 1}.jpg`
  }));
}

function makeServices(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: 489 + index,
    id_servicio: 489 + index,
    nombre: `Servicio ${index + 1}`,
    imagen_url: `https://img.test/service-${index + 1}.jpg`
  }));
}

function testRegistroSeedUsesFullDraft() {
  const draft = {
    barberia: { id: 198, slug: 'barberia-prueba-4', nombre: 'Barberia Prueba 4' },
    barberos: makeBarbers(5),
    servicios: makeServices(3),
    horarios: [{ dia: 'lunes', activo: true }]
  };
  const context = vm.createContext({
    Number,
    Array,
    Date,
    draft,
    clean: (value) => String(value || '').trim(),
    getEditIdentity: () => ({ barberia_id: 198, slug: 'barberia-prueba-4' })
  });
  vm.runInContext([
    extractFunction(registroHtml, 'buildEditNavigationData'),
    extractFunction(registroHtml, 'buildRegistroEditSeedData')
  ].join('\n'), context);

  const payload = {
    mode: 'edit',
    barberia_id: 198,
    slug: 'barberia-prueba-4',
    collections_patch: {
      barberos: { upsert: [] },
      servicios: { upsert: [] },
      horarios: { upsert: [] }
    }
  };
  const seed = context.buildRegistroEditSeedData(payload);
  assert.strictEqual(seed.source, 'registro_edit_seed');
  assert.strictEqual(seed.barberos.length, 5);
  assert.strictEqual(seed.servicios.length, 3);
  assert.strictEqual(seed.horarios.length, 1);
  assert.strictEqual(seed.barberia.id, 198);
  assert.strictEqual(seed.barberia.slug, 'barberia-prueba-4');
}

const editorHydrationSource = [
  'getPayloadIdentity',
  'getRegistroEditSeedState',
  'mergeCollections',
  'mergeHours',
  'complementExistingCollection',
  'applyInheritedCollectionsFromPayload'
].map((name) => extractFunction(editorHtml, name)).join('\n');

function createHydrationHarness({ seed, query, initialBarbers, initialServices }) {
  const inheritedCollections = {
    barbers: initialBarbers.map((item) => ({ ...item })),
    services: initialServices.map((item) => ({ ...item })),
    hours: []
  };
  const logs = [];
  const context = vm.createContext({
    Array,
    Number,
    Object,
    Date,
    inheritedCollections,
    safeText: (value) => String(value || '').trim(),
    getQueryParam: (name) => String(query[name] || '').trim(),
    getQueryNumberParam: (...keys) => {
      for (const key of keys) {
        const value = Number(query[key]);
        if (Number.isFinite(value) && value > 0) return value;
      }
      return 0;
    },
    normalizeInheritedBarbers: (items) => Array.isArray(items) ? items.map((item) => ({ ...item })) : [],
    normalizeInheritedServices: (items) => Array.isArray(items) ? items.map((item) => ({ ...item })) : [],
    normalizeInheritedHours: (items) => Array.isArray(items) ? items.map((item) => ({ ...item })) : [],
    renderInheritedSeedSummary: () => {},
    logEditorHydrationSource: (source, details) => logs.push({ source, details }),
    getSeedIdentity: () => ({ barberia_id: 198, slug: 'barberia-prueba-4' }),
    firstDefined: (...values) => values.find((value) => value !== undefined && value !== null && value !== '')
  });
  vm.runInContext(editorHydrationSource, context);
  return { context, inheritedCollections, logs, state: context.getRegistroEditSeedState(seed) };
}

function applyPublic(harness, publicBarbers, publicServices) {
  harness.context.applyInheritedCollectionsFromPayload({
    barberos: publicBarbers,
    servicios: publicServices
  }, {
    preserveExistingCollections: harness.state.active,
    source: 'landing_public'
  });
}

function testHydrationPriority() {
  const query = {
    barberia_id: '198',
    slug: 'barberia-prueba-4',
    mode: 'edit',
    is_edit: '1',
    source: 'registro'
  };
  const registroSeed = {
    source: 'registro_edit_seed',
    created_at: new Date().toISOString(),
    barberia_id: 198,
    slug: 'barberia-prueba-4',
    barberos: makeBarbers(5),
    servicios: makeServices(3)
  };
  const publicBarbers = makeBarbers(3).map((item) => ({ ...item, nombre: `${item.nombre} publico` }));
  const publicServices = makeServices(3);

  const preferred = createHydrationHarness({
    seed: registroSeed,
    query,
    initialBarbers: registroSeed.barberos,
    initialServices: registroSeed.servicios
  });
  assert.strictEqual(preferred.state.active, true);
  applyPublic(preferred, publicBarbers, publicServices);
  assert.strictEqual(preferred.inheritedCollections.barbers.length, 5);
  assert.strictEqual(preferred.inheritedCollections.services.length, 3);
  assert.strictEqual(preferred.inheritedCollections.barbers[0].nombre, 'Barbero 1');

  const absent = createHydrationHarness({
    seed: {},
    query,
    initialBarbers: [],
    initialServices: []
  });
  assert.strictEqual(absent.state.active, false);
  applyPublic(absent, publicBarbers, publicServices);
  assert.strictEqual(absent.inheritedCollections.barbers.length, 3);
  assert.strictEqual(absent.inheritedCollections.services.length, 3);

  const wrongIdentitySeed = { ...registroSeed, barberia_id: 999, slug: 'otra-barberia' };
  const wrongIdentity = createHydrationHarness({
    seed: wrongIdentitySeed,
    query,
    initialBarbers: [],
    initialServices: []
  });
  assert.strictEqual(wrongIdentity.state.active, false);
  assert.strictEqual(wrongIdentity.state.identityMismatch, true);
  applyPublic(wrongIdentity, publicBarbers, publicServices);
  assert.strictEqual(wrongIdentity.inheritedCollections.barbers.length, 3);

  const oldDraft = makeBarbers(3).map((item) => ({ ...item, nombre: `${item.nombre} draft viejo` }));
  preferred.context.applyInheritedCollectionsFromPayload({ barberos: oldDraft }, {
    preserveExistingCollections: true,
    source: 'editor_draft'
  });
  assert.strictEqual(preferred.inheritedCollections.barbers.length, 5);
  assert.strictEqual(preferred.inheritedCollections.barbers[0].nombre, 'Barbero 1');
}

function testBuildSavePayloadUsesHydratedCollections() {
  const inheritedCollections = { barbers: makeBarbers(5), services: makeServices(3), hours: [] };
  const seedLandingData = { barberos: inheritedCollections.barbers, servicios: inheritedCollections.services };
  const context = vm.createContext({
    Array,
    Number,
    Object,
    String,
    inheritedCollections,
    seedLandingData,
    DEFAULT_BARBER_PHOTOS: ['https://fallback.test/barber.jpg'],
    DEFAULT_SERVICE_ICONS: ['bi-scissors'],
    safeText: (value) => String(value || '').trim(),
    firstDefined: (...values) => values.find((value) => value !== undefined && value !== null && value !== ''),
    safeImageUrl: (value) => String(value || '').trim(),
    getFormData: () => ({ address: '', maps_url: '', cover_url: '', logo_url: '', slot_min: 30 }),
    getSeedIdentity: () => ({ barberia_id: 198, slug: 'barberia-prueba-4', nombre: 'Barberia Prueba 4' }),
    getPublishSlug: () => 'barberia-prueba-4',
    getSelectedId: () => 'v2',
    byId: { v2: { id: 'v2', file: 'v2.html', name: 'V2' } },
    templates: [{ id: 'v2', file: 'v2.html', name: 'V2' }],
    getCanonicalSeedCoverUrl: () => '',
    getPublicSiteBase: () => 'https://example.test',
    getTemplatePublicPath: () => '/v2/',
    buildMapsEmbedUrl: () => '',
    root: { dataset: { uiTheme: 'dark' } },
    buildPublishedLandingUrls: () => ({ public_landing_url: 'https://example.test/b/barberia-prueba-4' }),
    buildCurrentEditorUrl: () => 'https://example.test/editor'
  });
  vm.runInContext([
    extractFunction(editorHtml, 'normalizeServiceForPublish'),
    extractFunction(editorHtml, 'normalizeBarberForPublish'),
    extractFunction(editorHtml, 'buildSavePayload')
  ].join('\n'), context);
  const payload = context.buildSavePayload();
  assert.strictEqual(payload.inherited.barberos.length, 5);
  assert.strictEqual(payload.inherited.servicios.length, 3);
  assert.strictEqual(payload.barberos.length, 5);
  assert.strictEqual(payload.servicios.length, 3);
}

function run() {
  validateInlineSyntax(registroHtml, 'registrobarberia.html');
  validateInlineSyntax(editorHtml, 'landing_editor_v2_unico_vscode.html');
  testRegistroSeedUsesFullDraft();
  testHydrationPriority();
  testBuildSavePayloadUsesHydratedCollections();
  assert(editorHtml.includes('preserveNonEmpty: true'), 'El guardrail publish debe conservar colecciones no vacias');
  console.log('PASS: registro edit 5/3, prioridad, identidad, draft viejo, payload y guardrail validados.');
}

try {
  run();
} catch (error) {
  console.error(error.stack || error.message);
  process.exit(1);
}
