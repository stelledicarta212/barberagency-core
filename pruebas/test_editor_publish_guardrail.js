const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const editorPath = path.resolve(
  __dirname,
  '..',
  'project',
  'templates',
  'editor',
  'landing_editor_v2_unico_vscode.html'
);
const html = fs.readFileSync(editorPath, 'utf8');

function extractFunction(name) {
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
  assert(paramsEnd > paramsStart, `No se pudieron extraer los parametros de ${name}`);
  const bodyStart = html.indexOf('{', paramsEnd);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === '{') depth += 1;
    if (html[index] === '}') depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`No se pudo extraer la funcion ${name}`);
}

function validateInlineSyntax() {
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let checked = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    if (!match[1].trim()) continue;
    new vm.Script(match[1], { filename: `${path.basename(editorPath)}#script-${checked + 1}` });
    checked += 1;
  }
  assert(checked > 0, 'No se encontraron scripts inline');
}

const functionSource = [
  'getMissingPublishCollections',
  'dedupeCanonicalCollection',
  'isConfirmedInitialRegistration',
  'omitEmptyPublishCollections',
  'prepareSafePublish',
  'applyPublishIdentity'
].map(extractFunction).join('\n');

const refreshFunctionSource = [
  'getCanonicalCollectionFromPayload',
  'dedupeCanonicalCollection',
  'readCanonicalIdentity',
  'canonicalIdentityMatches',
  'refreshCanonicalCollectionsBeforePublish'
].map(extractFunction).join('\n');

function createHarness({ barbers, services, rootBarbers, rootServices, refresh, seed, query = {} }) {
  const state = {
    barbers: [...barbers],
    services: [...services]
  };
  const metrics = { builds: 0, refreshes: 0, refreshOptions: [] };
  const context = vm.createContext({
    Array,
    Number,
    Object,
    Set,
    String,
    COLLECTION_PAYLOAD_KEYS: {
      servicios: ['servicios', 'services'],
      barberos: ['barberos', 'barbers']
    },
    SAFE_PUBLISH_BLOCK_MESSAGE:
      'No se pudo publicar de forma segura porque no fue posible recuperar los barberos o servicios actuales. Recarga el editor e intentalo nuevamente. No se realizo ningun cambio.',
    seedLandingData: seed || {},
    safeText: (value) => String(value || '').trim(),
    getQueryParam: (name) => String(query[name] || '').trim(),
    normalizeInheritedBarbers: (items) => items.map((item) => ({ ...item })),
    normalizeInheritedServices: (items) => items.map((item) => ({ ...item })),
    buildSavePayload: () => {
      metrics.builds += 1;
      return {
        barberia_id: 198,
        slug: 'barberia-prueba-4',
        barberos: rootBarbers === undefined ? [...state.barbers] : [...rootBarbers],
        servicios: rootServices === undefined ? [...state.services] : [...rootServices],
        inherited: {
          barberos: [...state.barbers],
          servicios: [...state.services]
        }
      };
    },
    refreshCanonicalCollectionsBeforePublish: async (identity, options) => {
      metrics.refreshes += 1;
      metrics.refreshOptions.push(options);
      return refresh({ identity, options, state });
    }
  });
  vm.runInContext(functionSource, context);
  return { context, metrics, state };
}

async function expectBlocked(harness, label) {
  await assert.rejects(
    () => harness.context.prepareSafePublish({ barberia_id: 198, slug: 'barberia-prueba-4' }, 198),
    /No se pudo publicar de forma segura/,
    label
  );
}

function createRefreshHarness(responseFactory) {
  const inheritedCollections = {
    barbers: [],
    services: [{ id_servicio: 10, nombre: 'Servicio local' }]
  };
  const metrics = { fetches: 0, persisted: 0, rendered: 0 };
  const context = vm.createContext({
    Array,
    Number,
    Object,
    Set,
    String,
    encodeURIComponent,
    CONFIG: { publicProfileEndpoint: 'https://example.test/landing/public' },
    DEFAULT_PUBLIC_PROFILE_ENDPOINT: 'https://example.test/landing/public',
    inheritedCollections,
    safeText: (value) => String(value || '').trim(),
    normalizeInheritedBarbers: (items) => items.map((item) => ({ ...item })),
    normalizeInheritedServices: (items) => items.map((item) => ({ ...item })),
    syncSeedIdentityFromPublicProfile: () => {},
    persistPublishedIdentityFromResponse: () => {},
    persistRegistroSeedContext: () => { metrics.persisted += 1; },
    renderInheritedSeedSummary: () => { metrics.rendered += 1; },
    fetch: async (url, options) => {
      metrics.fetches += 1;
      return responseFactory(url, options);
    }
  });
  vm.runInContext(refreshFunctionSource, context);
  return { context, inheritedCollections, metrics };
}

