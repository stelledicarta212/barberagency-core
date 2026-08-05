const { setup, cleanup, runSQL } = require('./run_postgres_query');

async function runTest(name, query) {
  try {
    const res = await runSQL(query);
    return { name, success: true, data: res };
  } catch (e) {
    return { name, success: false, error: e.message };
  }
}

(async () => {
  try {
    await setup();
    console.log('==================================================');
    console.log('STARTING SAAS BILLING & OUTBOX STAGING QA SUITE');
    console.log('==================================================\n');

    // 0. Preliminary Lookup
    const planPricesRaw = await runSQL("SELECT id, name, amount FROM public.plan_prices WHERE currency = 'COP' AND active = true;");
    const planPrices = Array.isArray(planPricesRaw) ? planPricesRaw : [];
    const monthlyPrice = planPrices.find(p => p.name === 'monthly');
    if (!monthlyPrice) {
      throw new Error("FAIL: Seed plan prices not found in public.plan_prices.");
    }
    const monthlyPriceId = monthlyPrice.id;
    console.log(`Using Plan Price ID: ${monthlyPriceId} (monthly COP)\n`);

    // Clean up any leftovers from previous test attempts
    await runSQL("DELETE FROM public.billing_outbox;");
    await runSQL("DELETE FROM public.payment_transactions;");
    await runSQL("DELETE FROM public.payment_attempts;");
    await runSQL("DELETE FROM public.billing_invoices;");
    await runSQL("DELETE FROM public.billing_checkouts;");

    // =========================================================================
    // PART 1: ROW LEVEL SECURITY (RLS) TESTS
    // =========================================================================
    console.log('--- RUNNING RLS & SECURITY TESTS ---');

    // Seed test invoices using postgres superuser (bypasses RLS)
    const invoiceAId = 'a0000000-0000-0000-0000-00000000000a';
    const invoiceBId = 'b0000000-0000-0000-0000-00000000000b';
    await runSQL(`
      INSERT INTO public.billing_invoices (id, barberia_id, amount, currency, status, due_date)
      VALUES 
        ('${invoiceAId}', 10, 50000.00, 'COP', 'open', now() + interval '30 days'),
        ('${invoiceBId}', 3, 50000.00, 'COP', 'open', now() + interval '30 days');
    `);

    // Case 1: Lectura Propia (User 10 reads Barberia 10)
    const rls1 = await runTest('Caso 1: Lectura Propia (User A lee Barberia A)', `
      SET ROLE authenticated;
      SET request.jwt.claims = '{"user_id": "10"}';
      SELECT id, amount, status FROM public.billing_invoices WHERE barberia_id = 10;
    `);
    const rls1Rows = Array.isArray(rls1.data) ? rls1.data : [];
    console.log('Caso 1 Success:', rls1.success, 'Rows:', rls1Rows.length);

    // Case 2: Intento de Lectura Ajena (User 10 reads Barberia 3)
    const rls2 = await runTest('Caso 2: Intento de Lectura Ajena (User A lee Barberia B)', `
      SET ROLE authenticated;
      SET request.jwt.claims = '{"user_id": "10"}';
      SELECT id, amount, status FROM public.billing_invoices WHERE barberia_id = 3;
    `);
    const rls2Rows = Array.isArray(rls2.data) ? rls2.data : [];
    console.log('Caso 2 Success:', rls2.success, 'Rows:', rls2Rows.length);

    // Case 3: Escritura Directa del Propietario (User 10 tries to insert invoice directly)
    const rls3 = await runTest('Caso 3: Escritura Directa del Propietario', `
      SET ROLE authenticated;
      SET request.jwt.claims = '{"user_id": "10"}';
      INSERT INTO public.billing_invoices (barberia_id, amount, currency, status, due_date)
      VALUES (10, 50000.00, 'COP', 'paid', now());
    `);
    // Note: Since continueOnFail is true in run_postgres_query, the error is inside rls3.data[0].error
    const rls3Error = rls3.data && rls3.data[0] && rls3.data[0].error ? rls3.data[0].message : null;
    console.log('Caso 3 Success (should fail):', !rls3Error, 'Error:', rls3Error);

    // Case 4: Alteración Manual de Suscripciones (User 10 tries to update subscriptions directly)
    const rls4 = await runTest('Caso 4: Alteración Manual de Suscripciones', `
      SET ROLE authenticated;
      SET request.jwt.claims = '{"user_id": "10"}';
      UPDATE public.subscriptions SET status = 'active' WHERE barberia_id = 10;
    `);
    const rls4Error = rls4.data && rls4.data[0] && rls4.data[0].error ? rls4.data[0].message : null;
    console.log('Caso 4 Success (should fail):', !rls4Error, 'Error:', rls4Error);

    // Case 5: Acceso Anónimo (Anon reads billing_invoices)
    const rls5 = await runTest('Caso 5: Acceso Anónimo a Facturas', `
      SET ROLE anon;
      SELECT * FROM public.billing_invoices;
    `);
    const rls5Rows = Array.isArray(rls5.data) ? rls5.data : [];
    console.log('Caso 5 Success:', rls5.success, 'Rows:', rls5Rows.length);

    // Case 6: Lectura de Catálogo Público (Anon reads active plan prices)
    const rls6 = await runTest('Caso 6: Lectura de Catálogo Público', `
      SET ROLE anon;
      SELECT name, amount FROM public.plan_prices WHERE active = true;
    `);
    const rls6Rows = Array.isArray(rls6.data) ? rls6.data : [];
    console.log('Caso 6 Success:', rls6.success, 'Rows:', rls6Rows.length);

    // Case 7: Privacidad de Tablas Backend (User tries to read webhook events and audit logs)
    const rls7a = await runTest('Caso 7a: Fuga de Webhooks', `
      SET ROLE authenticated;
      SET request.jwt.claims = '{"user_id": "10"}';
      SELECT * FROM public.payment_webhook_events;
    `);
    const rls7b = await runTest('Caso 7b: Fuga de Audit Logs', `
      SET ROLE authenticated;
      SET request.jwt.claims = '{"user_id": "10"}';
      SELECT * FROM public.billing_audit_logs;
    `);
    const rls7aError = rls7a.data && rls7a.data[0] && rls7a.data[0].error ? rls7a.data[0].message : null;
    const rls7bError = rls7b.data && rls7b.data[0] && rls7b.data[0].error ? rls7b.data[0].message : null;
    console.log('Caso 7a (Webhook) Success (should fail):', !rls7aError, 'Error:', rls7aError);
    console.log('Caso 7b (Audit Log) Success (should fail):', !rls7bError, 'Error:', rls7bError);

    console.log('\n--- CLEANING UP RLS SEEDS ---');
    await runSQL("DELETE FROM public.billing_invoices;");

    // Reset role back to postgres to allow processing seeds
    await runSQL("RESET ROLE; RESET request.jwt.claims;");

    // =========================================================================
    // PART 2: TRANSACTIONAL OUTBOX TESTS
    // =========================================================================
    console.log('\n--- RUNNING TRANSACTIONAL OUTBOX TESTS ---');

    // Case 8: Creación Atómica de Evento (Pago Aprobado)
    console.log('Caso 8: Creación Atómica de Evento');
    // Create checkout first (requires authenticated role)
    const checkoutRes = await runSQL(`
      SET ROLE authenticated;
      SET request.jwt.claims = '{"user_id": "10"}';
      SELECT * FROM public.billing_create_checkout(10, ${monthlyPriceId});
    `);
    const checkout = Array.isArray(checkoutRes) ? checkoutRes[0] : null;
    if (!checkout) {
      throw new Error("FAIL: Checkout could not be created.");
    }
    console.log('Created Checkout:', JSON.stringify(checkout));

    // Reset role back to postgres to run process function
    await runSQL("RESET ROLE; RESET request.jwt.claims;");

    // Process approved payment (runs with superuser role)
    const payRes = await runSQL(`
      SELECT * FROM public.billing_process_approved_payment(
        '${checkout.external_reference}',
        'mp_pay_test_00001',
        50000.00,
        1500.00,
        'credit_card'
      );
    `);
    console.log('Processed Payment Result:', JSON.stringify(payRes));

    // Check outbox events created
    const outboxEventsRaw = await runSQL(`
      SELECT event_type, status, barberia_id, subscription_id, invoice_id 
      FROM public.billing_outbox 
      WHERE correlation_id = '${checkout.checkout_id}';
    `);
    const outboxEvents = Array.isArray(outboxEventsRaw) ? outboxEventsRaw : [];
    console.log('Outbox Events Created:', JSON.stringify(outboxEvents, null, 2));

    // Case 9: Rollback Financiero (Forcing error)
    console.log('\nCaso 9: Rollback Financiero');
    const rollbackRes = await runTest('Rollback test', `
      SELECT * FROM public.billing_process_approved_payment(
        '${checkout.external_reference}',
        'mp_pay_test_00002',
        1000.00, -- Fail fraud check (should abort transaction)
        50.00,
        'credit_card'
      );
    `);
    // Inspect error
    const rollbackError = rollbackRes.data && rollbackRes.data[0] && rollbackRes.data[0].error ? rollbackRes.data[0].message : null;
    console.log('Rollback status (should fail):', !rollbackRes.success || !!rollbackError, 'Error:', rollbackError || rollbackRes.error);
    
    // Clear pool again in case rollback left aborted tx
    for (let i = 0; i < 5; i++) { try { await runSQL('ROLLBACK;'); } catch {} }

    const postRollbackOutboxCount = await runSQL(`
      SELECT COUNT(*) FROM public.billing_outbox WHERE correlation_id = '${checkout.checkout_id}' AND status = 'pending';
    `);
    console.log('Outbox events count remains unchanged:', postRollbackOutboxCount[0].count);

    // Case 10: Inserción de Evento Duplicado (Idempotencia)
    console.log('\nCaso 10: Idempotencia de Pago');
    const duplicateRes = await runSQL(`
      SELECT * FROM public.billing_process_approved_payment(
        '${checkout.external_reference}',
        'mp_pay_test_00001', -- Same provider ID
        50000.00,
        1500.00,
        'credit_card'
      );
    `);
    console.log('Idempotent Execution Result:', JSON.stringify(duplicateRes));

    // Case 11: Dos Workers Concurrentes (SKIP LOCKED)
    console.log('\nCaso 11: Concurrencia de Workers (SKIP LOCKED)');
    // Seed 10 pending events
    await runSQL("DELETE FROM public.billing_outbox;");
    await runSQL(`
      INSERT INTO public.billing_outbox (event_id, event_type, aggregate_type, aggregate_id, status, barberia_id, idempotency_key, payload)
      VALUES 
        (gen_random_uuid(), 'checkout_created', 'checkout', '1', 'pending', 10, 'ikey_1', '{}'::jsonb),
        (gen_random_uuid(), 'checkout_created', 'checkout', '2', 'pending', 10, 'ikey_2', '{}'::jsonb),
        (gen_random_uuid(), 'checkout_created', 'checkout', '3', 'pending', 10, 'ikey_3', '{}'::jsonb),
        (gen_random_uuid(), 'checkout_created', 'checkout', '4', 'pending', 10, 'ikey_4', '{}'::jsonb),
        (gen_random_uuid(), 'checkout_created', 'checkout', '5', 'pending', 10, 'ikey_5', '{}'::jsonb),
        (gen_random_uuid(), 'checkout_created', 'checkout', '6', 'pending', 10, 'ikey_6', '{}'::jsonb),
        (gen_random_uuid(), 'checkout_created', 'checkout', '7', 'pending', 10, 'ikey_7', '{}'::jsonb),
        (gen_random_uuid(), 'checkout_created', 'checkout', '8', 'pending', 10, 'ikey_8', '{}'::jsonb),
        (gen_random_uuid(), 'checkout_created', 'checkout', '9', 'pending', 10, 'ikey_9', '{}'::jsonb),
        (gen_random_uuid(), 'checkout_created', 'checkout', '10', 'pending', 10, 'ikey_10', '{}'::jsonb);
    `);

    // We execute two batch claims concurrently
    console.log('Worker A and Worker B claiming concurrent batches of 5...');
    const claimQueryA = "SELECT outbox_id AS id, event_type FROM public.billing_outbox_claim_batch('worker-a', 5, 300);";
    const claimQueryB = "SELECT outbox_id AS id, event_type FROM public.billing_outbox_claim_batch('worker-b', 5, 300);";
    
    const [batchARaw, batchBRaw] = await Promise.all([
      runSQL(claimQueryA),
      runSQL(claimQueryB)
    ]);
    const batchA = Array.isArray(batchARaw) ? batchARaw : [];
    const batchB = Array.isArray(batchBRaw) ? batchBRaw : [];
    
    console.log('Worker A claimed IDs:', batchA.map(e => e.id));
    console.log('Worker B claimed IDs:', batchB.map(e => e.id));
    
    // Assert no overlap
    const overlap = batchA.filter(a => batchB.some(b => b.id === a.id));
    console.log('Overlap count (expected 0):', overlap.length);

    // Case 12: Recuperación de Lock Abandonado (Stale Lock)
    console.log('\nCaso 12: Stale Lock Recovery');
    // Lock an event manually and set locked_at back by 10 minutes
    const staleEventId = batchA[0].id;
    await runSQL(`
      UPDATE public.billing_outbox 
      SET status = 'processing', locked_by = 'worker-a', locked_at = now() - interval '10 minutes'
      WHERE id = '${staleEventId}';
    `);
    
    // Trigger release
    const releaseRes = await runSQL("SELECT public.billing_outbox_release_stale_locks(300);");
    console.log('Released locks count:', JSON.stringify(releaseRes));
    
    // Check status
    const staleCheckRaw = await runSQL(`SELECT status, locked_by, locked_at FROM public.billing_outbox WHERE id = '${staleEventId}';`);
    const staleCheck = Array.isArray(staleCheckRaw) ? staleCheckRaw : [];
    console.log('Stale event status after release:', JSON.stringify(staleCheck));

    // Case 13: Fallo de Envío Externo (SMTP caído) y Backoff Exponencial
    console.log('\nCaso 13: Backoff Exponencial');
    const failEventId = batchB[0].id;
    // 1st failure (base backoff = 10s)
    await runSQL(`SELECT public.billing_outbox_mark_failed('${failEventId}', 'SMTP timeout', 'SMTP connection dropped', 10);`);
    const fail1Raw = await runSQL(`SELECT status, attempt_count, next_retry_at - created_at as delay FROM public.billing_outbox WHERE id = '${failEventId}';`);
    const fail1 = Array.isArray(fail1Raw) ? fail1Raw : [];
    console.log('Failure 1 Status & Delay:', JSON.stringify(fail1));

    // 2nd failure
    // Re-lock first to simulate claiming it again
    await runSQL(`UPDATE public.billing_outbox SET status = 'processing', locked_by = 'worker-a', locked_at = now(), attempt_count = attempt_count + 1 WHERE id = '${failEventId}';`);
    await runSQL(`SELECT public.billing_outbox_mark_failed('${failEventId}', 'SMTP timeout', 'SMTP connection dropped', 10);`);
    const fail2Raw = await runSQL(`SELECT status, attempt_count, next_retry_at - created_at as delay FROM public.billing_outbox WHERE id = '${failEventId}';`);
    const fail2 = Array.isArray(fail2Raw) ? fail2Raw : [];
    console.log('Failure 2 Status & Delay:', JSON.stringify(fail2));

    // Case 14: Exceso de Intentos Máximos (Dead-Letter)
    console.log('\nCaso 14: Dead-Letter Queue (DLQ)');
    // Fail 3 more times (to reach 5 attempts)
    for (let i = 3; i <= 5; i++) {
      await runSQL(`UPDATE public.billing_outbox SET status = 'processing', locked_by = 'worker-a', locked_at = now(), attempt_count = attempt_count + 1 WHERE id = '${failEventId}';`);
      await runSQL(`SELECT public.billing_outbox_mark_failed('${failEventId}', 'SMTP timeout', 'SMTP connection dropped', 10);`);
    }
    const dlqCheckRaw = await runSQL(`SELECT status, attempt_count FROM public.billing_outbox WHERE id = '${failEventId}';`);
    const dlqCheck = Array.isArray(dlqCheckRaw) ? dlqCheckRaw : [];
    console.log('Event status after 5 failures:', JSON.stringify(dlqCheck));
    const auditLogsRaw = await runSQL(`SELECT action, reason FROM public.billing_audit_logs WHERE entity_type = 'outbox' AND entity_id = '${failEventId}';`);
    const auditLogs = Array.isArray(auditLogsRaw) ? auditLogsRaw : [];
    console.log('Audit Log written:', JSON.stringify(auditLogs));

    // Case 15: Inmutabilidad de Procesados
    console.log('\nCaso 15: Inmutabilidad de Eventos Procesados');
    const processedEventId = batchA[1].id;
    // Mark processed
    await runSQL(`SELECT public.billing_outbox_mark_processed('${processedEventId}');`);
    
    // Attempt to update it back to pending
    const mutateRes = await runTest('Mutate processed', `
      UPDATE public.billing_outbox SET status = 'pending' WHERE id = '${processedEventId}';
    `);
    const mutateError = mutateRes.data && mutateRes.data[0] && mutateRes.data[0].error ? mutateRes.data[0].message : null;
    console.log('Mutate processed status (should fail):', !mutateRes.success || !!mutateError, 'Error:', mutateError || mutateRes.error);

    // =========================================================================
    // PART 3: CLEANUP
    // =========================================================================
    console.log('\n==================================================');
    console.log('CLEANING UP TEST RECORDS');
    console.log('==================================================');
    await runSQL("DELETE FROM public.billing_outbox;");
    await runSQL("DELETE FROM public.payment_transactions;");
    await runSQL("DELETE FROM public.payment_attempts;");
    await runSQL("DELETE FROM public.billing_invoices;");
    await runSQL("DELETE FROM public.billing_checkouts;");
    console.log('Staging cleanup completed successfully.\n');

  } catch (e) {
    console.error('Fatal error during QA tests execution:', e);
  } finally {
    await cleanup();
  }
})();
