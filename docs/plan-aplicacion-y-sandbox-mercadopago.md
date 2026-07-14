# Plan de Aplicación Controlada y Sandbox de Mercado Pago

Este documento establece la estrategia y guía paso a paso para aplicar las migraciones de base de datos de facturación de forma segura en **BarberAgency**, y detalla el plan de pruebas en el entorno de **Sandbox (Pruebas)** de Mercado Pago.

---

## 1. Validación de los Scripts SQL (Análisis de Código de Solo Lectura)

Se realizó una auditoría línea por línea de los tres scripts SQL diseñados:
1.  **Sintaxis PostgreSQL:** Compatible con PostgreSQL v15/v16 (Neon / AWS RDS). Uso correcto de tipos de datos, checks y expresiones regulares.
2.  **Llaves Foráneas y ON DELETE:** 
    *   `ON DELETE CASCADE` aplicado únicamente en dependencias estrictas de inquilino (ej. borrar una barbería elimina sus checkouts y facturas para evitar registros huérfanos).
    *   `ON DELETE RESTRICT` aplicado en catálogos y transacciones de cobro (`plan_prices`, `payment_transactions`) para evitar que se borren tarifas comerciales o cobros aprobados vinculados a auditorías vigentes.
3.  **Idempotencia de Seeds:** El bloque de seed V2 valida estrictamente la existencia única de `barberagency_full` y aborta en caso de inconsistencia comercial, previniendo duplicados de tarifas COP.
4.  **RLS y Permisos Físicos:** Ajustados por completo para usar `public.jwt_user_id()` y RLS *fail-closed*. Se revoca todo a `PUBLIC` por defecto.

---

## 2. Secuencia de Aplicación Controlada de Migraciones

La aplicación física de cambios en la base de datos debe seguir el siguiente orden riguroso:

### Paso 1: Respaldo y Snapshot
*   **Acción:** Realizar un backup lógico completo de la base de datos de producción mediante `pg_dump` o tomar un snapshot instantáneo de almacenamiento ( Neon / AWS RDS Console).
*   **Propósito:** Garantizar un Punto de Restauración del Estado contractual (RPO = 0) antes de aplicar cualquier alteración de DDL.

### Paso 2: Aplicación del Parche de Códigos (`20260713_2026_add_plan_codes.sql`)
*   **Acción:** Ejecutar el script.
*   **Verificación:** 
    ```sql
    SELECT id, nombre, code, precio FROM public.planes ORDER BY id;
    ```
    *Resultado esperado:* 3 filas (`starter`, `pro_legacy`, `barberagency_full` con precio de 50000.00).

### Paso 3: Aplicación del Core de Cobros (`20260713_2027_expand_billing_core_v2.sql`)
*   **Acción:** Ejecutar el script. Esto creará las 10 nuevas tablas, inyectará los triggers de inmutabilidad y los stubs RPC, además de agregar las columnas a `public.subscriptions`.
*   **Verificación:**
    ```sql
    SELECT name, amount, currency, interval_type FROM public.plan_prices WHERE active = true;
    ```
    *Resultado esperado:* 4 filas de precios COP (`monthly`, `quarterly`, `semiannual`, `annual`).

### Paso 4: Aplicación de Permisos y Roles (`20260713_2028_billing_roles_and_grants.sql`)
*   **Acción:** Ejecutar el script. Asigna privilegios de mínimo acceso a los roles de PostgREST y revoca a `PUBLIC`.
*   **Verificación:**
    ```sql
    SELECT grantee, table_name, privilege_type 
    FROM information_schema.role_table_grants 
    WHERE table_name IN ('plan_prices', 'billing_invoices')
    ORDER BY table_name;
    ```
    *Resultado esperado:* Los roles de base de datos tienen permisos diferenciados (el usuario común solo lee mediante RLS, el worker escribe y lee).

---

## 3. Preparación de Sandbox de Mercado Pago (Colombia)

Para realizar pruebas funcionales de extremo a extremo sin afectar dinero real ni usar credenciales productivas, se deben configurar los siguientes parámetros:

### 3.1. Obtención de Credenciales de Sandbox
1.  Ingresar a la consola de [Mercado Pago Developers](https://www.mercadopago.com.co/developers/) con la cuenta administradora de BarberAgency.
2.  Crear una aplicación de pruebas o ingresar a la sección de **Credenciales de prueba**.
3.  Copiar las llaves públicas y privadas de prueba:
    *   `Public Key de Sandbox` (Para el frontend, si aplica).
    *   `Access Token de Sandbox` (Comienza por `TEST-...`, ej. `TEST-767149...` usado en los flujos previos).
4.  **Carga de Secreto en EasyPanel:** Cargar el `Access Token` obtenido en la variable del entorno local `MP_SANDBOX_ACCESS_TOKEN`. No guardar este token en git.

### 3.2. Configuración de Cuentas de Prueba (Test Users)
Para simular el flujo completo de Checkout Pro se requieren dos cuentas de prueba creadas en la consola de Mercado Pago:
*   **Cuenta Vendedor de Pruebas:** Genera la preferencia de cobro (Sandbox App).
*   **Cuenta Comprador de Pruebas:** Simula la sesión del administrador de la barbería que adquiere el plan.
    *   *Email de prueba comprador:* ej. `test_user_12345678@testuser.com`
    *   *Contraseña de prueba:* Provista por la consola.

### 3.3. Simulación de Tarjetas de Crédito de Prueba
Al redirigirse al Checkout Pro de Sandbox e iniciar sesión con la cuenta de comprador de pruebas, utilizar las siguientes tarjetas para simular escenarios de facturación:

| Marca de Tarjeta | Número de Tarjeta | CVV | Fecha Vencimiento | Resultado Esperado |
| :--- | :--- | :--- | :--- | :--- |
| **Visa (Aprobado)** | `4012 8888 8888 8881` | `123` | Mayor a fecha actual | Pago aprobado inmediato (`approved`). |
| **Mastercard (Fondos insuficientes)** | `5221 2222 2222 2228` | `123` | Mayor a fecha actual | Pago rechazado (`rejected` / `cc_rejected_insufficient_amount`). |
| **Visa (Falla de Red / Medición)** | `4012 8888 8888 8882` | `123` | Mayor a fecha actual | Pago en proceso / pendiente (`in_process`). |

### 3.4. Simulación de Webhooks (IPN) de Sandbox
Dado que las notificaciones de Mercado Pago requieren un endpoint con URL pública accesible por internet:
1.  **Túnel local / Easypanel:** Confirmar que la URL pública de pruebas de n8n sea:
    `https://barberagency-n8n.gymh5g.easypanel.host/webhook-test/mp-notification` (Gatilla el workflow `BA_MP_PAYMENT_WEBHOOK` en modo de pruebas).
2.  **Configuración en Mercado Pago Developer:**
    *   Ir a Configuración de Webhooks.
    *   Modo: **Sandbox**.
    *   URL de notificación: `https://barberagency-n8n.gymh5g.easypanel.host/webhook-test/mp-notification`
    *   Eventos suscritos: **Pagos (`payment`)**.
3.  **Simular Firma `x-signature`:** Al interactuar con el simulador de webhooks, verificar que n8n reciba y procese la firma de autenticación del header.
