const assert = require('assert');
const vm = require('vm');

const PAGE_URL = 'https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-prueba-4';

function node(id = '') {
  return {
    id, src: '', href: '', value: '', min: '', innerHTML: '', textContent: '', dataset: {},
    childNodes: [], children: [], options: [], selectedIndex: -1, tagName: 'DIV',
    style: { setProperty() {}, removeProperty() {}, gridTemplateColumns: '' },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, setAttribute() {}, getAttribute() { return ''; },
    appendChild() {}, removeChild() {}, prepend() {}, remove() {}, reset() {},
    querySelector() { return node(); }, querySelectorAll() { return []; },
  };
}

(async () => {
  const response = await fetch(`${PAGE_URL}?served_dom_test=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  assert.strictEqual(response.status, 200);
  const html = await response.text();
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const script = scripts.find((value) => value.includes('function readLandingSeed'));
  assert(script, 'V4 functional script missing');
  const contextMatch = html.match(/^window\.BA_LANDING_ROUTE_CONTEXT\s*=\s*(.+);\s*$/m);
  assert(contextMatch, 'Route context missing');
  const context = JSON.parse(contextMatch[1]);

  const nodes = new Map();
  const getNode = (id) => {
    if (!nodes.has(id)) nodes.set(id, node(id));
    return nodes.get(id);
  };
  const document = {
    documentElement: getNode('documentElement'), body: getNode('body'),
    getElementById: getNode,
    createElement: (tag) => ({ ...node(), tagName: String(tag).toUpperCase() }),
    createTextNode: (text) => ({ ...node(), nodeType: 3, textContent: String(text) }),
    addEventListener() {},
    querySelector(selector) {
      if (selector.includes('reservationForm')) return getNode('reservationForm');
      return node(selector);
    },
    querySelectorAll(selector) {
      if (selector.includes('.navbar-brand') || selector.includes('.footer-brand')) {
        return [getNode('brandTop'), getNode('brandBottom')];
      }
      return [];
    },
  };
  getNode('reservationForm').querySelector = () => node('submit');
  getNode('reservationForm').reset = () => {};

  const window = {
    document,
    BA_LANDING_ROUTE_CONTEXT: context,
    location: { pathname: '/b/barberia-prueba-4', search: '', origin: new URL(PAGE_URL).origin, href: PAGE_URL },
    parent: null,
    addEventListener() {},
    matchMedia() { return { matches: false }; },
    scrollTo() {},
    sessionStorage: { getItem() { return null; }, setItem() {}, length: 0 },
    localStorage: { getItem() { return null; }, setItem() {}, length: 0 },
  };
  window.parent = window;

  const sandbox = {
    window, document, URL, URLSearchParams, Event: class { constructor(type) { this.type = type; } },
    navigator: { userAgent: 'node' },
    sessionStorage: window.sessionStorage, localStorage: window.localStorage,
    MutationObserver: class { observe() {} }, Node: { TEXT_NODE: 3 },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    console: { log() {}, info() {}, warn() {}, error() {} },
    setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  };
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);
  await Promise.resolve();

  const servicesHtml = getNode('servicesStrip').innerHTML;
  const barbersHtml = getNode('barbersGrid').innerHTML;
  const hoursHtml = getNode('v4HoursRows').innerHTML;
  const serviceCount = (servicesHtml.match(/data-service-id=/g) || []).length;
  const barberCount = (barbersHtml.match(/data-barber-id=/g) || []).length;
  const hourCount = context.horarios.filter((item) => item.activo !== false).length;

  assert.strictEqual(serviceCount, 3, `Rendered services: ${serviceCount}`);
  assert.strictEqual(barberCount, 3, `Rendered barbers: ${barberCount}`);
  assert.strictEqual(hourCount, 7, `Rendered schedules: ${hourCount}`);
  context.servicios.forEach((item) => assert(servicesHtml.includes(item.nombre)));
  context.barberos.forEach((item) => assert(barbersHtml.includes(item.nombre)));
  assert(!servicesHtml.includes('Skin Fade'), 'Service mocks were not replaced');
  assert(!barbersHtml.includes('Alan Mendez'), 'Barber mocks were not replaced');
  assert(hoursHtml.length > 0, 'Schedule DOM was not rendered');

  console.log('Served V4 DOM hydration passed: services=3 barbers=3 schedules=7; mocks replaced.');
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
