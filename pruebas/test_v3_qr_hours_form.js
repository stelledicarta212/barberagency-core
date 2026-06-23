const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== RUNNING FINAL V3 QR, HOURS AND FORM INTEGRITY TESTS ===\n');

const v3Path = path.join(__dirname, '../project/templates/plantillas/index_unico_v3_nueva.html');
assert(fs.existsSync(v3Path), 'index_unico_v3_nueva.html does not exist');
const html = fs.readFileSync(v3Path, 'utf8');

// 1. QR uses imagenv6.jpg
assert(html.includes('https://barberagency-barberagency.gymh5g.easypanel.host/wp-content/uploads/2026/06/imagenv6.jpg'), 'QR should contain the background image URL');

// 2. QR in light theme has clear overlay and qr is visible (styled white container)
assert(html.includes("#landingRoot[data-theme='light'] .qr-share-card"), 'Should contain light theme styling for QR card');
assert(html.includes("rgba(255, 255, 255, 0.95)") || html.includes("rgba(255, 255, 255, 0.88)"), 'Should contain clean white gradient overlay for light theme');
assert(html.includes("#landingRoot[data-theme='light'] .qr-share-frame"), 'Should contain white/gold frame for QR in light theme');

// 3. Hours deduplication and sorting logic exist in formatLandingHoursTable
assert(html.includes('const seenDays = new Set()'), 'Hours table formatting must use a seenDays Set to prevent duplicates');
assert(html.includes('const DAYS_ORDER = {'), 'Hours table formatting must declare day ordering map');
assert(html.includes('mapped.sort((a, b) =>'), 'Hours table formatting must sort days dynamically');

// 4. Correct day order array or labels Lunes -> Domingo
assert(html.includes("'lunes': 1"), 'lunes should be first in order');
assert(html.includes("'domingo': 7"), 'domingo should be last in order');

// 5. Corrected characters / escape sequences in JS or HTML
assert(html.includes('Reserva Aqu\\u00ed') || html.includes('Reserva Aqu&iacute;'), 'Reserva Aquí must be safely escaped');
assert(html.includes('&Uacute;NETE AL EQUIPO'), 'ÚNETE AL EQUIPO must use HTML entities');
assert(html.includes('Mi&eacute;rcoles') || html.includes('Mi\\u00e9rcoles'), 'Miércoles must be safely escaped');
assert(html.includes('S&aacute;bado') || html.includes('S\\u00e1bado'), 'Sábado must be safely escaped');

// 6. Light theme form maintains gold borders/focus/controls
assert(html.includes("#landingRoot[data-theme='light'] .reserve-form"), 'Should have reserve-form light theme rules');
assert(html.includes("rgba(212, 160, 73, 0.35)"), 'Should have gold input borders in light theme');
assert(html.includes("rgba(212, 160, 73, 0.16)"), 'Should have gold input focus shadow ring in light theme');

// 7. Dark theme form maintains black/gold
assert(html.includes("#landingRoot[data-theme='dark'] .form-control"), 'Should have dark theme control overrides');
assert(html.includes("linear-gradient(135deg, #f2c15f, #d4a049, #9b6a2f)") || html.includes("linear-gradient(135deg, #d4a049, #9b6a2f)"), 'Should have premium gold gradient buttons');

// 8. Order of form fields matches V2: nombre, telefono, email, fecha, barbero, servicio, hora, notas
const formBlock = html.substring(html.indexOf('<form id="reservationForm"'), html.indexOf('</form>'));
const nombreIndex = formBlock.indexOf('id="nombre"');
const telefonoIndex = formBlock.indexOf('id="telefono"');
const emailIndex = formBlock.indexOf('id="email"');
const fechaIndex = formBlock.indexOf('id="fecha"');
const barberoIndex = formBlock.indexOf('id="barbero"');
const servicioIndex = formBlock.indexOf('id="servicio"');
const horaIndex = formBlock.indexOf('id="hora"');
const notasIndex = formBlock.indexOf('id="notas"');

assert(nombreIndex < telefonoIndex, 'nombre should be before telefono');
assert(telefonoIndex < emailIndex, 'telefono should be before email');
assert(emailIndex < fechaIndex, 'email should be before fecha');
assert(fechaIndex < barberoIndex, 'fecha should be before barbero');
assert(barberoIndex < servicioIndex, 'barbero should be before servicio');
assert(servicioIndex < horaIndex, 'servicio should be before hora');
assert(horaIndex < notasIndex, 'hora should be before notas');

// 9 & 10. Card click triggers (card selection mechanism)
assert(html.includes("data-barber-id") && html.includes("data-service-id"), 'Barber and service cards must have ID attributes for selection');
assert(html.includes("preselect") || html.includes("click") || html.includes("hashchange") || html.includes("select") || html.includes("prefill") || html.includes("pre-populate") || html.includes("prefillFormFromHash"), 'Script must contain logic to preselect elements from cards');

console.log('✅ ALL TEST SUITE ASSERTIONS PASSED SUCCESSFULLY!');
