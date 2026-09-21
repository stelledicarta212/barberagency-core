const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== STARTING QA BOOKING SELECTION & V3 DARK THEME TESTS ===\n');

// ---------------------------------------------------------------------
// TEST 1: V3 Dark Theme Premium & Word "Tema" Removal Verification
// ---------------------------------------------------------------------
console.log('Running TEST 1: V3 dark theme styling & button verification...');
const v3Path = path.join(__dirname, '../project/templates/plantillas/index_unico_v3_nueva.html');
assert(fs.existsSync(v3Path), 'index_unico_v3_nueva.html does not exist');
const v3Html = fs.readFileSync(v3Path, 'utf8');

// Verify premium black/gold dark theme properties exist
assert(v3Html.includes('--bg: #050505;'), 'V3 dark theme background should be #050505');
assert(v3Html.includes('--surface: #0b0b0b;'), 'V3 dark theme surface should be #0b0b0b');
assert(v3Html.includes('--card-bg: #111111;'), 'V3 dark theme card background should be #111111');
assert(v3Html.includes('--border: rgba(212, 160, 73, 0.22);'), 'V3 dark theme border should be gold-bronze style');

// Verify word "Tema" has been removed from button markup and JS
assert(!v3Html.includes('<i class="bi bi-moon-stars-fill"></i> Tema</button>'), 'V3 HTML still contains "Tema" text in toggle button');
assert(!v3Html.includes('themeToggle.innerHTML = theme === \'dark\' ? \'<i class="bi bi-sun-fill"></i> Tema\' : \'<i class="bi bi-moon-stars-fill"></i> Tema\''), 'V3 JS still sets "Tema" text in setTheme');

// Confirm light theme is untouched
assert(v3Html.includes('--bg: #f4f7f6;'), 'V3 light theme background should be untouched (#f4f7f6)');
assert(v3Html.includes('--surface: #ffffff;'), 'V3 light theme surface should be untouched (#ffffff)');

console.log('✅ TEST 1 passed successfully!\n');


// ---------------------------------------------------------------------
// TEST 2: Universal Booking Card Selection in V2, V3, V4, V5, V6, V7
// ---------------------------------------------------------------------
const templates = [
  { name: 'V2', file: 'project/templates/plantillas/index_unico_v2.html' },
  { name: 'V3', file: 'project/templates/plantillas/index_unico_v3_nueva.html' },
  { name: 'V4', file: 'project/templates/plantillas/index_unico_v4_editorial.html' },
  { name: 'V5', file: 'project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html' },
  { name: 'V6', file: 'project/templates/plantillas/index_unico_v6_negro_dorado.html' },
  { name: 'V7', file: 'project/templates/plantillas/index_unicov7.html' }
];

// Helper to create a dummy DOM element
const createDummyElement = (name = 'element') => ({
  addEventListener() {},
  setAttribute() {},
  getAttribute(attr) {
    if (attr === 'data-theme') return 'dark';
    return '';
  },
  style: {
    removeProperty() {},
    setProperty() {},
    display: '',
    gridTemplateColumns: ''
  },
  classList: {
    add() {},
    remove() {},
    toggle() {},
    contains() { return false; }
  },
  appendChild() {},
  removeChild() {},
  prepend() {},
  remove() {},
  contains() { return false; },
  childNodes: [],
  children: [],
  tagName: 'DIV',
  innerHTML: '',
  textContent: '',
  dataset: {},
  querySelector() { return null; },
  querySelectorAll() { return []; }
});

