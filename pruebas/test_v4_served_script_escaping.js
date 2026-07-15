const assert = require('assert');

const ORIGIN = 'https://barberagency-barberagency.gymh5g.easypanel.host';
const URLS = [
  `${ORIGIN}/index_unico_v4_editorial/`,
  `${ORIGIN}/b/barberia-prueba-4`,
];

function extractInlineScripts(html) {
  return [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1]);
}

async function verifyUrl(url) {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}v4_script_escape_test=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  assert.strictEqual(response.status, 200, `${url} returned HTTP ${response.status}`);

  const html = await response.text();
  const scripts = extractInlineScripts(html);
  const functionalScript = scripts.find((script) =>
    script.includes('function readLandingSeed') && script.includes('function renderServices')
  );
  assert(functionalScript, `${url} does not contain the V4 functional script`);

  scripts.forEach((script, index) => {
    assert(!script.includes('&#038;'), `${url} script #${index + 1} contains &#038;`);
    assert(!script.includes('&#038;&#038;'), `${url} script #${index + 1} contains &#038;&#038;`);
  });
  assert.doesNotThrow(() => new Function(functionalScript), `${url} functional script is invalid`);
  assert(html.includes('Array.isArray(barbersVal)'), `${url} is missing the barbersVal correction`);

  const slugFunction = functionalScript.slice(functionalScript.indexOf('function getLandingSlug()'));
  assert(
    slugFunction.indexOf('window.location?.pathname') < slugFunction.indexOf('getStoredLandingSlug()'),
    `${url} does not prioritize pathname before storage`
  );
  return { response, html, functionalScript };
}

(async () => {
  const legacy = await verifyUrl(URLS[0]);
  const publicPage = await verifyUrl(URLS[1]);

  assert.strictEqual(
    publicPage.response.headers.get('x-barberagency-template-id'),
    'v4',
    'Public URL did not report template v4'
  );
  assert(publicPage.html.includes('window.BA_LANDING_ROUTE_CONTEXT'), 'Missing route context');

  const match = publicPage.html.match(/^window\.BA_LANDING_ROUTE_CONTEXT\s*=\s*(.+);\s*$/m);
  assert(match, 'Could not extract BA_LANDING_ROUTE_CONTEXT');
  const context = JSON.parse(match[1]);
  assert.strictEqual(context.servicios?.length, 3, 'Expected 3 real services');
  assert.strictEqual(context.barberos?.length, 3, 'Expected 3 real barbers');
  assert.strictEqual(context.horarios?.length, 7, 'Expected 7 real schedules');

  console.log('V4 served-script escaping regression passed.');
  console.log(`Legacy functional script bytes: ${legacy.functionalScript.length}`);
  console.log(`Public functional script bytes: ${publicPage.functionalScript.length}`);
  console.log('Context collections: services=3 barbers=3 schedules=7');
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
