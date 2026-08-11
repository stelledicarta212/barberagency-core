const { setup, cleanup, runSQL } = require('./run_postgres_query_local');
const { reconcilePayment } = require('./payment_reconciliation_recovery');

const ATTEMPT_ID = '40000000-0000-0000-0000-000000000001';
const PROVIDER_REF = 'mp_rec_test_100';

async function cleanupRecoveryFixtures() {
    const invoiceRows = await runSQL(`
        SELECT DISTINCT bi.id, bi.metadata->>'checkout_id' AS checkout_id
        FROM public.billing_invoices bi
        LEFT JOIN public.payment_attempts pa ON pa.invoice_id = bi.id
        WHERE pa.id = '${ATTEMPT_ID}'
           OR pa.provider_ref = '${PROVIDER_REF}'
    `);
    const invoiceIds = invoiceRows.map((row) => row.id);
    const invoiceList = invoiceIds.map((id) => `'${id}'`).join(',');
    const checkoutIds = invoiceRows.map((row) => row.checkout_id).filter(Boolean);
    const checkoutList = checkoutIds.map((id) => `'${id}'`).join(',');

    const transactionRows = await runSQL(`
        SELECT id
        FROM public.payment_transactions
        WHERE provider_payment_id = '${PROVIDER_REF}'
           OR payment_attempt_id = '${ATTEMPT_ID}';
    `);
    const transactionIds = transactionRows.map((row) => row.id);
    const transactionList = transactionIds.map((id) => `'${id}'`).join(',');

    if (transactionList || invoiceList) {
        await runSQL(`
            DELETE FROM public.billing_outbox
            WHERE ${transactionList ? `payment_transaction_id IN (${transactionList})` : 'false'}
               OR ${invoiceList ? `invoice_id IN (${invoiceList})` : 'false'};
        `);
    }

    await runSQL(`
        DELETE FROM public.payment_transactions
        WHERE provider_payment_id = '${PROVIDER_REF}'
           OR payment_attempt_id = '${ATTEMPT_ID}';
    `);

    await runSQL(`
        DELETE FROM public.payment_attempts
        WHERE id = '${ATTEMPT_ID}'
           OR provider_ref = '${PROVIDER_REF}';
    `);

    if (invoiceList) {
        await runSQL(`
            DELETE FROM public.billing_invoices
            WHERE id IN (${invoiceList});
        `);
    }

    await runSQL(`
        DELETE FROM public.payment_webhook_events
        WHERE provider_event_id = '${PROVIDER_REF}'
           OR payload->'data'->>'id' = '${PROVIDER_REF}';
    `);

    if (checkoutList) {
        await runSQL(`
            DELETE FROM public.billing_checkouts
            WHERE id IN (${checkoutList})
              AND barberia_id = 10;
        `);
    }
}

async function cleanupCheckoutFixtures(checkoutId) {
    const invoiceRows = await runSQL(`
        SELECT id
        FROM public.billing_invoices
        WHERE metadata->>'checkout_id' = '${checkoutId}';
    `);
    const invoiceIds = invoiceRows.map((row) => row.id);
    const invoiceList = invoiceIds.map((id) => `'${id}'`).join(',');

    if (!invoiceList) return;

    const transactionRows = await runSQL(`
        SELECT pt.id
        FROM public.payment_transactions pt
        JOIN public.payment_attempts pa ON pa.id = pt.payment_attempt_id
        WHERE pa.invoice_id IN (${invoiceList});
    `);
    const transactionIds = transactionRows.map((row) => row.id);
    const transactionList = transactionIds.map((id) => `'${id}'`).join(',');

    await runSQL(`
        DELETE FROM public.billing_outbox
        WHERE invoice_id IN (${invoiceList})
           OR ${transactionList ? `payment_transaction_id IN (${transactionList})` : 'false'};
    `);

    await runSQL(`
        DELETE FROM public.payment_transactions
        WHERE payment_attempt_id IN (
            SELECT id FROM public.payment_attempts WHERE invoice_id IN (${invoiceList})
        );
    `);

    await runSQL(`
        DELETE FROM public.payment_attempts
        WHERE invoice_id IN (${invoiceList});
    `);

    await runSQL(`
        DELETE FROM public.billing_invoices
        WHERE id IN (${invoiceList});
    `);
}

