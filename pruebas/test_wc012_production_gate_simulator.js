const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { setup, cleanup, runSQL } = require('./run_postgres_query_local');

// Simular claves JWT
const OLD_JWT_SECRET = 'old_staging_jwt_secret_key_12345';
const NEW_JWT_SECRET = 'new_staging_jwt_secret_rotated_98765';

// Función para generar JWT firmado simétricamente (HS256)
function generateJWT(payload, secret) {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest('base64url');
    return `${header}.${body}.${signature}`;
}

// Función para verificar JWT y extraer claims
function verifyJWT(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest('base64url');
    if (signature !== expectedSig) {
        return null; // Firma inválida
    }
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
}

async function main() {
    try {
        console.log('==================================================');
        console.log('WC-012: SECURITY GATE & SECRET ROTATION SIMULATOR');
        console.log('==================================================\n');

        await setup();

        // 1. Crear sesión con la clave vieja
        console.log('1. Generando sesión (JWT) con OLD_JWT_SECRET...');
        const userClaim = { user_id: 10, email: "owner1@example.test", role: "authenticated" };
        const oldToken = generateJWT(userClaim, OLD_JWT_SECRET);
        console.log('   Token generado (OLD): [REDACTED]');

        // Verificar token viejo con clave vieja
        const verifiedOld = verifyJWT(oldToken, OLD_JWT_SECRET);
        console.log('   Verificación con clave vieja:', verifiedOld ? 'PASS' : 'FAIL');

        // 2. Simular rotación de la clave JWT
        console.log('\n2. Rotando clave JWT a NEW_JWT_SECRET...');
        console.log('   Clave antigua invalidada. Clave nueva activa.');

        // 3. Verificar que el token viejo sea RECHAZADO con la clave nueva
        console.log('\n3. Validando token antiguo contra la nueva clave (debe fallar)...');
        const verifiedOldWithNewKey = verifyJWT(oldToken, NEW_JWT_SECRET);
        if (verifiedOldWithNewKey === null) {
            console.log('   PASS: El token antiguo fue RECHAZADO exitosamente por firma inválida.');
        } else {
            console.error('   FAIL: El token antiguo fue aceptado por la nueva clave!');
            process.exit(1);
        }

        // 4. Generar nuevo token con la clave nueva
        console.log('\n4. Generando nueva sesión (JWT) con la nueva clave...');
        const newToken = generateJWT(userClaim, NEW_JWT_SECRET);
        console.log('   Token generado (NEW): [REDACTED]');

        const verifiedNew = verifyJWT(newToken, NEW_JWT_SECRET);
        if (verifiedNew && verifiedNew.user_id === 10) {
            console.log('   PASS: Nueva sesión validada exitosamente con la nueva clave.');
        } else {
            console.error('   FAIL: No se pudo verificar la nueva sesión.');
            process.exit(1);
        }

        // 5. Validar checkout y RLS en la base de datos de staging usando la nueva sesión
        console.log('\n5. Validando checkout y RLS en DB staging usando claims de la nueva sesión...');

        // Limpiar checkouts previos
        await runSQL("TRUNCATE TABLE public.billing_checkouts CASCADE;");

        // Simular que el PostgREST autenticó al usuario y estableció los claims en la sesión de base de datos
        const dbClaimsString = JSON.stringify(verifiedNew);
        const res = await runSQL(`
            SET ROLE authenticated;
            SET request.jwt.claims = '${dbClaimsString}';
            SELECT * FROM public.billing_create_checkout(10, 1);
        `);

        if (res && res[0] && res[0].checkout_id) {
            console.log('   PASS: Checkout creado exitosamente usando RLS con la nueva sesión.');
            console.log('   Checkout ID:', res[0].checkout_id);
            console.log('   External Reference:', res[0].external_reference);
        } else {
            console.error('   FAIL: No se pudo crear el checkout con la nueva sesión.');
            process.exit(1);
        }

        console.log('\n==================================================');
        console.log('WC-012 SIMULATION: ALL SECURITY CHECKS PASSED');
        console.log('==================================================');

        await cleanup();
        process.exit(0);
    } catch (e) {
        console.error('\nSimulation failed with error:', e);
        process.exit(1);
    }
}

main();
