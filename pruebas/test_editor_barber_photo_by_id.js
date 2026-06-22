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
  const bodyStart = html.indexOf('{', paramsEnd);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === '{') depth += 1;
    if (html[index] === '}') depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`No se pudo extraer la funcion ${name}`);
}

const functionSource = [
  'getBarberCanonicalId',
  'getBarberComparableName',
  'resolveBarberPhotoTarget',
  'syncBarberPhotoAliases',
  'normalizeBarberForPublish',
  'handleBarberPhotoUpload'
].map(extractFunction).join('\n');

function makeBarbers(order = [439, 440, 445]) {
  return order.map((id) => ({
    id,
    id_barbero: id,
    barbero_id: id,
    nombre: `Barbero ${id}`,
    foto_url: `https://old.test/${id}.jpg`,
    foto: `https://old.test/${id}.jpg`,
    imagen_url: `https://old.test/${id}.jpg`,
    photo: `https://old.test/${id}.jpg`,
    picture_url: `https://old.test/${id}.jpg`
  }));
}

function createHarness({ order, barberId, index, expectedName = 'Barbero 439' }) {
  const barbers = makeBarbers(order);
  const seedBarbers = makeBarbers(order);
  const metrics = {
    alerts: [],
    fetches: 0,
    persisted: 0,
    rendered: 0,
    previews: 0
  };
  const context = vm.createContext({
    Array,
    Number,
    Object,
    String,
    DEFAULT_BARBER_PHOTOS: ['https://fallback.test/barber.jpg'],
    inheritedCollections: { barbers, services: [{ id_servicio: 489 }] },
    seedLandingData: { barberos: seedBarbers },
    safeText: (value) => String(value || '').trim(),
    firstDefined: (...values) => values.find((value) => value !== undefined && value !== null && value !== ''),
    FormData: class FormDataMock {
      append() {}
    },
    el: { bizName: { value: 'Barberia Prueba 4' } },
    toSlug: () => 'barberia-prueba-4',
    getUploadEndpointCandidates: () => ['https://upload.test'],
    fetch: async () => {
      metrics.fetches += 1;
      return { ok: true, json: async () => ({ url: 'https://new.test/439.jpg' }) };
    },
    buildUploadPublicUrl: () => 'https://new.test/439.jpg',
    persistRegistroSeedContext: () => { metrics.persisted += 1; },
    renderInheritedSeedSummary: () => { metrics.rendered += 1; },
    updatePreview: () => { metrics.previews += 1; },
    alert: (message) => { metrics.alerts.push(message); },
    console
  });
  vm.runInContext(functionSource, context);

  const btn = {
    textContent: 'Cambiar foto',
    disabled: false,
    closest: () => ({
      querySelector: () => ({ getAttribute: () => expectedName })
    })
  };
  const file = { type: 'image/jpeg', name: 'barber.jpg' };

  return { context, barbers, seedBarbers, metrics, btn, file, barberId, index };
}

function assertOnly439Changed(barbers, expectedUrl = 'https://new.test/439.jpg') {
  const aliases = ['foto_url', 'foto', 'imagen_url', 'photo', 'picture_url'];
  for (const barber of barbers) {
    for (const alias of aliases) {
      const expected = barber.id === 439 ? expectedUrl : `https://old.test/${barber.id}.jpg`;
      assert.strictEqual(barber[alias], expected, `Alias ${alias} incorrecto para ID ${barber.id}`);
    }
  }
}

async function runUpload(harness) {
  await harness.context.handleBarberPhotoUpload(
    harness.file,
    harness.barberId,
    harness.index,
    harness.btn
  );
}

async function run() {
  const normal = createHarness({ order: [439, 440, 445], barberId: '439', index: '0' });
  await runUpload(normal);
  assertOnly439Changed(normal.barbers);
  assertOnly439Changed(normal.seedBarbers);

  const reordered = createHarness({ order: [440, 445, 439], barberId: '439', index: '0' });
  await runUpload(reordered);
  assertOnly439Changed(reordered.barbers);
  assertOnly439Changed(reordered.seedBarbers);

  const wrongIndex = createHarness({ order: [440, 445, 439], barberId: '439', index: '1' });
  await runUpload(wrongIndex);
  assertOnly439Changed(wrongIndex.barbers);
  assertOnly439Changed(wrongIndex.seedBarbers);

  const fallback = createHarness({ order: [439, 440, 445], barberId: '999', index: '0' });
  await runUpload(fallback);
  assertOnly439Changed(fallback.barbers);
  assertOnly439Changed(fallback.seedBarbers);

  const invalidIndex = createHarness({ order: [439, 440, 445], barberId: '999', index: '8' });
  await runUpload(invalidIndex);
  assertOnly439Changed(invalidIndex.barbers, 'https://old.test/439.jpg');
  assert.strictEqual(invalidIndex.metrics.fetches, 0);
  assert.match(invalidIndex.metrics.alerts[0], /identificar de forma segura/);

  const incompatibleName = createHarness({
    order: [439, 440, 445],
    barberId: '999',
    index: '0',
    expectedName: 'Otro barbero'
  });
  await runUpload(incompatibleName);
  assert.strictEqual(incompatibleName.metrics.fetches, 0);
  assert.match(incompatibleName.metrics.alerts[0], /identificar de forma segura/);

  assert.strictEqual(normal.metrics.persisted, 1);
  assert.strictEqual(normal.metrics.rendered, 1);
  assert.strictEqual(normal.metrics.previews, 1);
  assert.strictEqual(normal.context.inheritedCollections.services[0].id_servicio, 489);

  const publishPayload = {
    inherited: {
      barberos: normal.barbers.map((barber, index) => normal.context.normalizeBarberForPublish(barber, index))
    }
  };
  const published439 = publishPayload.inherited.barberos.find((barber) => barber.id_barbero === 439);
  assert(published439, 'El payload no contiene el ID 439');
  assert.strictEqual(published439.foto_url, 'https://new.test/439.jpg');
  assert.strictEqual(published439.foto, 'https://new.test/439.jpg');
  assert.strictEqual(publishPayload.inherited.barberos.find((barber) => barber.id_barbero === 440).foto_url, 'https://old.test/440.jpg');
  assert.strictEqual(publishPayload.inherited.barberos.find((barber) => barber.id_barbero === 445).foto_url, 'https://old.test/445.jpg');

  const persistSource = extractFunction('persistRegistroSeedContext');
  assert(persistSource.includes('setSafeStorage(sessionStorage, STORAGE_LANDING_SEED, raw)'));
  assert(persistSource.includes('setSafeStorage(localStorage, STORAGE_LANDING_SEED, raw)'));

  console.log('PASS: foto de barbero resuelta por ID, fallback seguro, aliases, seed, preview y payload validados.');
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