async function main() {
    let exitCode = 0;
    try {
        console.log('==================================================');
        console.log('WC-012: DETERMINISTIC RECOVERY SCENARIOS TESTS');
        console.log('==================================================\n');

        await setup();

        await cleanupRecoveryFixtures();

        // Crear checkout e intento pendiente para simular "Webhook not received"
        console.log('1. Creando checkout y pago pendiente para simulación...');
        const checkout = await runSQL(`
            SET ROLE authenticated;
            SET request.jwt.claims = '{"user_id": 10, "email": "owner1@example.test", "role": "authenticated"}';
            SELECT * FROM public.billing_create_checkout(10, 1);
        `);
        const checkoutId = checkout[0].checkout_id;
        const extRef = checkout[0].external_reference;
        await runSQL('RESET ROLE;');
        await cleanupCheckoutFixtures(checkoutId);

        const invoice = await runSQL(`
            INSERT INTO public.billing_invoices (id, barberia_id, amount, currency, status, due_date, metadata)
            VALUES (gen_random_uuid(), 10, 50000.00, 'COP', 'open', now(), jsonb_build_object('checkout_id', '${checkoutId}'))
            RETURNING id;
        `);
        const invoiceId = invoice[0].id;

        await runSQL(`
            INSERT INTO public.payment_attempts (id, barberia_id, invoice_id, amount, currency, provider, provider_ref, status, created_at)
            VALUES ('${ATTEMPT_ID}', 10, '${invoiceId}', 50000.00, 'COP', 'mercadopago', '${PROVIDER_REF}', 'pending', now() - interval '2 hours');
        `);

        // Test Case A: Mercado Pago approved but webhook not received
        console.log('\nTest Case A: Reconciliando pago sin webhook recibido (a partir de pending attempt)...');
        const recovery1 = await reconcilePayment(PROVIDER_REF);
        console.log('   Primer run:', recovery1.success ? 'PASS' : `FAIL (${recovery1.error})`);
        if (!recovery1.success) throw new Error('FIRST_RECOVERY_FAILED');
        const processedInvoiceId = recovery1.result?.[0]?.invoice_id || recovery1.invoice_id;
        if (processedInvoiceId !== invoiceId) throw new Error('RECOVERY_PROCESSED_UNEXPECTED_INVOICE');

        // Verificar estados
        const invoiceStatus = await runSQL(`SELECT status FROM public.billing_invoices WHERE id = '${invoiceId}';`);
        console.log('   Factura después de reconciliación (debe ser paid):', invoiceStatus[0].status);
        if (invoiceStatus[0].status !== 'paid') throw new Error('INVOICE_NOT_PAID');

        // Test Case B: Reprocesamiento idempotente (Second run)
        console.log('\nTest Case B: Ejecutando reconciliación por segunda vez (debe ser idempotente)...');
        const recovery2 = await reconcilePayment(PROVIDER_REF);
        console.log('   Segundo run:', recovery2.success ? 'PASS' : `FAIL (${recovery2.error})`);
        console.log('   Ya procesado:', recovery2.already_processed ? 'PASS' : 'FAIL');
        if (!recovery2.success || !recovery2.already_processed) throw new Error('SECOND_RECOVERY_NOT_IDEMPOTENT');

        // Verificar cantidad de transacciones registradas
        const txCount = await runSQL(`SELECT COUNT(*) FROM public.payment_transactions WHERE provider_payment_id = '${PROVIDER_REF}';`);
        console.log('   Conteo de transacciones físicas en DB (debe ser 1):', txCount[0].count);
        if (parseInt(txCount[0].count, 10) !== 1) throw new Error('TRANSACTION_COUNT_NOT_ONE');

        console.log('\n==================================================');
        console.log('WC-012 RECOVERY TESTS: ALL SCENARIOS PASSED');
        console.log('==================================================');
    } catch (e) {
        console.error('Recovery test failed:', e);
        exitCode = 1;
    } finally {
        try {
            await cleanupRecoveryFixtures();
        } finally {
            await cleanup();
        }
    }
    process.exit(exitCode);
}

main();
