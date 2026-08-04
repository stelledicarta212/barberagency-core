const fs = require('fs');
const path = require('path');

const editorPath = path.resolve(__dirname, '..', 'project', 'templates', 'editor', 'landing_editor_v2_unico_vscode.html');
const editorCssPath = path.resolve(__dirname, '..', 'project', 'templates', 'base', 'editor.css');
const html = fs.readFileSync(editorPath, 'utf8');
const css = fs.readFileSync(editorCssPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function countMatches(pattern) {
  return (html.match(pattern) || []).length;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countRealElements(tagName, id, source = html) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*>`, 'gi');
  return (source.match(pattern) || []).length;
}

function normalizeSelector(value) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ',')
    .trim();
}

function getCssRule(selector) {
  const normalizedSelector = normalizeSelector(selector);
  const matches = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => normalizeSelector(match[1]) === normalizedSelector);
  assert(matches.length === 1, `Debe existir una sola regla CSS canonica para ${selector}.`);
  return matches[0][2];
}

function assertCssWidth(selector, expectedWidth) {
  const rule = getCssRule(selector);
  const widthPattern = new RegExp(`(?:^|;)\\s*width\\s*:\\s*${escapeRegExp(expectedWidth)}\\s*!important\\s*;`, 'i');
  assert(widthPattern.test(rule), `${selector} debe conservar width: ${expectedWidth} !important.`);
}

assert(countRealElements('button', 'btnViewDesktop') === 1, 'Debe existir exactamente un boton Desktop real.');
assert(countRealElements('button', 'btnViewTablet') === 1, 'Debe existir exactamente un boton Tablet real.');
assert(countRealElements('button', 'btnViewMobile') === 1, 'Debe existir exactamente un boton Mobile real.');
assert(countRealElements('iframe', 'preview') === 1, 'Debe existir exactamente un iframe #preview real.');
assert(/<link\b[^>]*href=["'][^"']*editor\.css(?:\?[^"']*)?["'][^>]*>/i.test(html), 'El editor debe conservar el enlace a editor.css.');

assertCssWidth('#ba-editor-v2 #preview.view-desktop', '100%');
assertCssWidth('#ba-editor-v2 #preview.view-tablet', '768px');
assertCssWidth('#ba-editor-v2 #preview.view-mobile', '375px');

const setViewModePattern = /\b(?:const|let|var)\s+setViewMode\s*=\s*\(\s*mode\s*\)\s*=>/g;
const desktopListenerPattern = /\bbtnDesktop\s*\.\s*addEventListener\s*\(\s*(['"`])click\1\s*,\s*\(\s*\)\s*=>\s*setViewMode\s*\(\s*(['"`])desktop\2\s*\)\s*\)/g;
const tabletListenerPattern = /\bbtnTablet\s*\.\s*addEventListener\s*\(\s*(['"`])click\1\s*,\s*\(\s*\)\s*=>\s*setViewMode\s*\(\s*(['"`])tablet\2\s*\)\s*\)/g;
const mobileListenerPattern = /\bbtnMobile\s*\.\s*addEventListener\s*\(\s*(['"`])click\1\s*,\s*\(\s*\)\s*=>\s*setViewMode\s*\(\s*(['"`])mobile\2\s*\)\s*\)/g;

function patternMatches(pattern, source) {
  return new RegExp(pattern.source, pattern.flags.replace('g', '')).test(source);
}

function maskNonCode(source) {
  const chars = [...source];
  const masked = [...source];
  let state = 'code';
  let escaped = false;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    const next = chars[index + 1];

    if (state === 'code') {
      if (char === '/' && next === '/') {
        masked[index] = masked[index + 1] = ' ';
        state = 'line-comment';
        index += 1;
      } else if (char === '/' && next === '*') {
        masked[index] = masked[index + 1] = ' ';
        state = 'block-comment';
        index += 1;
      } else if (char === "'" || char === '"' || char === '`') {
        masked[index] = ' ';
        state = char;
        escaped = false;
      }
      continue;
    }

    masked[index] = char === '\n' || char === '\r' ? char : ' ';
    if (state === 'line-comment') {
      if (char === '\n' || char === '\r') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        masked[index + 1] = ' ';
        state = 'code';
        index += 1;
      }
      continue;
    }
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === state) {
      state = 'code';
    }
  }

  return masked.join('');
}

function hasSetPreviewDeviceDefinition(source) {
  const code = maskNonCode(source);
  const directDefinition = /\b(?:(?:const|let|var)\s+setPreviewDevice\s*=|function\s+setPreviewDevice\s*\(|(?:window|globalThis)\s*\.\s*setPreviewDevice\s*=)/;
  if (directDefinition.test(code)) return true;

  const bracketAssignment = /\b(?:window|globalThis)\s*\[\s*(['"`])setPreviewDevice\1\s*\]\s*=/g;
  return [...source.matchAll(bracketAssignment)]
    .some((match) => /\S/.test(code.slice(match.index, match.index + match[0].search(/\[/))));
}

assert(patternMatches(setViewModePattern, 'const\n setViewMode=( mode ) =>'), 'setViewMode debe tolerar formatting equivalente.');
assert(patternMatches(desktopListenerPattern, 'btnDesktop . addEventListener("click",\n () => setViewMode(`desktop`) )'), 'Desktop debe tolerar comillas y whitespace equivalentes.');
assert(patternMatches(tabletListenerPattern, 'btnTablet.addEventListener(`click`,()=>\nsetViewMode("tablet"))'), 'Tablet debe tolerar comillas y whitespace equivalentes.');
assert(patternMatches(mobileListenerPattern, "btnMobile . addEventListener('click', () => setViewMode( 'mobile' ))"), 'Mobile debe tolerar comillas y whitespace equivalentes.');
assert(countRealElements('button', 'btnViewDesktop', '<button data-mode="desktop" id=\'btnViewDesktop\' type="button">') === 1, 'El conteo DOM debe tolerar atributos reordenados.');
assert(normalizeSelector('#ba-editor-v2\n  #preview.view-tablet') === normalizeSelector('#ba-editor-v2 #preview.view-tablet'), 'El selector CSS debe tolerar whitespace equivalente.');

const setPreviewDeviceDefinitions = [
  'const setPreviewDevice = () => {};',
  'let setPreviewDevice = () => {};',
  'var setPreviewDevice = () => {};',
  'function setPreviewDevice() {}',
  'window.setPreviewDevice = () => {};',
  'globalThis.setPreviewDevice = function() {};',
  "window['setPreviewDevice'] = () => {};",
  'window["setPreviewDevice"] = () => {};',
  "globalThis['setPreviewDevice'] = () => {};",
  'globalThis[`setPreviewDevice`] = () => {};'
];
setPreviewDeviceDefinitions.forEach((source) => {
  assert(hasSetPreviewDeviceDefinition(source), `Debe detectar definicion funcional: ${source}`);
});

const setPreviewDeviceTextOnly = [
  '// setPreviewDevice',
  '"setPreviewDevice"',
  "console.log('setPreviewDevice')",
  'const message = "window.setPreviewDevice = ..."',
  '/* globalThis["setPreviewDevice"] = () => {}; */'
];
setPreviewDeviceTextOnly.forEach((source) => {
  assert(!hasSetPreviewDeviceDefinition(source), `No debe detectar texto sin definicion: ${source}`);
});

assert(countMatches(setViewModePattern) === 1, 'Debe existir una sola implementacion setViewMode.');
assert(!hasSetPreviewDeviceDefinition(html), 'No debe existir un segundo sistema setPreviewDevice.');
assert(!html.includes('stopImmediatePropagation'), 'No debe usarse stopImmediatePropagation para tapar listeners duplicados.');
assert(!html.includes('previewDeviceBound'), 'No debe quedar el helper temporal previewDeviceBound.');

assert(countMatches(desktopListenerPattern) === 1, 'Debe existir un listener Desktop canonico.');
assert(countMatches(tabletListenerPattern) === 1, 'Debe existir un listener Tablet canonico.');
assert(countMatches(mobileListenerPattern) === 1, 'Debe existir un listener Mobile canonico.');

assert(countRealElements('button', 'saveDraft') === 1, 'Guardar borrador debe conservar un boton real unico.');
assert(countRealElements('button', 'publish') === 1, 'Publicar debe conservar un boton real unico.');
assert(countRealElements('button', 'goSelector') === 1, 'Cambiar plantilla debe conservar un boton real unico.');
assert(/\bel\s*\.\s*saveDraft\s*\.\s*addEventListener\s*\(\s*(['"`])click\1\s*,\s*\(\s*\)\s*=>\s*saveDraft\s*\(\s*\{\s*notify\s*:\s*true\s*\}\s*\)\s*\)/.test(html), 'Guardar borrador debe conservar su listener.');
assert(/\bel\s*\.\s*publish\s*\.\s*addEventListener\s*\(\s*(['"`])click\1\s*,\s*publishLanding\s*\)/.test(html), 'Publicar debe conservar su listener.');
assert(/\bel\s*\.\s*goSelector\s*\.\s*addEventListener\s*\(\s*(['"`])click\1\s*,\s*\(\s*\)\s*=>\s*\{/.test(html), 'Cambiar plantilla debe conservar su listener.');

const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].at(-1)?.[1] || '';
const switcherStart = /\b(?:const|let|var)\s+btnDesktop\s*=\s*document\s*\.\s*getElementById\s*\(\s*(['"`])btnViewDesktop\1\s*\)\s*;?/.exec(script);
assert(switcherStart, 'No se encontro el inicio del bloque canonico de responsive preview.');
const switcherTail = script.slice(switcherStart.index);
const switcherEnd = /\b(?:const|let|var)\s+btnPreviewDesktopSwitch\b/.exec(switcherTail);
assert(switcherEnd, 'No se encontro el final del bloque canonico de responsive preview.');
const switcherCode = switcherTail.slice(0, switcherEnd.index);

function makeElement(id) {
  return {
    id,
    dataset: {},
    attrs: {},
    listeners: {},
    classList: {
      values: new Set(),
      add(...classes) {
        classes.forEach((item) => this.values.add(item));
      },
      remove(...classes) {
        classes.forEach((item) => this.values.delete(item));
      },
      toggle(item, force) {
        if (force) this.values.add(item);
        else this.values.delete(item);
      },
      contains(item) {
        return this.values.has(item);
      },
      toString() {
        return [...this.values].join(' ');
      }
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    click() {
      assert(this.listeners.click, `${id} no tiene listener click.`);
      this.listeners.click({ preventDefault() {} });
    }
  };
}

const nodes = {
  preview: makeElement('preview'),
  btnViewDesktop: makeElement('btnViewDesktop'),
  btnViewTablet: makeElement('btnViewTablet'),
  btnViewMobile: makeElement('btnViewMobile')
};

const documentMock = {
  getElementById(id) {
    return nodes[id] || null;
  }
};

Function('document', switcherCode)(documentMock);

assert(nodes.btnViewDesktop.classList.contains('is-active'), 'Desktop debe ser el modo inicial activo.');
assert(!nodes.btnViewTablet.classList.contains('is-active'), 'Tablet debe iniciar inactivo.');
assert(!nodes.btnViewMobile.classList.contains('is-active'), 'Mobile debe iniciar inactivo.');

const cases = [
  ['desktop', nodes.btnViewDesktop, 'view-desktop'],
  ['tablet', nodes.btnViewTablet, 'view-tablet'],
  ['mobile', nodes.btnViewMobile, 'view-mobile']
];

for (const [mode, button, previewClass] of cases) {
  button.click();
  assert(nodes.preview.classList.contains(previewClass), `#preview debe contener ${previewClass}.`);
  assert(button.classList.contains('is-active'), `Boton ${mode} debe quedar activo.`);
  for (const [otherMode, otherButton, otherClass] of cases) {
    if (otherMode === mode) continue;
    assert(!nodes.preview.classList.contains(otherClass), `#preview no debe conservar ${otherClass}.`);
    assert(!otherButton.classList.contains('is-active'), `Boton ${otherMode} debe quedar inactivo.`);
  }
}

console.log('PASS editor preview device switcher');
