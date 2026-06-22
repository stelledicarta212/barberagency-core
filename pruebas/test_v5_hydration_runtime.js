const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const templatePath = 'project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html';
const html = fs.readFileSync(templatePath, 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
const inline = scripts.find((script) => script.includes('function initLanding'));

assert(inline, 'No se encontró el runtime inline de V5');
scripts.filter((script) => script.trim()).forEach((script) => new vm.Script(script));
assert(/id=["']landingRoot["']/.test(html), 'Falta #landingRoot');

function sourceBetween(start, end) {
  const startAt = inline.indexOf(start);
  const endAt = inline.indexOf(end, startAt + start.length);
  assert(startAt >= 0 && endAt > startAt, `No se pudo extraer ${start}`);
  return inline.slice(startAt, endAt);
}

const sandbox = {
  console,
  URL,
  URLSearchParams,
  safeSeedText(value) { return value == null ? '' : String(value).trim(); },
  buildRuntimeBranding(value = {}) { return { ...value }; },
  pickFirstImage(...values) { return values.find(Boolean) || ''; },
  safeImageUrl(value) { return value == null ? '' : String(value).trim(); },
  resolveServiceImage(item) {
    return item?.imagen_url || item?.image_url || item?.foto_url || item?.photo || '';
  },
  toSeedNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  },
  DEFAULT_SERVICE_ICONS: ['bi-scissors'],
  DEFAULT_BARBER_PHOTOS: ['https://fallback.example/barber.jpg'],
};
vm.createContext(sandbox);
vm.runInContext(sourceBetween('function extractPublicLandingPayload', 'async function enrichPayloadServicesWithDbImages'), sandbox);
vm.runInContext(sourceBetween('function normalizeSeedService', 'function normalizeSeedBarber'), sandbox);
vm.runInContext(sourceBetween('function normalizeSeedBarber', 'function applyInheritedCollections'), sandbox);

function makePayload(collectionAliases = 'spanish') {
  const services = [1, 2, 3].map((id) => ({
    id,
    nombre: `Servicio ${id}`,
    precio: id * 10000,
    imagen_url: `https://r2.example/services/${id}.jpg`,
  }));
  const barbers = [439, 440, 445].map((id) => ({
    id,
    nombre: `Barbero ${id}`,
    foto_url: `https://r2.example/barbers/${id}.jpg`,
  }));
  return {
    ok: true,
    profile: { nombre_publico: 'Barberia Prueba 4', logo_url: 'https://r2.example/logo.png' },
    branding: { cover_url: 'https://r2.example/cover.jpg' },
    [collectionAliases === 'english' ? 'services' : 'servicios']: services,
    [collectionAliases === 'english' ? 'barbers' : 'barberos']: barbers,
  };
}

function renderPayload(raw) {
  const payload = sandbox.extractPublicLandingPayload(raw);
  const services = payload.servicios.map((item, index) => sandbox.normalizeSeedService(item, index));
  const barbers = payload.barberos.map((item, index) => sandbox.normalizeSeedBarber(item, index));
  const servicesDom = services.map((item) => `<article class="service-card"><img src="${item.imagen_url}"></article>`).join('');
  const barbersDom = barbers.map((item) => `<article class="barber-card"><img src="${item.foto_url}"></article>`).join('');
  return { payload, services, barbers, servicesDom, barbersDom };
}

const routeContext = renderPayload(makePayload('english'));
assert.strictEqual(routeContext.payload.profile.nombre_publico, 'Barberia Prueba 4');
assert.strictEqual(routeContext.services.length, 3);
assert.strictEqual(routeContext.barbers.length, 3);
assert.strictEqual((routeContext.servicesDom.match(/service-card/g) || []).length, 3);
assert.strictEqual((routeContext.barbersDom.match(/barber-card/g) || []).length, 3);
assert.strictEqual((routeContext.servicesDom.match(/https:\/\/r2\.example/g) || []).length, 3);
assert.strictEqual((routeContext.barbersDom.match(/https:\/\/r2\.example/g) || []).length, 3);
assert.strictEqual(routeContext.payload.profile.logo_url, 'https://r2.example/logo.png');
assert.strictEqual(routeContext.payload.branding.cover_url, 'https://r2.example/cover.jpg');

for (const barber of routeContext.barbers) {
  assert.strictEqual(barber.foto_url, barber.foto);
  assert.strictEqual(barber.foto_url, barber.imagen_url);
  assert.strictEqual(barber.foto_url, barber.image_url);
  assert.strictEqual(barber.foto_url, barber.photo);
  assert.strictEqual(barber.foto_url, barber.picture_url);
}

async function hydrateFromMockPublic(fetchMock) {
  const response = await fetchMock();
  return renderPayload(await response.json());
}

(async () => {
  const publicResult = await hydrateFromMockPublic(async () => ({
    async json() { return makePayload('spanish'); },
  }));
  assert.strictEqual(publicResult.services.length, 3);
  assert.strictEqual(publicResult.barbers.length, 3);

  const previewSeed = renderPayload({ inherited: makePayload('english') });
  assert.strictEqual(previewSeed.services.length, 3);
  assert.strictEqual(previewSeed.barbers.length, 3);

  const fallback = { services: [{ nombre: 'Fallback service' }], barbers: [{ nombre: 'Fallback barber' }] };
  const empty = renderPayload({ ok: true });
  const finalServices = empty.services.length ? empty.services : fallback.services;
  const finalBarbers = empty.barbers.length ? empty.barbers : fallback.barbers;
  assert.strictEqual(finalServices.length, 1);
  assert.strictEqual(finalBarbers.length, 1);

  assert(inline.includes('window.BA_LANDING_ROUTE_CONTEXT'));
  assert(inline.includes("sessionStorage.getItem('ba_landing_seed')"));
  assert(inline.includes("localStorage.getItem('ba_landing_seed')"));
  assert(inline.includes('await fetch(requestUrl'));
  assert(inline.includes("data.type !== 'BA_BRANDING_UPDATE'"));

  console.log('PASS V5 hydration: route context, landing/public, preview seed, aliases, DOM e fallback');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
