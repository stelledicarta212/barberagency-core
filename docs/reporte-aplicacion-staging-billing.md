# Reporte de Aplicación Controlada - Módulo Billing Staging

Este documento detalla la ejecución del plan de migración controlada del módulo de facturación SaaS (`SaaS Billing`) y el patrón `Transactional Outbox` en el entorno de pruebas Sandbox/Staging de BarberAgency.

## 1. Acciones Previas al Despliegue (Prechecks)

Antes de iniciar la ejecución de los scripts de migración, se llevaron a cabo de manera rigurosa las siguientes actividades de seguridad y preparación del entorno:

*   **Respaldo Completo de la Base de Datos:** Se generó un backup lógico completo de la base de datos de Sandbox con el comando `pg_dump` para asegurar el estado inicial.
*   **Prueba de Restauración:** Se restauró exitosamente el archivo de backup en un esquema temporal paralelo para verificar que el archivo no contuviese corrupción y pudiese ser utilizado como punto de restauración seguro.
*   **Auditoría de Roles Existentes:** Se validó la presencia de los roles PostgreSQL reales que interactúan con PostgREST (`anon`, `authenticated`), confirmando que corresponden al stack nativo y no requieren duplicación.
*   **Inspección de Secretos:** Se revisaron exhaustivamente los cinco archivos DDL, certificando la total ausencia de claves API expuestas, contraseñas hardcodeadas o secretos sensibles de producción.
*   **Estado de Workflows Legacy:** Se confirmó que los workflows antiguos del integrador sandbox en n8n permanecen apagados (`active: false`), garantizando que no se disparen procesos automatizados en background durante las migraciones.

---

## 2. Aplicación de Migraciones DDL y Postchecks

Las migraciones se ejecutaron de manera secuencial y aislada utilizando el motor automatizado `run_full_staging_migration_v5.js`. Todos los scripts completaron sin fallas. A continuación se presentan los detalles y postchecks de cada fase:

### Paso 1: `20260713_2026_add_plan_codes.sql`
*   **Objetivo:** Agregar códigos identificadores (`code`) a los planes existentes y realizar siembra de planes legacy de manera idempotente.
*   **Postcheck Ejecutado:**
    ```sql
    SELECT id, nombre, code, precio FROM public.planes ORDER BY id;
    ```
*   **Resultado de Verificación:**
    ```json
    [
      { "id": 1, "nombre": "Starter", "code": "starter", "precio": "0.00" },
      { "id": 2, "nombre": "Pro", "code": "pro_legacy", "precio": "99000.00" },
      { "id": 3, "nombre": "BarberAgency", "code": "barberagency_full", "precio": "50000.00" }
    ]
    ```

### Paso 2: `20260713_2027_expand_billing_core_v2.sql`
*   **Objetivo:** Crear tablas del core de facturación (`billing_customers`, `billing_checkouts`, `billing_invoices`, `payment_attempts`, `payment_transactions`, `subscriptions`, `subscription_events`) y sembrar precios de planes comerciales en pesos colombianos (COP) para el plan `BarberAgency`.
*   **Postcheck Ejecutado:**
    ```sql
    SELECT pp.id, p.nombre AS plan_name, pp.name AS tier_name, pp.amount, pp.currency, pp.active 
    FROM public.plan_prices pp
    JOIN public.planes p ON pp.plan_id = p.id
    WHERE pp.active = true;
    ```
*   **Resultado de Verificación:**
    ```json
    [
      { "id": 1, "plan_name": "BarberAgency", "tier_name": "monthly", "amount": "50000.00", "currency": "COP", "active": true },
      { "id": 2, "plan_name": "BarberAgency", "tier_name": "quarterly", "amount": "142500.00", "currency": "COP", "active": true },
      { "id": 3, "plan_name": "BarberAgency", "tier_name": "semiannual", "amount": "270000.00", "currency": "COP", "active": true },
      { "id": 4, "plan_name": "BarberAgency", "tier_name": "annual", "amount": "510000.00", "currency": "COP", "active": true }
    ]
    ```

### Paso 3: `20260713_2028_billing_roles_and_grants.sql`
*   **Objetivo:** Implementar el modelo de mínimos privilegios (Least Privilege). Revocar privilegios en cascada a `PUBLIC` y asignar accesos estrictos de solo lectura a los roles de PostgREST (`anon` y `authenticated`).
*   **Postcheck Ejecutado:**
    ```sql
    SELECT table_name, privilege_type, grantee 
    FROM information_schema.table_privileges 
    WHERE table_schema = 'public' AND table_name IN ('billing_invoices', 'plan_prices')
    ORDER BY table_name, privilege_type, grantee;
    ```
*   **Resultado de Verificación:** Los roles `anon` y `authenticated` poseen únicamente privilegios de `SELECT` sobre el catálogo financiero. Los permisos de `INSERT`, `UPDATE` y `DELETE` para estas tablas quedaron totalmente denegados para la API del frontend, garantizando aislamiento preventivo frente a inyecciones de cobros directos.

### Paso 4: `20260713_2029_billing_rpc_core.sql`
*   **Objetivo:** Compilar las funciones transaccionales de control financiero (`billing_create_checkout`, `billing_register_webhook` y `billing_process_approved_payment`).
*   **Postcheck Ejecutado:**
    ```sql
    SELECT routine_name, routine_type, security_type 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name LIKE 'billing_%';
    ```
*   **Resultado de Verificación:**
    ```json
    [
      { "routine_name": "billing_create_checkout", "routine_type": "FUNCTION", "security_type": "DEFINER" },
      { "routine_name": "billing_process_approved_payment", "routine_type": "FUNCTION", "security_type": "INVOKER" },
      { "routine_name": "billing_register_webhook", "routine_type": "FUNCTION", "security_type": "DEFINER" }
    ]
    ```
    *Nota de Seguridad:* La función `billing_create_checkout` fue configurada exitosamente como `SECURITY DEFINER` con un `search_path` fijo para posibilitar al usuario autenticado registrar checkouts en tablas protegidas por RLS sin delegarle privilegios de inserción directa.

### Paso 5: `20260713_2030_add_billing_outbox.sql`
*   **Objetivo:** Introducir la tabla `billing_outbox`, el desencadenador (trigger) de inmutabilidad para eventos en estado `processed` y las funciones utilitarias del worker de background (`billing_outbox_claim_batch`, `billing_outbox_mark_processed`, `billing_outbox_mark_failed` y `billing_outbox_release_stale_locks`).
*   **Postcheck Ejecutado:** Confirmación física del trigger de inmutabilidad `tg_billing_outbox_immutable_processed` en la tabla `billing_outbox` y de los índices optimizados para polling rápido.

---

## 3. Estado Final de Despliegue en Staging

*   **MIGRATION_FILES_VALIDATED:** YES
*   **ROLES_AND_GRANTS_VALIDATED:** YES
*   **READY_TO_APPLY_IN_STAGING:** YES
*   **READY_FOR_MERCADOPAGO_SANDBOX_EXECUTION:** YES
*   **READY_FOR_PRODUCTION:** NO (La promoción a producción está bloqueada hasta completar pruebas de Sandbox reales con Mercado Pago y su correspondiente aprobación formal).
