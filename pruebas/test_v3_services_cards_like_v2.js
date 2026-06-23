const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('=== RUNNING V3 SERVICES CARDS (V2 LAYOUT INTEGRATION) TESTS ===\n');

const v3Path = path.join(__dirname, '../project/templates/plantillas/index_unico_v3_nueva.html');
assert(fs.existsSync(v3Path), 'index_unico_v3_nueva.html does not exist');
const html = fs.readFileSync(v3Path, 'utf8');

// 1 & 2 & 3 & 4 & 5. Check service rendering function contains the new V2-like markup
assert(html.includes('class="service-photo"'), 'Each service card should use service-photo image class');
assert(html.includes('class="service-card-body"'), 'Each service card should contain a service-card-body container');
assert(html.includes('class="service-copy"'), 'Each service card should contain a service-copy text element');
assert(html.includes('class="service-price-chip"'), 'Each service card should contain a service-price-chip element');
assert(html.includes('Reservar servicio'), 'Each service card should contain a "Reservar servicio" button');

// 6 & 7. Check style rules for service card layouts, overlay and golden border/glow
assert(html.includes('#landingRoot .service-card'), 'Should declare layout overrides for service-card');
assert(html.includes('.service-card::after'), 'Should declare an overlay gradient for service-card');
assert(html.includes('border: 1px solid rgba(212, 160, 73, 0.25)'), 'Dark theme service-card should use gold border');
assert(html.includes('border-color: rgba(212, 160, 73, 0.38) !important'), 'Light theme service-card should use gold border');
assert(html.includes('linear-gradient(180deg, rgba(255, 255, 255, 0.08)'), 'Light theme overlay gradient should be clear white');

// 8 & 9. Verify button gold gradients in light and dark theme
assert(html.includes('linear-gradient(135deg, #f2c15f, #d4a049, #9b6a2f)'), 'Main button should use the premium gold gradient globally');

// 10 & 11 & 12. Prefill logic preserves existing states and selects correct option
assert(html.includes("closest('[data-service-id]')"), 'Global click handler must capture data-service-id dynamically');
assert(html.includes("prefillBookingForm()"), 'Click handler must execute prefillBookingForm()');
const prefillFunc = html.substring(html.indexOf('function prefillBookingForm()'), html.indexOf('function openBookingForm()'));
assert(prefillFunc.includes('if (bookingSelection.barberId || bookingSelection.barberName)'), 'Barber selection must only prefill if barberId/barberName exists, preventing resetting selected barber');

// 13 & 14 & 15 & 16. Verify basic page structural selectors are untouched
assert(html.includes('id="reservationForm"'), 'Form container should exist');
assert(html.includes('id="barbersGrid"'), 'Barbers grid should exist');
assert(html.includes('id="qr-share"'), 'QR share section should exist');
assert(html.includes('id="landingHoursText"'), 'Hours text placeholder should exist');

console.log('✅ ALL SERVICES AS V2 TEST SUITE ASSERTIONS PASSED SUCCESSFULLY!');
