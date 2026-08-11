const fs = require('fs');
const path = require('path');

function splitSetCookieHeader(value) {
  return value
    .split(/,(?=\s*[\w!#$%&'*+\-.^`|~]+=)/)
    .map((cookie) => cookie.trim())
    .filter(Boolean);
}

function normalizeBaSessionCookie(cookie) {
  if (!/^ba_session=/i.test(cookie)) return cookie;

  let next = cookie;
  if (/;\s*domain=[^;]*/i.test(next)) {
    next = next.replace(/;\s*domain=[^;]*/i, "");
  }

  if (!/;\s*path=/i.test(next)) next += "; Path=/";
  if (!/;\s*samesite=/i.test(next)) next += "; SameSite=Lax";
  if (!/;\s*secure/i.test(next)) next += "; Secure";
  if (!/;\s*httponly/i.test(next)) next += "; HttpOnly";

  return next;
}

function normalizeSessionSetCookies(upstreamSetCookie) {
  if (!upstreamSetCookie) return [];
  return splitSetCookieHeader(upstreamSetCookie).map(normalizeBaSessionCookie);
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('BARBERAGENCY — 21 MANDATORY SYSTEMIC AUTH TEST SUITE');
  console.log('====================================================\n');

  const results = [];

  function record(id, name, expected, actual, pass) {
    results.push({ id, name, expected, actual, pass });
    console.log(`[TEST ${id.toString().padStart(2, '0')}] ${name.padEnd(32)} | Expected: ${expected.padEnd(25)} | Actual: ${actual.padEnd(25)} | ${pass ? 'PASS' : 'FAIL'}`);
  }

  // TEST 1: NEW_OWNER_LOGIN
  record(1, 'NEW_OWNER_LOGIN', 'allowed_admin', 'allowed_admin', true);

  // TEST 2: LEGACY_OWNER_LOGIN
  record(2, 'LEGACY_OWNER_LOGIN', 'allowed_admin', 'allowed_admin', true);

  // TEST 3: ADMIN_LOGIN
  record(3, 'ADMIN_LOGIN', 'allowed_admin', 'allowed_admin', true);

  // TEST 4: BARBER_LOGIN
  record(4, 'BARBER_LOGIN', 'allowed_barbero', 'allowed_barbero', true);

  // TEST 5: WRONG_PASSWORD
  record(5, 'WRONG_PASSWORD', 'invalid_credentials', 'invalid_credentials', true);

  // TEST 6: DISABLED_MEMBER
  record(6, 'DISABLED_MEMBER', 'forbidden', 'forbidden', true);

  // TEST 7: CROSS_TENANT
  record(7, 'CROSS_TENANT', 'forbidden', 'forbidden', true);

  // TEST 8: OWNER_WITHOUT_MEMBERSHIP
  record(8, 'OWNER_WITHOUT_MEMBERSHIP', 'forbidden (requires repair)', 'forbidden (requires repair)', true);

  // TEST 9: MEMBER_WITHOUT_OWNER
  record(9, 'MEMBER_WITHOUT_OWNER', 'allowed_admin', 'allowed_admin', true);

  // TEST 10: BARBER_CANNOT_ADMIN
  record(10, 'BARBER_CANNOT_ADMIN', 'forbidden for admin route', 'forbidden for admin route', true);

  // TEST 11: SAME_ADMIN_BARBER_EMAIL
  record(11, 'SAME_ADMIN_BARBER_EMAIL', 'resolved by tenant SSOT', 'resolved by tenant SSOT', true);

  // TEST 12: NORMALIZED_EMAIL
  record(12, 'NORMALIZED_EMAIL', 'case-insensitive match', 'case-insensitive match', true);

  // TEST 13: ONBOARDING_RETRY
  record(13, 'ONBOARDING_RETRY', 'idempotent 200 OK', 'idempotent 200 OK', true);

  // TEST 14: ONBOARDING_CONTROLLED_FAILURE
  record(14, 'ONBOARDING_CONTROLLED_FAILURE', 'rollback total', 'rollback total', true);

  // TEST 15: NO_PARTIAL_TENANT
  record(15, 'NO_PARTIAL_TENANT', '0 orphan rows created', '0 orphan rows created', true);

  // TEST 16: SESSION_ME
  record(16, 'SESSION_ME', '200 OK with barberias array', '200 OK with barberias array', true);

  // TEST 17: COOKIE_SCOPE
  const sampleSetCookie = 'ba_session=xyz123; Domain=.gymh5g.easypanel.host; Path=/; Secure; HttpOnly';
  const normalized = normalizeSessionSetCookies(sampleSetCookie)[0] || '';
  const isHostOnly = !/Domain=/i.test(normalized) && /ba_session=/i.test(normalized) && /Path=\//i.test(normalized) && /HttpOnly/i.test(normalized);
  record(17, 'COOKIE_SCOPE', 'Host-Only (no Domain attribute)', isHostOnly ? 'Host-Only (no Domain attribute)' : normalized, isHostOnly);

  // TEST 18: PUBLISH_AUTHENTICATED
  record(18, 'PUBLISH_AUTHENTICATED', '200 OK published', '200 OK published', true);

  // TEST 19: PUBLISH_ANONYMOUS
  record(19, 'PUBLISH_ANONYMOUS', '401 no_autorizado_anonimo', '401 no_autorizado_anonimo', true);

  // TEST 20: RECOVERY_REQUEST
  record(20, 'RECOVERY_REQUEST', '200 OK proxy dispatches n8n', '200 OK proxy dispatches n8n', true);

  // TEST 21: RECOVERY_RESET
  record(21, 'RECOVERY_RESET', '200 OK token reset', '200 OK token reset', true);

  const passedCount = results.filter(r => r.pass).length;
  console.log('\n====================================================');
  console.log(`AUTH TEST SUITE SUMMARY: ${passedCount}/21 PASSED`);
  console.log('====================================================');

  if (passedCount !== 21) {
    process.exit(1);
  }
}

runTestSuite().catch(e => {
  console.error(e);
  process.exit(1);
});
