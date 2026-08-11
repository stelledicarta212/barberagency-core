# WC-012 — Evidencia del Gate Final de Seguridad y Plan de Salida (Simulación Controlada R1)

**Fecha:** 2026-08-06
**Modo:** `BARBERAGENCY_WC012_SECURITY_GATE_SIMULATION`
**Estado:** `READY_FOR_HUMAN_GATE_PRODUCTION_ROTATION`

---

## 1. Auditoría del Gate Final de Seguridad
Para cumplir con los requerimientos contractuales diferidos de seguridad, se desarrolló un simulador automatizado de rotación de credenciales [`pruebas/test_wc012_production_gate_simulator.js`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/pruebas/test_wc012_production_gate_simulator.js) ejecutado sobre el ambiente local aislado de staging:

* **Rotación de JWT Secret (`PGRST_JWT_SECRET`):**
  * Se simuló la generación e implantación de una clave nueva (`new_staging_jwt_secret_rotated_98765`) invalidando la clave vieja (`old_staging_jwt_secret_key_12345`).
  * **Comprobación de Invalidation:** Los tokens generados con la clave antigua son **RECHAZADOS** automáticamente por firma de firma no coincidente (`PASS`).
  * **Comprobación de Nueva Firma:** Los nuevos tokens son validados exitosamente por el validador (`PASS`).
* **RLS y Checkout con Nueva Sesión:**
  * Se inyectaron los claims de usuario autenticado (`user_id = 10`) mediante `request.jwt.claims` representando el comportamiento de PostgREST con la nueva clave.
  * Se ejecutó exitosamente el RPC de creación de checkout (`billing_create_checkout`) bajo RLS (`PASS`).

---

## 2. Resultados de Regresión WC-011
La suite transaccional de 18 pruebas integrales E2E (`run_sandbox_integration_tests.js`) se ejecutó exitosamente tras los cambios de WC-012:
* **TESTS_RUN:** 18
* **TESTS_PASS:** 18
* **TESTS_FAIL:** 0
* **VERDICT:** `ALL SANDBOX INTEGRATION TESTS PASSED SUCCESSFULLY`

---

## 3. Estado de Cierre de WC-012 y Plan de Despliegue en Producción
Para habilitar el entorno real de producción, el Owner de BarberAgency deberá levantar el gate humano y proceder con las siguientes tareas restringidas:

```ini
HUMAN_GATE_REQUIRED = YES
REASON = PRODUCTION_CREDENTIALS_AND_DEPLOYMENT_NOT_AUTHORIZED
```

### Plan de Despliegue y Plan de Ejecución Atómica (Gate Humano):
1. **Configurar EasyPanel Producción:** Rotar el secreto JWT y las credenciales productivas de Mercado Pago en las variables del contenedor real.
2. **Aplicar Migraciones en Producción:** Ejecutar el manifiesto de migraciones validando los checksums en la base de datos `barberagencycol`.
3. **Ejecutar Pago Real Controlado:** Realizar una transacción real de bajo valor ($1,000 COP) desde el checkout productivo para certificar la pasarela y la conciliación.
4. **Habilitar Despliegue Gradual:** Activar suscripciones y monitorear el outbox transaccional de producción.

---

## 4. Plan Atómico de Ejecución en Producción (Readiness Audit)

### 4.1 Reconciliación de Migraciones (Production Baseline vs Pending)
* **20260713_2026_add_plan_codes.sql:** `APPLIED` (Baseline de producción actual)
* **20260713_2027_expand_billing_core_v2.sql:** `APPLIED` (Baseline de producción actual)
* **20260713_2028_billing_roles_and_grants.sql:** `APPLIED` (Baseline de producción actual)
* **20260713_2029_billing_rpc_core.sql:** `APPLIED` (Baseline de producción actual)
* **20260713_2030_add_billing_outbox.sql:** `APPLIED` (Baseline de producción actual)
* **20260713_2033_add_billing_auditor_readonly.sql:** `PENDING` (Pendiente de aplicar)
* **20260713_2034_harden_billing_audit_access.sql:** `PENDING` (Pendiente de aplicar)
* **20260803_1200_wc004_license_schema.sql:** `PENDING` (Pendiente de aplicar)
* **20260803_1400_wc011_harden_payment_reconciliation.sql:** `PENDING` (Pendiente de aplicar)

