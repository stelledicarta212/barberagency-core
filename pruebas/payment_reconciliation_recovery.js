const { setup, cleanup, runSQL } = require('./run_postgres_query_local');

async function reconcilePayment(providerRef) {
    console.log(`[RECOVERY] Iniciando reconciliación automática para provider_ref: ${providerRef}`);

    // 1. Idempotencia: Verificar si ya existe una transacción procesada
    const checkTx = await runSQL(`
        SELECT pt.id, pa.invoice_id, pa.barberia_id
        FROM public.payment_transactions pt
        JOIN public.payment_attempts pa ON pt.payment_attempt_id = pa.id
        WHERE pt.provider_payment_id = '${providerRef}';
    `);

    if (checkTx && checkTx.length > 0) {
        console.log(`[RECOVERY] [IDEMPOTENTE] La transacción ya existe en PostgreSQL.`);
        console.log(`   Tx ID: ${checkTx[0].id}`);
        console.log(`   Invoice ID: ${checkTx[0].invoice_id}`);
        return { success: true, already_processed: true, txId: checkTx[0].id };
    }

    // 2. Localizar el webhook ingestado previamente en la tabla de base de datos
    const webhookEvent = await runSQL(`
        SELECT payload
        FROM public.payment_webhook_events
        WHERE provider_event_id = '${providerRef}'
           OR payload->'data'->>'id' = '${providerRef}'
        LIMIT 1;
    `);

    if (!webhookEvent || webhookEvent.length === 0) {
        console.log(`[RECOVERY] [WARN] No se encontró webhook previo para ${providerRef}. Reintentando con preflight cache o mock...`);
        // Si no hay webhook, fallback a buscar en los payment_attempts pendientes
        const pendingAttempt = await runSQL(`
            SELECT
                pa.amount,
                pa.currency,
                pa.provider_event_id,
                pa.provider_checkout_id,
                bc.external_reference
            FROM public.payment_attempts pa
            JOIN public.billing_invoices bi ON pa.invoice_id = bi.id
            JOIN public.billing_checkouts bc ON bi.metadata->>'checkout_id' = bc.id::text
            WHERE pa.provider_ref = '${providerRef}' AND pa.status = 'pending';
        `);

        if (!pendingAttempt || pendingAttempt.length === 0) {
            return { success: false, error: 'NO_TRANSACTION_OR_PENDING_ATTEMPT_FOUND' };
        }

        const att = pendingAttempt[0];
        console.log(`[RECOVERY] Reconciliando a partir de intento pendiente. External Reference: ${att.external_reference}`);
        await runSQL(`
            SELECT * FROM public.billing_register_webhook(
                'mercadopago',
                '${att.provider_event_id || providerRef}',
                'payment.updated',
                jsonb_build_object('data', jsonb_build_object('id', '${providerRef}'))
            );
        `);
        const result = await runSQL(`
            SELECT * FROM public.billing_process_approved_payment(
                '${att.external_reference}',
                '${providerRef}',
                '${att.provider_event_id || providerRef}',
                '${att.provider_checkout_id || providerRef}',
                ${att.amount},
                '${att.currency || 'COP'}',
                1500.00,
                'credit_card'
            );
        `);
        return { success: true, already_processed: false, result };
    }

    // 3. Procesar a partir del payload del webhook persistido
    const payload = webhookEvent[0].payload;
    const extRef = payload.external_reference || (payload.data && payload.data.external_reference);
    const providerCheckoutId = payload.provider_checkout_id || payload.preference_id || providerRef;
    const amount = payload.transaction_amount || 50000.00; // COP standard
    const currency = payload.currency_id || 'COP';
    const fee = payload.fee_details?.[0]?.amount || 1500.00;
    const method = payload.payment_method_id || 'credit_card';

    console.log(`[RECOVERY] Procesando payload de webhook. External Reference: ${extRef}, Monto: ${amount}`);

    const result = await runSQL(`
        SELECT * FROM public.billing_process_approved_payment(
            '${extRef}',
            '${providerRef}',
            '${providerRef}',
            '${providerCheckoutId}',
            ${amount},
            '${currency}',
            ${fee},
            '${method}'
        );
    `);

    return { success: true, already_processed: false, result };
}

// Para propósitos de test, exportar o correr directo si recibe argumentos
if (require.main === module) {
    (async () => {
        await setup();
        const args = process.argv.slice(2);
        const providerRef = args[0] || 'mp_pay_rec_001';
        const res = await reconcilePayment(providerRef);
        console.log('Resultado de Reconciliación:', JSON.stringify(res, null, 2));
        await cleanup();
    })();
}

module.exports = { reconcilePayment };
