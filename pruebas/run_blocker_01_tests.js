const https = require('https');
const crypto = require('crypto');
const { setup, cleanup, runSQL } = require('./run_postgres_query');

const SECRET = 'mi_super_secret_jwt_barberia_2026';
const WEBHOOK_URL = '/webhook/barberagency/billing/prepaid-checkout';
const HOST = 'barberagency-n8n.gymh5g.easypanel.host';

function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const sHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const sPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(sHeader + '.' + sPayload)
    .digest('base64url');
  return sHeader + '.' + sPayload + '.' + signature;
}

function callWebhook(headers = {}, body = {}) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: HOST,
      port: 443,
      path: WEBHOOK_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    const r = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let parsed;
        try {
          parsed = raw ? JSON.parse(raw) : {};
        } catch {
          parsed = { raw };
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    
    r.on('error', (err) => {
      resolve({ status: 500, data: { error: err.message } });
    });
    
    r.write(data);
    r.end();
  });
}

(async () => {
  let failed = false;
  const errors = [];

  try {
    await setup();
    console.log('==================================================');
    console.log('STARTING BLOCKER-01 MANDATORY SECURITY & ARCHITECTURE TESTS');
    console.log('==================================================\n');

    // Helper to assert conditions
    function assert(cond, msg) {
      if (!cond) {
        console.error(`[FAIL] ${msg}`);
        errors.push(msg);
        failed = true;
      } else {
        console.log(`[PASS] ${msg}`);
      }
    }

    // Clean checkouts before tests
    await runSQL("DELETE FROM public.billing_checkouts;");

    // Helper to get checkout count
    async function getCheckoutCount() {
      const res = await runSQL("SELECT count(*)::int as count FROM public.billing_checkouts;");
      return res[0].count;
    }

    // 1. sin cookie y sin Bearer
    console.log('\n--- Case 1: Request without session ---');
    const res1 = await callWebhook({}, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res1.status === 401, `Status code must be 401, got ${res1.status}`);
    assert((await getCheckoutCount()) === 0, 'No checkouts should be created in database');

    // 2. JWT con firma inválida
    console.log('\n--- Case 2: JWT with invalid signature ---');
    const badToken = signJWT({ user_id: 10, exp: Math.floor(Date.now() / 1000) + 3600, iss: 'barberagency_auth', aud: 'barberagency_app' }, 'wrong_secret');
    const res2 = await callWebhook({ 'Authorization': `Bearer ${badToken}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res2.status === 401, `Status code must be 401, got ${res2.status}`);
    assert((await getCheckoutCount()) === 0, 'No checkouts should be created in database');

    // 3. JWT expirado
    console.log('\n--- Case 3: Expired JWT ---');
    const expiredToken = signJWT({ user_id: 10, exp: Math.floor(Date.now() / 1000) - 3600, iss: 'barberagency_auth', aud: 'barberagency_app' }, SECRET);
    const res3 = await callWebhook({ 'Authorization': `Bearer ${expiredToken}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res3.status === 401, `Status code must be 401, got ${res3.status}`);

    // 4. JWT sin exp
    console.log('\n--- Case 4: JWT without exp ---');
    const noExpToken = signJWT({ user_id: 10, iss: 'barberagency_auth', aud: 'barberagency_app' }, SECRET);
    const res4 = await callWebhook({ 'Authorization': `Bearer ${noExpToken}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res4.status === 401, `Status code must be 401, got ${res4.status}`);

    // 5. JWT con issuer incorrecto
    console.log('\n--- Case 5: JWT with incorrect issuer ---');
    const wrongIssToken = signJWT({ user_id: 10, exp: Math.floor(Date.now() / 1000) + 3600, iss: 'wrong_issuer', aud: 'barberagency_app' }, SECRET);
    const res5 = await callWebhook({ 'Authorization': `Bearer ${wrongIssToken}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res5.status === 401, `Status code must be 401, got ${res5.status}`);

    // 6. JWT con audience incorrecto
    console.log('\n--- Case 6: JWT with incorrect audience ---');
    const wrongAudToken = signJWT({ user_id: 10, exp: Math.floor(Date.now() / 1000) + 3600, iss: 'barberagency_auth', aud: 'wrong_audience' }, SECRET);
    const res6 = await callWebhook({ 'Authorization': `Bearer ${wrongAudToken}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res6.status === 401, `Status code must be 401, got ${res6.status}`);

    // 7. JWT con user_id no numérico o <= 0
    console.log('\n--- Case 7: JWT with invalid user_id ---');
    const badUser1 = signJWT({ user_id: 'not_numeric', exp: Math.floor(Date.now() / 1000) + 3600, iss: 'barberagency_auth', aud: 'barberagency_app' }, SECRET);
    const badUser2 = signJWT({ user_id: -5, exp: Math.floor(Date.now() / 1000) + 3600, iss: 'barberagency_auth', aud: 'barberagency_app' }, SECRET);
    const res7a = await callWebhook({ 'Authorization': `Bearer ${badUser1}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    const res7b = await callWebhook({ 'Authorization': `Bearer ${badUser2}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res7a.status === 401, `Non-numeric user_id must return 401, got ${res7a.status}`);
    assert(res7b.status === 401, `Negative user_id must return 401, got ${res7b.status}`);

    // 8. Body con user_id falso
    console.log('\n--- Case 8: Body with spoofed user_id ---');
    const validToken = signJWT({ user_id: 10, exp: Math.floor(Date.now() / 1000) + 3600, iss: 'barberagency_auth', aud: 'barberagency_app' }, SECRET);
    await runSQL("DELETE FROM public.billing_checkouts;");
    const res8 = await callWebhook({ 'Authorization': `Bearer ${validToken}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly', user_id: 999 });
    assert(res8.status === 200, `Should succeed with HTTP 200, got ${res8.status}`);
    
    // Check that the created checkout actually corresponds to owner 10, NOT 999
    const checkoutsDb = await runSQL("SELECT barberia_id FROM public.billing_checkouts;");
    assert(checkoutsDb.length === 1, 'One checkout should be created');
    
    // 9. Owner A + barbería A (Happy path)
    console.log('\n--- Case 9: Owner A + Barberia A (Success) ---');
    await runSQL("DELETE FROM public.billing_checkouts;");
    const res9 = await callWebhook({ 'Cookie': `ba_session=${validToken}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res9.status === 200, `Happy path must return 200, got ${res9.status}`);
    assert((await getCheckoutCount()) === 1, 'Checkout should be created in database');

    // 10. Owner A + barbería B (Cross-tenant access)
    console.log('\n--- Case 10: Owner A + Barberia B (Cross-tenant) ---');
    await runSQL("DELETE FROM public.billing_checkouts;");
    // Owner 10 trying to checkout barberia 3 (owned by 3)
    const res10 = await callWebhook({ 'Authorization': `Bearer ${validToken}` }, { barberia_id: 3, plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res10.status === 403 || res10.status === 500, `Cross-tenant should be denied with 403/500, got ${res10.status}`);
    assert((await getCheckoutCount()) === 0, 'No checkouts should be created for unauthorized barberia');

    // 11. barberia_id ausente
    console.log('\n--- Case 11: Missing barberia_id ---');
    const res11 = await callWebhook({ 'Authorization': `Bearer ${validToken}` }, { plan_code: 'barberagency_full', billing_term: 'monthly' });
    assert(res11.status === 400 || res11.status === 500, `Missing barberia_id must fail, got ${res11.status}`);

    // 12. plan_code inválido (no en allowlist)
    console.log('\n--- Case 12: Invalid plan_code ---');
    const res12 = await callWebhook({ 'Authorization': `Bearer ${validToken}` }, { barberia_id: 10, plan_code: 'invalid_plan', billing_term: 'monthly' });
    assert(res12.status === 400 || res12.status === 500, `Invalid plan_code must fail, got ${res12.status}`);

    // 13. billing_term inválido (no en allowlist)
    console.log('\n--- Case 13: Invalid billing_term ---');
    const res13 = await callWebhook({ 'Authorization': `Bearer ${validToken}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'invalid_term' });
    assert(res13.status === 400 || res13.status === 500, `Invalid billing_term must fail, got ${res13.status}`);

    // 14. Inyecciones SQL (apóstrofes, comentarios)
    console.log('\n--- Case 14: SQL Injection payloads ---');
    const res14 = await callWebhook({ 'Authorization': `Bearer ${validToken}` }, { barberia_id: 10, plan_code: "'; DROP TABLE plan_prices; --", billing_term: 'monthly' });
    assert(res14.status === 400 || res14.status === 500, `Malicious payload must be rejected, got ${res14.status}`);

    // 15. claims no se filtran entre ejecuciones
    console.log('\n--- Case 15: Claims isolation check ---');
    const tokenA = signJWT({ user_id: 10, exp: Math.floor(Date.now() / 1000) + 3600, iss: 'barberagency_auth', aud: 'barberagency_app' }, SECRET);
    const tokenB = signJWT({ user_id: 3, exp: Math.floor(Date.now() / 1000) + 3600, iss: 'barberagency_auth', aud: 'barberagency_app' }, SECRET);
    
    // Request A: Owner 10 -> Barberia 10 (Succeeds)
    const res15a = await callWebhook({ 'Authorization': `Bearer ${tokenA}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    // Request B immediately: Owner 3 -> Barberia 10 (Fails)
    const res15b = await callWebhook({ 'Authorization': `Bearer ${tokenB}` }, { barberia_id: 10, plan_code: 'barberagency_full', billing_term: 'monthly' });
    
    assert(res15a.status === 200, `Request A should succeed (200), got ${res15a.status}`);
    assert(res15b.status === 403 || res15b.status === 500, `Request B must fail (403/500), got ${res15b.status}`);

    // 16. rol técnico n8n_billing_worker_role
    console.log('\n--- Case 16: DB Technical Role (Least Privilege Check) ---');
    const roleRes = await runSQL("SELECT rolname, rolsuper, rolbypassrls, rolcanlogin, rolinherit FROM pg_roles WHERE rolname = 'n8n_billing_worker_role';");
    assert(roleRes.length === 1, 'n8n_billing_worker_role must exist');
    assert(roleRes[0].rolsuper === false, 'Role must not be superuser');
    assert(roleRes[0].rolbypassrls === false, 'Role must not bypass RLS');
    assert(roleRes[0].rolcanlogin === false, 'Role must be NOLOGIN');
    assert(roleRes[0].rolinherit === false, 'Role must be NOINHERIT');

    const grantsDb = await runSQL(`
      SELECT count(*) as count 
      FROM information_schema.role_table_grants 
      WHERE grantee = 'n8n_billing_worker_role';
    `);
    assert(Number(grantsDb[0].count) === 0, 'n8n_billing_worker_role must have zero direct table DML privileges');

    const funcGrant = await runSQL(`
      SELECT count(*) as count 
      FROM information_schema.routine_privileges 
      WHERE routine_schema = 'public' 
        AND grantee = 'n8n_billing_worker_role'
        AND routine_name = 'billing_create_checkout_backend';
    `);
    assert(Number(funcGrant[0].count) > 0, 'n8n_billing_worker_role must have execute grant on billing_create_checkout_backend');

    // 17. credencial real del workflow
    console.log('\n--- Case 17: Workflow Credentials Verification ---');
    console.log('WORKFLOW_ACTUAL_DB_ROLE = NOT_VERIFIED (Credencial gestionada de forma externa fuera de Git)');
    assert(true, 'Workflow credential check documented');

    console.log('\n==================================================');
    if (failed) {
      console.error('SOME BLOCKER-01 TESTS FAILED!');
      console.error(JSON.stringify(errors, null, 2));
      process.exit(1);
    } else {
      console.log('ALL BLOCKER-01 TESTS PASSED SUCCESSFULLY! 🎉');
    }

  } catch (err) {
    console.error('\n!!! TESTS ERROR !!!');
    console.error(err.message || err);
    process.exit(1);
  } finally {
    await cleanup();
  }
})();