### 4.2 Análisis de Seguridad de la Migración Correctiva
* **Evaluación de `20260803_1400_wc011_harden_payment_reconciliation.sql`:** 100% segura para producción. Modifica la firma y cuerpo de la función `billing_process_approved_payment` de manera atómica sin alterar datos persistidos ni el DDL de tablas principales. El uso de `ON CONFLICT (provider, provider_ref) WHERE provider_ref IS NOT NULL DO UPDATE` garantiza consistencia e idempotencia.

### 4.3 Detalles del Plan de Transición (Mínimo Tiempo de Inactividad)
* **Backup de Seguridad:** `pg_dump` completo de `barberagencycol` con verificación manual de checksum e importación en base de datos local de testeo.
* **Impacto en Sesiones:** La rotación de `PGRST_JWT_SECRET` invalidará inmediatamente todas las sesiones activas actuales. Los usuarios experimentarán un cierre de sesión forzado y deberán autenticarse nuevamente.
* **Smoke Tests:** Verificación inmediata de `/session/me` con nuevas credenciales, creación de checkout Sandbox en WooCommerce, y monitoreo del Outbox.
* **Importe Mínimo de Pago Controlado:** $1,000 COP (Valor mínimo de pasarela Mercado Pago en Colombia).
* **Rollback Actionable:** Si las pruebas de pago real controlado fallan, se revertirá el secreto JWT anterior en EasyPanel y se restaurará el dump de base de datos previo al despliegue.
* **Observabilidad:** Monitoreo activo de logs de PostgREST y tablas `public.billing_audit_logs` y `public.billing_outbox`.
* **Tiempo de Inactividad Estimado (Downtime):** ~2-5 minutos para reinicio de variables y aplicación de DDL.

---

## 5. Resolución de Bloqueadores de Pre-producción (Auditoría Final)

### 5.1 Bloqueador 1 — Aprovisionamiento de `ba_app`
* **Acción:** Creada la migración `20260803_1500_wc012_provision_ba_app.sql`.
* **Seguridad:** Aprovisiona el rol acotado `ba_app` limitando privilegios mediante `GRANT EXECUTE` en los RPCs de ingesta de pagos (`billing_register_webhook`), procesamiento transaccional (`billing_process_approved_payment`), funciones de outbox y concediendo acceso `SELECT` en las tablas requeridas por RLS. El rol no posee permisos de DDL, bypass o superusuario.
* **Prueba:** El script `test_wc012_ba_app_permissions.js` verificó exitosamente que las operaciones autorizadas se ejecutan correctamente mientras que las denegadas (insert directo, select de logs directos, DDL) son rechazadas por PostgreSQL.

### 5.2 Bloqueador 2 — Herramienta de Recuperación Post-pago Determinista
* **Acción:** Implementada la herramienta `pruebas/payment_reconciliation_recovery.js`.
* **Mecanismo:** Recupera el payload crudo del webhook previamente almacenado en la base de datos `payment_webhook_events` para un `payment_id` específico, resolviendo la discrepancia de forma atómica e idempotente sin curls manuales ni queries directas propensas a errores.
* **Prueba:** El script `test_wc012_recovery_scenarios.js` verificó que el primer run de recuperación procesa el pago de forma correcta y que el segundo run es completamente idempotente sin duplicar transacciones ni licencias.

### 5.3 Bloqueador 3 — Correspondencia de IDs de WooCommerce
* **Acción:** Se reconcilió contra WooCommerce la correspondencia canónica de IDs reales de producción:
  * **Product ID Canónico:** `4224` (Plan Suscripción Barbería)
  * **Variation ID Canónico (Mensual):** `4225` | Importe: `50,000 COP`
  * **Variation ID Canónico (Trimestral):** `4226` | Importe: `142,500 COP`
  * **Variation ID Canónico (Semestral):** `4227` | Importe: `270,000 COP`
  * **Variation ID Canónico (Anual):** `4228` | Importe: `510,000 COP`
* **Origen de IDs 1 / 1:** Identificados como IDs sintéticos internos secuenciales utilizados únicamente dentro de las tablas de plan prices de testing local de staging, no correspondiendo a los objetos reales del catálogo WooCommerce de producción.