templates.forEach(t => {
  console.log(`Running TEST 2 (${t.name}): Booking selection logic verification...`);
  const templatePath = path.join(__dirname, '..', t.file);
  assert(fs.existsSync(templatePath), `${t.name} template file not found at: ${templatePath}`);
  const html = fs.readFileSync(templatePath, 'utf8');

  // Verify that data attributes were added to render function templates
  assert(html.includes('data-service-id=') || html.includes("setAttribute('data-service-id'"), `${t.name} template should output data-service-id`);
  assert(html.includes('data-barber-id=') || html.includes("setAttribute('data-barber-id'"), `${t.name} template should output data-barber-id`);
  assert(html.includes('bookingSelection'), `${t.name} template should contain bookingSelection helper`);

  // Extract inline scripts
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  // Find the main script block
  const scriptContent = scripts.find(s => s.includes('bookingSelection'));
  assert(scriptContent, `Could not find script block with bookingSelection in ${t.name}`);

  // Set up mock DOM environment
  const eventsFired = [];

  const createMockSelect = (id, optionsArray) => {
    const el = createDummyElement(id);
    el.tagName = 'SELECT';
    el.options = optionsArray.map(opt => ({
      value: String(opt.id),
      textContent: opt.nombre
    }));
    el.selectedIndex = -1;
    el.value = '';
    el.dispatchEvent = function(event) {
      eventsFired.push({ id, eventType: event.type, selectedIndex: this.selectedIndex });
    };
    return el;
  };

  const mockBarberSelect = createMockSelect('barbero', [
    { id: 439, nombre: 'Calvin C.' },
    { id: 440, nombre: 'Alexander M.' }
  ]);

  const mockServiceSelect = createMockSelect('servicio', [
    { id: 489, nombre: 'Corte de Cabello' },
    { id: 490, nombre: 'Afeitado Imperial' }
  ]);

  const clickListeners = [];
  const mockDocument = {
    addEventListener(event, callback) {
      if (event === 'click') {
        clickListeners.push(callback);
      }
    },
    getElementById(id) {
      if (id === 'barbero') return mockBarberSelect;
      if (id === 'servicio') return mockServiceSelect;
      if (id === 'reservar' || id === 'reservas') {
        return {
          scrollIntoView() {}
        };
      }
      return createDummyElement(id);
    },
    querySelector(selector) {
      if (selector === 'form' || selector === '#citasForm' || selector === '#reservationForm') {
        return {
          reset() {}
        };
      }
      return createDummyElement(selector);
    },
    querySelectorAll(selector) {
      return [createDummyElement(selector)];
    },
    createElement(tag) {
      return createDummyElement(tag);
    },
    createTextNode(text) {
      return { nodeType: 3, textContent: String(text || ''), remove() {} };
    },
    documentElement: createDummyElement('html'),
    body: createDummyElement('body')
  };

  const mockWindow = {
    addEventListener() {},
    matchMedia() {
      return { matches: false };
    },
    location: {
      search: '',
      pathname: '/b/barberia-prueba-4',
      origin: 'https://barberagency.example'
    }
  };

  const sandbox = {
    document: mockDocument,
    window: mockWindow,
    navigator: { userAgent: 'node' },
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    URL,
    URLSearchParams,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    localStorage: { getItem() { return null; }, setItem() {} },
    MutationObserver: class {
      constructor() {}
      observe() {}
    },
    console: {
      log() {},
      error() {},
      warn() {}
    }
  };

  vm.createContext(sandbox);

  // Set html as document.documentElement to make stripInjectedUi happy
  sandbox.html = mockDocument.documentElement;

  // Run the script block in the virtual machine
  try {
    vm.runInContext(scriptContent, sandbox);
  } catch (err) {
    console.error(`❌ Crash in script block for ${t.name}:`, err);
    process.exit(1);
  }

  assert(clickListeners.length > 0, `No click listener registered on document for ${t.name}`);
  const clickHandler = clickListeners[0];

  // Assist functions to trigger click
  const triggerClick = (targetMock) => {
    const eventMock = {
      target: targetMock
    };
    clickHandler(eventMock);
  };

  // Case A: Click Barber ID 439
  const barberTarget = {
    closest(selector) {
      if (selector === '.barber-card-cta') return null;
      if (selector === '[data-barber-id]') {
        return {
          getAttribute(attr) {
            if (attr === 'data-barber-id') return '439';
            if (attr === 'data-barber-name') return 'Calvin C.';
            return null;
          }
        };
      }
      return null;
    }
  };

  eventsFired.length = 0;
  mockBarberSelect.selectedIndex = -1;
  mockServiceSelect.selectedIndex = -1;

  triggerClick(barberTarget);

  assert.strictEqual(mockBarberSelect.selectedIndex, 0, `Barber was not correctly preselected in ${t.name}`);
  assert.strictEqual(eventsFired.find(e => e.id === 'barbero')?.eventType, 'change', `Change event was not fired for barber select in ${t.name}`);

  // Case B: Click Service ID 489
  const serviceTarget = {
    closest(selector) {
      if (selector === '[data-service-id]') {
        return {
          getAttribute(attr) {
            if (attr === 'data-service-id') return '489';
            if (attr === 'data-service-name') return 'Corte de Cabello';
            return null;
          }
        };
      }
      return null;
    }
  };

  eventsFired.length = 0;
  triggerClick(serviceTarget);

  assert.strictEqual(mockServiceSelect.selectedIndex, 0, `Service was not correctly preselected in ${t.name}`);
  assert.strictEqual(eventsFired.find(e => e.id === 'servicio')?.eventType, 'change', `Change event was not fired for service select in ${t.name}`);

  // Case C: Sequential Click (Service 489 then Barber 439 -> both should be selected)
  mockBarberSelect.selectedIndex = -1;
  mockServiceSelect.selectedIndex = -1;
  triggerClick(serviceTarget);
  triggerClick(barberTarget);
  assert.strictEqual(mockServiceSelect.selectedIndex, 0, `Service selection was lost in sequential click in ${t.name}`);
  assert.strictEqual(mockBarberSelect.selectedIndex, 0, `Barber selection was lost in sequential click in ${t.name}`);

  // Case D: CTA "Únete al equipo" should NOT trigger selection
  const ctaTarget = {
    closest(selector) {
      if (selector === '.barber-card-cta') return {};
      if (selector === '[data-barber-id]') {
        return {
          getAttribute() { return '9999'; }
        };
      }
      return null;
    }
  };

  mockBarberSelect.selectedIndex = -1;
  triggerClick(ctaTarget);
  assert.strictEqual(mockBarberSelect.selectedIndex, -1, `CTA Join-the-Team triggered selection in ${t.name}`);

  console.log(`✅ TEST 2 (${t.name}) passed successfully!\n`);
});

console.log('🎉 ALL SELECTION AND DARK THEME INTEGRITY TESTS PASSED!');