async function run() {
  validateInlineSyntax();

  const missingHarness = createHarness({
    barbers: [],
    services: [],
    refresh: async () => ({ ok: true, identityMismatch: false })
  });
  assert.deepStrictEqual([
    ...missingHarness.context.getMissingPublishCollections({
      inherited: {
        barberos: [{ id_barbero: 1 }, { id_barbero: 2 }, { id_barbero: 3 }],
        servicios: [{ id_servicio: 1 }, { id_servicio: 2 }, { id_servicio: 3 }]
      }
    })
  ], []);
  assert.deepStrictEqual([
    ...missingHarness.context.getMissingPublishCollections({
      barberos: [],
      servicios: [],
      inherited: {
        barberos: [{ id_barbero: 1 }],
        servicios: [{ id_servicio: 1 }]
      }
    })
  ], []);
  assert.deepStrictEqual([
    ...missingHarness.context.getMissingPublishCollections({
      inherited: { barberos: [], servicios: [{ id_servicio: 1 }] }
    })
  ], ['barberos']);
  assert.deepStrictEqual([
    ...missingHarness.context.getMissingPublishCollections({
      inherited: { barberos: [{ id_barbero: 1 }], servicios: [] }
    })
  ], ['servicios']);
  assert.deepStrictEqual([
    ...missingHarness.context.getMissingPublishCollections({
      inherited: { barberos: [], servicios: [] }
    })
  ], ['servicios', 'barberos']);
  assert.deepStrictEqual([
    ...missingHarness.context.getMissingPublishCollections({
      inherited: {
        barberos: [],
        barbers: [{ id_barbero: 1 }],
        servicios: [],
        services: [{ id_servicio: 1 }]
      }
    })
  ], []);

  const healthy = createHarness({
    barbers: [{ id_barbero: 1 }, { id_barbero: 2 }, { id_barbero: 3 }],
    services: [{ id_servicio: 1 }, { id_servicio: 2 }, { id_servicio: 3 }],
    rootBarbers: [],
    rootServices: [],
    refresh: async () => ({ ok: true, identityMismatch: false })
  });
  const healthyPayload = await healthy.context.prepareSafePublish(
    { barberia_id: 198, slug: 'barberia-prueba-4' },
    198
  );
  assert.strictEqual(healthyPayload.inherited.barberos.length, 3);
  assert.strictEqual(healthyPayload.inherited.servicios.length, 3);
  assert.strictEqual(healthyPayload.barberos.length, 0);
  assert.strictEqual(healthyPayload.servicios.length, 0);
  assert.strictEqual(healthy.metrics.builds, 1);
  assert.strictEqual(healthy.metrics.refreshes, 0);

  const missingBarbers = createHarness({
    barbers: [],
    services: [{ id_servicio: 10 }],
    refresh: async ({ options, state }) => {
      assert.deepStrictEqual([...options.only], ['barberos']);
      assert.strictEqual(options.preserveNonEmpty, true);
      state.barbers = [{ id_barbero: 20 }];
      return { ok: true, identityMismatch: false, recovered: ['barberos'] };
    }
  });
  const recoveredBarbers = await missingBarbers.context.prepareSafePublish(
    { barberia_id: 198, slug: 'barberia-prueba-4' },
    198
  );
  assert.strictEqual(recoveredBarbers.barberos.length, 1);
  assert.strictEqual(recoveredBarbers.servicios[0].id_servicio, 10);
  assert.strictEqual(missingBarbers.metrics.builds, 2);

  const missingServices = createHarness({
    barbers: [{ id_barbero: 20 }],
    services: [],
    refresh: async ({ options, state }) => {
      assert.deepStrictEqual([...options.only], ['servicios']);
      state.services = [{ id_servicio: 10 }];
      return { ok: true, identityMismatch: false, recovered: ['servicios'] };
    }
  });
  const recoveredServices = await missingServices.context.prepareSafePublish(
    { barberia_id: 198, slug: 'barberia-prueba-4' },
    198
  );
  assert.strictEqual(recoveredServices.servicios.length, 1);
  assert.strictEqual(recoveredServices.barberos[0].id_barbero, 20);

  await expectBlocked(createHarness({
    barbers: [],
    services: [],
    query: { edit: '1', mode: 'edit' },
    seed: {
      source: 'onboarding_complete',
      barberia_id: 198,
      slug: 'barberia-prueba-4'
    },
    refresh: async () => ({ ok: true, identityMismatch: false, recovered: [] })
  }), 'Edicion existente con ambas colecciones vacias debe bloquear');

  await expectBlocked(createHarness({
    barbers: [],
    services: [{ id_servicio: 10 }],
    refresh: async () => ({ ok: false, identityMismatch: false, recovered: [] })
  }), 'Fallo de landing/public debe bloquear');

  await expectBlocked(createHarness({
    barbers: [],
    services: [{ id_servicio: 10 }],
    refresh: async () => ({ ok: false, identityMismatch: true, recovered: [] })
  }), 'Identidad canonica distinta debe bloquear');

  const initialRegistration = createHarness({
    barbers: [],
    services: [],
    seed: {
      source: 'onboarding_complete',
      barberia_id: 198,
      slug: 'barberia-prueba-4',
      barberia: { id: 198, slug: 'barberia-prueba-4' }
    },
    refresh: async () => ({ ok: true, identityMismatch: false, recovered: [] })
  });
  const initialPayload = await initialRegistration.context.prepareSafePublish(
    { barberia_id: 198, slug: 'barberia-prueba-4' },
    198
  );
  assert(!Object.prototype.hasOwnProperty.call(initialPayload, 'barberos'));
  assert(!Object.prototype.hasOwnProperty.call(initialPayload, 'servicios'));
  assert(!Object.prototype.hasOwnProperty.call(initialPayload.inherited, 'barberos'));
  assert(!Object.prototype.hasOwnProperty.call(initialPayload.inherited, 'servicios'));

  const dedupeHarness = createHarness({
    barbers: [],
    services: [],
    refresh: async () => ({ ok: true, identityMismatch: false })
  });
  const dedupedBarbers = dedupeHarness.context.dedupeCanonicalCollection([
    { id_barbero: 439, nombre: 'Barbero prueba 4' },
    { id: 439, nombre: 'Duplicado por ID' },
    { nombre: 'barbero prueba 4' },
    { nombre: 'Sin ID' },
    { nombre: 'sin id' }
  ], 'barberos');
  assert.strictEqual(dedupedBarbers.length, 2);
  const dedupedServices = dedupeHarness.context.dedupeCanonicalCollection([
    { id_servicio: 489, nombre: 'Corte' },
    { servicio_id: 489, nombre: 'Duplicado por ID' },
    { nombre: 'Barba' },
    { nombre: 'barba' }
  ], 'servicios');
  assert.strictEqual(dedupedServices.length, 2);

  const selectiveRefresh = createRefreshHarness(async (url, options) => ({
    ok: true,
    json: async () => ({
      ok: true,
      barberia_id: 198,
      slug: 'barberia-prueba-4',
      barberos: [
        { id_barbero: 439, nombre: 'Barbero 1' },
        { id: 439, nombre: 'Duplicado' },
        { id_barbero: 440, nombre: 'Barbero 2' }
      ],
      servicios: [{ id_servicio: 99, nombre: 'Servicio canonico viejo' }]
    })
  }));
  const selectiveResult = await selectiveRefresh.context.refreshCanonicalCollectionsBeforePublish(
    { barberia_id: 198, slug: 'barberia-prueba-4' },
    { only: ['barberos'], preserveNonEmpty: true, barberiaId: 198 }
  );
  assert.strictEqual(selectiveResult.ok, true);
  assert.deepStrictEqual([...selectiveResult.recovered], ['barberos']);
  assert.strictEqual(selectiveRefresh.inheritedCollections.barbers.length, 2);
  assert.strictEqual(selectiveRefresh.inheritedCollections.services.length, 1);
  assert.strictEqual(selectiveRefresh.inheritedCollections.services[0].nombre, 'Servicio local');

  const mismatchRefresh = createRefreshHarness(async () => ({
    ok: true,
    json: async () => ({
      ok: true,
      barberia_id: 999,
      slug: 'otra-barberia',
      barberos: [{ id_barbero: 1, nombre: 'Ajeno' }]
    })
  }));
  const mismatchResult = await mismatchRefresh.context.refreshCanonicalCollectionsBeforePublish(
    { barberia_id: 198, slug: 'barberia-prueba-4' },
    { only: ['barberos'], preserveNonEmpty: true, barberiaId: 198 }
  );
  assert.strictEqual(mismatchResult.ok, false);
  assert.strictEqual(mismatchResult.identityMismatch, true);
  assert.strictEqual(mismatchRefresh.inheritedCollections.barbers.length, 0);

  const failedRefresh = createRefreshHarness(async () => ({
    ok: false,
    json: async () => ({ ok: false })
  }));
  const failedResult = await failedRefresh.context.refreshCanonicalCollectionsBeforePublish(
    { barberia_id: 198, slug: 'barberia-prueba-4' },
    { only: ['barberos'], preserveNonEmpty: true, barberiaId: 198 }
  );
  assert.strictEqual(failedResult.ok, false);
  assert.strictEqual(failedResult.identityMismatch, false);

  const runPublishRpcBlock = html.slice(
    html.indexOf('const runPublishRpc = async'),
    html.indexOf('let publishResult = await runPublishRpc')
  );
  assert(!runPublishRpcBlock.includes('buildSavePayload()'));
  assert(runPublishRpcBlock.includes('validatedPayload'));
  assert(html.includes('runPublishRpc(barberiaId, safePublishPayload)'));

  console.log('PASS: sintaxis inline y 7 escenarios del guardrail validados.');
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
