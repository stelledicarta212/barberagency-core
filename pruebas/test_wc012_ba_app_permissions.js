const { setup, cleanup, runSQL } = require('./run_postgres_query_local');
const pg = require('pg');

async function runAsRole(roleName, sqlQuery) {
    const client = new pg.Client({
        connectionString: process.env.POS_TEST_DATABASE_URL || 'postgres://ba_staging_owner:staging_secure_pass_123@127.0.0.1:55432/barberagency_staging'
    });
    await client.connect();
    try {
        await client.query(`SET ROLE ${roleName};`);
        const res = await client.query(sqlQuery);
        return { success: true, rows: res.rows };
    } catch (err) {
        return { success: false, error: err.message };
    } finally {
        await client.end();
    }
}

async function main() {
    try {
        console.log('==================================================');
        console.log('WC-012: BA_APP ROLE LEAST PRIVILEGE AUDIT TESTS');
        console.log('==================================================\n');

        await setup();

        // 1. Verificar existencia del rol y banderas de seguridad
        console.log('1. Verificando configuración del rol ba_app...');
        const roleInfo = await runSQL(`
            SELECT rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
            FROM pg_roles WHERE rolname = 'ba_app';
        `);
        if (!roleInfo || roleInfo.length === 0) {
            console.error('   FAIL: ¡El rol ba_app no existe en la base de datos!');
            process.exit(1);
        }

        const { rolsuper, rolcreaterole, rolcreatedb, rolbypassrls } = roleInfo[0];
        console.log(`   SUPERUSER:   ${rolsuper ? 'SI (FAIL)' : 'NO (PASS)'}`);
        console.log(`   BYPASSRLS:   ${rolbypassrls ? 'SI (FAIL)' : 'NO (PASS)'}`);
        console.log(`   CREATEDB:    ${rolcreatedb ? 'SI (FAIL)' : 'NO (PASS)'}`);
        console.log(`   CREATEROLE:  ${rolcreaterole ? 'SI (FAIL)' : 'NO (PASS)'}`);

        if (rolsuper || rolbypassrls || rolcreatedb || rolcreaterole) {
            console.error('   FAIL: El rol posee privilegios excesivos o banderas inseguras.');
            process.exit(1);
        }

        // 2. Operaciones autorizadas (RPCs)
        console.log('\n2. Probando operaciones AUTORIZADAS para ba_app...');

        const testWebhook = await runAsRole('ba_app', `
            SELECT * FROM public.billing_register_webhook(
                'mercadopago', 'evt_test_role_001', 'payment.created', '{"id": "evt_test_role_001"}'
            );
        `);
        console.log('   Execute billing_register_webhook:', testWebhook.success ? 'PASS' : `FAIL (${testWebhook.error})`);
        if (!testWebhook.success) process.exit(1);

        const testSelectAttempts = await runAsRole('ba_app', `SELECT COUNT(*) FROM public.payment_attempts;`);
        console.log('   Select on payment_attempts:', testSelectAttempts.success ? 'PASS' : `FAIL (${testSelectAttempts.error})`);
        if (!testSelectAttempts.success) process.exit(1);

        const testSelectSubs = await runAsRole('ba_app', `SELECT COUNT(*) FROM public.subscriptions;`);
        console.log('   Select on subscriptions:', testSelectSubs.success ? 'PASS' : `FAIL (${testSelectSubs.error})`);
        if (!testSelectSubs.success) process.exit(1);

        // 3. Operaciones denegadas (Unprivileged operations)
        console.log('\n3. Probando operaciones DENEGADAS (Seguridad Fail-Closed)...');

        const directWrite = await runAsRole('ba_app', `
            INSERT INTO public.billing_checkouts (id, barberia_id, plan_price_id, status, external_reference)
            VALUES (gen_random_uuid(), 10, 1, 'pending', 'ba_v1_10_monthly_test_direct');
        `);
        console.log('   Direct insert on billing_checkouts (debe fallar):', !directWrite.success ? `PASS (Denegado: ${directWrite.error})` : 'FAIL (¡Escritura directa permitida!)');
        if (directWrite.success) process.exit(1);

        const directSelectAudit = await runAsRole('ba_app', `SELECT * FROM public.billing_audit_logs;`);
        console.log('   Direct select on billing_audit_logs (debe fallar):', !directSelectAudit.success ? `PASS (Denegado: ${directSelectAudit.error})` : 'FAIL (¡Lectura directa permitida!)');
        if (directSelectAudit.success) process.exit(1);

        const ddlAttempt = await runAsRole('ba_app', `CREATE TABLE public.escalation_test (id int);`);
        console.log('   DDL execution CREATE TABLE (debe fallar):', !ddlAttempt.success ? `PASS (Denegado: ${ddlAttempt.error})` : 'FAIL (¡DDL permitido!)');
        if (ddlAttempt.success) process.exit(1);

        console.log('\n==================================================');
        console.log('WC-012 BA_APP SECURITY TESTS: ALL ASSERTIOMS PASSED');
        console.log('==================================================');
        await cleanup();
        process.exit(0);
    } catch (e) {
        console.error('Audit script failed:', e);
        await cleanup();
        process.exit(1);
    }
}

main();
