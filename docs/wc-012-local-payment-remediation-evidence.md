# WC-012 — Remediación local de seguridad y consistencia Mercado Pago

Estado: `LOCAL_REMEDIATION_CANDIDATE`

Esta evidencia documenta únicamente cambios locales. No autoriza producción, pagos, cambios remotos, rotación JWT ni configuración de credenciales.

## Matriz de diseño

| Defecto | Archivo actual | Corrección propuesta | Prueba requerida | Riesgo |
|---|---|---|---|---|
| Monto solo rechazaba importes menores | `migrations/20260803_1400_wc011_harden_payment_reconciliation.sql` | Nueva firma de `billing_process_approved_payment` con igualdad exacta `p_amount = expected_amount` y escala `NUMERIC(12,2)` | Positivo exacto; menor; mayor; centavos; null; inválido; negativo | Requiere adaptar workflow processor |
| Moneda no comparada | mismo | Recibir `currency_id` server-side de Mercado Pago y comparar contra catálogo persistido | COP/COP; USD/COP; null; vacío; minúsculas; código inválido | Datos históricos previos sin columna nueva |
| Binding incompleto | SQL + workflow processor | Exigir `payment_id`, `event_id`, `preference_id`, `external_reference`, checkout, plan, término, tenant y owner desde servidor | Cross-tenant y reutilización de IDs | Requiere que el workflow guarde preference antes del pago |
| PUBLIC EXECUTE y rol compartido | `20260803_1500_wc012_provision_ba_app.sql` | Superseder con `ba_checkout_app`, `ba_webhook_worker`, `ba_outbox_worker` y grants por firma exacta | Tests de matriz de roles y diff SQL | Debe revisarse contra firmas reales antes de producción |
| Observabilidad incompleta | evidencia WC-012 previa | `pruebas/wc012_observability_queries.sql` parametrizado | Revisión SQL estática; ejecución futura autorizada | No ejecutado contra producción |
| Rollback inseguro a postgres | evidencia WC-012 previa | rollback por apagado, revocación y preservación; sin credencial postgres operativa | Revisión estática | Requiere coordinación manual en n8n |

## Archivos locales de remediación

- `migrations/20260810_1600_wc012_payment_security_remediation.sql`
- `migrations/20260810_1600_wc012_payment_security_remediation_rollback.sql`
- `app/backend/wc012_payment_remediation_contract.js`
- `pruebas/test_wc012_payment_remediation_contract.js`
- `pruebas/wc012_observability_queries.sql`
- exports locales n8n sanitizados en `pruebas/*_workflow_downloaded.json`

## Estado técnico

```text
WC_012_STATUS = IN_PROGRESS
LOCAL_REMEDIATION_IMPLEMENTED = YES
PRODUCTION_MIGRATIONS_APPLIED = NO
REMOTE_N8N_CHANGED = NO
SANDBOX_PAYMENT_PERFORMED = NO
REAL_PAYMENT = NO
JWT_SECRET_CHANGED = NO
JWT_ROTATION = DEFERRED
SANDBOX_TEST_AUTHORIZED = NO
PRODUCTION_DEPLOYMENT_AUTHORIZED = NO
REFUND_STATUS = NOT_IMPLEMENTED
CHARGEBACK_STATUS = NOT_IMPLEMENTED
```

## Webhook signature

La validación criptográfica de `x-signature` queda `NOT_IMPLEMENTED` en esta remediación local porque el repositorio no contiene una definición contractual verificable del algoritmo exacto de Mercado Pago aplicable a estos exports. El diseño debe fallar cerrado si en producción se declara `WEBHOOK_SIGNATURE_REQUIRED = YES`.

```text
WEBHOOK_SIGNATURE_VALIDATION = NOT_IMPLEMENTED
WEBHOOK_SIGNATURE_BLOCKS_SANDBOX_PAYMENT = REVIEW_REQUIRED
```

## Rollback operativo

El rollback futuro debe:

1. detener primero la entrada de eventos;
2. desactivar receiver, processor y outbox Sandbox;
3. preservar pagos, webhooks, invoices, subscriptions, licencias y outbox;
4. revocar grants por firma exacta;
5. deshabilitar credenciales nuevas fuera de Git;
6. no volver a `postgres` como credencial operativa;
7. no usar `DROP OWNED` ni `REASSIGN OWNED` sin inventario previo.

## Criterio de continuidad

Antes de cualquier aplicación productiva se requiere revisión independiente de:

- SQL y firmas exactas;
- compatibilidad con esquema real;
- grants efectivos;
- exports locales;
- ejecución local Docker/staging;
- ausencia de secretos;
- decisión humana para siguiente gate.

## Pruebas locales ejecutadas

```text
LOCAL_TESTS_STATUS = PARTIAL
node --check app/backend/wc012_payment_remediation_contract.js = PASS
node --check pruebas/test_wc012_payment_remediation_contract.js = PASS
node --check pruebas/test_wc012_payment_remediation_static.js = PASS
node pruebas/test_wc012_payment_remediation_contract.js = PASS
node pruebas/test_wc012_payment_remediation_static.js = PASS
node pruebas/test_wc005_paid_order_bridge.js = PASS
node pruebas/test_wc006_license_transition_contract.js = PASS
node pruebas/test_wc007_license_assignment_contract.js = PASS
node pruebas/test_wc008_session_access_contract.js = PASS
node pruebas/test_wc009_entitlement_publication_contract.js = PASS
node pruebas/test_wc010_legacy_backfill_simulator.js = PASS
workflow JSON parse = PASS
git diff --check scoped files = PASS
secret scan scoped files = PASS
```

## Pruebas no ejecutadas o no completadas

```text
node pruebas/test_wc012_production_gate_simulator.js = NOT_RUN_LOCAL_DB_UNAVAILABLE
ERROR = connect ECONNREFUSED 127.0.0.1:55432
Docker/staging integration tests = NOT_RUN
Production SQL validation = NOT_RUN
Remote n8n validation = NOT_RUN
Sandbox payment = NOT_RUN
```

---

## Actualización runtime local — 2026-08-10

La validación runtime local se ejecutó contra el stack Docker WC-011 local y una base PostgreSQL desechable creada por el harness. No se aplicó SQL en producción, no se modificaron workflows remotos, no se ejecutaron pagos Sandbox/reales y no se rotó JWT.

### Causa de `ECONNREFUSED`

`127.0.0.1:55432` rechazaba conexión porque Docker Desktop / daemon local no estaba disponible y los contenedores WC-011 estaban detenidos. Tras levantar el stack local con `infra/wc011-staging/docker-compose.yml`, `barberagency-wc011-postgres` quedó publicado en `127.0.0.1:55432`.

### Correcciones adicionales realizadas durante runtime

- `pruebas/wc012_runtime_validation.js`: fixtures deterministas ajustados para reutilizar `plan_prices` existentes y `plan_id` real; prueba de privilegios `PUBLIC` reemplazada por inspección de `aclexplode`; concurrencia de outbox validada sobre el mismo `outbox_id`.
- `migrations/20260810_1600_wc012_payment_security_remediation.sql`: rechazo explícito de `provider_payment_id` reutilizado con checkout/preference/evento distinto; eliminación del overload histórico `billing_process_approved_payment(TEXT,TEXT,NUMERIC,NUMERIC,TEXT)`.

### Resultado runtime PostgreSQL WC-012

```text
node pruebas/wc012_runtime_validation.js = PASS
MIGRATION_CLEAN_APPLY = PASS
WC012_REAPPLY = PASS
ROLLBACK_LOCAL_TEST = PASS
AMOUNT_VERIFICATION = PASS
CURRENCY_VERIFICATION = PASS
EXTERNAL_REFERENCE_BINDING = PASS
PREFERENCE_BINDING = PASS
TENANT_BINDING = PASS
PAYMENT_ID_UNIQUENESS = PASS
DUPLICATE_EVENT_IDEMPOTENCY = PASS
CROSS_TENANT_TESTS = PASS
PUBLIC_EXECUTE_HARDENED = YES
SEPARATED_ROLES_IMPLEMENTED = YES
OUTBOX_CONCURRENCY_TEST = PASS
```

Nota: el harness re-aplicó WC-012 y su rollback/reapply sobre la base desechable. El conjunto histórico completo contiene migraciones previas no diseñadas como idempotentes globales; no se reclasifican como PASS fuera del alcance WC-012.

### Suite local complementaria

```text
node --check app/backend/wc012_payment_remediation_contract.js = PASS
node --check pruebas/test_wc012_payment_remediation_contract.js = PASS
node --check pruebas/test_wc012_payment_remediation_static.js = PASS
node --check pruebas/wc012_runtime_validation.js = PASS
node pruebas/test_wc012_payment_remediation_contract.js = PASS
node pruebas/test_wc012_payment_remediation_static.js = PASS
node pruebas/test_wc012_production_gate_simulator.js = PASS
node pruebas/test_wc005_paid_order_bridge.js = PASS
node pruebas/test_wc006_license_transition_contract.js = PASS
node pruebas/test_wc007_license_assignment_contract.js = PASS
node pruebas/test_wc008_session_access_contract.js = PASS
node pruebas/test_wc009_entitlement_publication_contract.js = PASS
node pruebas/test_wc010_legacy_backfill_simulator.js = PASS
node pruebas/test_wc004_license_schema_static.js = PASS
workflow JSON parse = PASS
git diff --check scoped files = PASS
secret scan scoped files = PASS_FALSE_POSITIVE_VARIABLE_NAME_ONLY
```

### Pruebas no ejecutadas / parciales

```text
startup-guard.sh = NOT_RUN_WSL_ACCESS_DENIED
test-startup-guard.sh = NOT_RUN_WSL_ACCESS_DENIED
master-preflight.sh = NOT_RUN_WSL_ACCESS_DENIED
verify-connectivity.sh = NOT_RUN_WSL_ACCESS_DENIED
node pruebas/test_wc004_license_schema_runtime.js = NOT_RUN_REQUIRES_DESTRUCTIVE_DB_BOOTSTRAP_OR_EXPLICIT_WC004_ENV
Production SQL validation = NOT_RUN
Remote n8n validation = NOT_RUN
Sandbox payment = NOT_RUN
```

### Estado posterior

```text
WC_012_STATUS = IN_PROGRESS
LOCAL_REMEDIATION_IMPLEMENTED = YES
LOCAL_TESTS_STATUS = PARTIAL
POSTGRESQL_STAGING = AVAILABLE
WEBHOOK_SIGNATURE_VALIDATION = NOT_IMPLEMENTED
WEBHOOK_SIGNATURE_BLOCKS_SANDBOX_PAYMENT = REVIEW_REQUIRED
REMEDIATION_REVIEW_REQUIRED = YES
REMEDIATION_AUTHORIZED = NO
SANDBOX_TEST_AUTHORIZED = NO
PRODUCTION_DEPLOYMENT_AUTHORIZED = NO
```

---

## Validación final local de seguridad previa a Sandbox — 2026-08-10

Esta sección documenta la validación local final ejecutada antes de solicitar autorización humana para el primer pago Sandbox. No constituye autorización de pago, producción, despliegue, modificación remota ni rotación JWT.

### Fuentes oficiales Mercado Pago consultadas

- Mercado Pago Developers — Checkout Pro optional notifications: `https://www.mercadopago.com.co/developers/en/docs/checkout-pro/additional-settings/optional-notifications`
- Mercado Pago Developers — Checkout API payments webhooks: `https://www.mercadopago.com.co/developers/es/docs/checkout-api-payments/additional-content/your-integrations/notifications/webhooks`

### Firma webhook implementada localmente

Contrato implementado en `app/backend/wc012_payment_remediation_contract.js`:

- Header requerido: `x-signature`.
- Header requerido: `x-request-id`.
- Componentes extraídos de `x-signature`: `ts` y `v1`.
- Identificador requerido: `data.id`.
- Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`.
- Algoritmo: HMAC-SHA256 con salida hexadecimal.
- Comparación: `crypto.timingSafeEqual`.
- Comportamiento: fail-closed si falta secreto, firma, request id, data id, formato válido o tolerancia temporal local.
- Replay: control local por timestamp y por idempotencia persistente de `provider_event_id`.

### Pruebas de firma

```text
Firma válida = ACCEPT
Firma inválida = REJECT
Secreto incorrecto = REJECT
ts vencido = REJECT
ts futuro fuera de tolerancia = REJECT
v1 manipulado = REJECT
data.id manipulado = REJECT
x-request-id manipulado = REJECT
x-signature ausente = REJECT
x-signature malformado = REJECT
x-request-id ausente = REJECT
data.id ausente = REJECT
secreto no configurado = FAIL_CLOSED
```

### Conexiones directas por rol

`pruebas/wc012_runtime_validation.js` genera passwords sintéticos temporales no impresos, conecta directamente como cada rol y elimina esas passwords al finalizar.

```text
ba_checkout_app current_user/session_user = PASS
ba_webhook_worker current_user/session_user = PASS
ba_outbox_worker current_user/session_user = PASS
SUPERUSER = false
BYPASSRLS = false
CREATEDB = false
CREATEROLE = false
REPLICATION = false
ba_checkout_app create checkout RPC = PASS
ba_webhook_worker register webhook RPC = PASS
ba_webhook_worker process approved payment RPC = PASS
ba_outbox_worker claim batch RPC = PASS
ba_outbox_worker mark processed RPC = PASS
cross-role RPC denial = PASS
direct sensitive table access denial = PASS
DDL/ALTER ROLE/DISABLE RLS denial = PASS
anon/authenticated worker RPC denial = PASS
```

### Guardias WC-011

```text
startup-guard.sh = NOT_RUN_WSL_ACCESS_DENIED
test-startup-guard.sh = NOT_RUN_WSL_ACCESS_DENIED
master-preflight.sh = NOT_RUN_WSL_ACCESS_DENIED
verify-connectivity.sh = NOT_RUN_WSL_ACCESS_DENIED
docker compose ps = PASS
PostgreSQL local port 127.0.0.1:55432 = PASS
postgres pg_isready inside container = PASS
environment_identity = staging/wc011 PASS
```

### Orden canónico de migraciones

Se corrigió `infra/wc011-staging/migrations/manifest.json` para incluir `20260810_1600_wc012_payment_security_remediation.sql` con `order = 6`, inmediatamente después de `20260803_1500_wc012_provision_ba_app.sql`.

```text
CANONICAL_MIGRATION_ORDER = PASS
FRESH_INSTALL_FINAL_STATE = PASS
UPGRADE_FINAL_STATE = PASS
SUPERSEDED_1500_NEUTRALIZED = YES
INSECURE_OPERATIONAL_WINDOW = YES_REDUCED_BY_MANIFEST_ORDER
```

La ventana insegura existe conceptualmente si `1500` se aplica y `1600` no se aplica. El manifiesto local ahora reduce el riesgo al ordenar ambas migraciones en la misma cadena determinista, pero producción sigue requiriendo revisión y autorización.

### Pruebas runtime finales

```text
node pruebas/wc012_runtime_validation.js = PASS
MIGRATION_CLEAN_APPLY = PASS
WC012_REAPPLY = PASS
ROLLBACK_LOCAL_TEST = PASS
AMOUNT_VERIFICATION = PASS
CURRENCY_VERIFICATION = PASS
EXTERNAL_REFERENCE_BINDING = PASS
PREFERENCE_BINDING = PASS
TENANT_BINDING = PASS
PAYMENT_ID_UNIQUENESS = PASS
DUPLICATE_EVENT_IDEMPOTENCY = PASS
CROSS_TENANT_TESTS = PASS
CROSS_TENANT_ZERO_SIDE_EFFECTS = PASS
OUTBOX_CONCURRENCY_TEST = PASS
OUTBOX_RETRY_TESTS = PASS
SECURITY_DEFINER_SAFETY = PASS
PUBLIC_EXECUTE_HARDENED = YES
SEPARATED_ROLES_IMPLEMENTED = YES
LEAST_PRIVILEGE_TESTS = PASS
```

### Suite final ejecutada

```text
node --check app/backend/wc012_payment_remediation_contract.js = PASS
node --check pruebas/test_wc012_payment_remediation_contract.js = PASS
node --check pruebas/test_wc012_payment_remediation_static.js = PASS
node --check pruebas/wc012_runtime_validation.js = PASS
node pruebas/test_wc012_payment_remediation_contract.js = PASS
node pruebas/test_wc012_payment_remediation_static.js = PASS
node pruebas/test_wc012_production_gate_simulator.js = PASS
node pruebas/test_wc005_paid_order_bridge.js = PASS
node pruebas/test_wc006_license_transition_contract.js = PASS
node pruebas/test_wc007_license_assignment_contract.js = PASS
node pruebas/test_wc008_session_access_contract.js = PASS
node pruebas/test_wc009_entitlement_publication_contract.js = PASS
node pruebas/test_wc010_legacy_backfill_simulator.js = PASS
workflow/manifest JSON parse = PASS
git diff --check scoped = PASS
secret scan scoped = PASS_NO_MATCHES
```

### Estado final local

```text
WC_012_STATUS = IN_PROGRESS
FINAL_LOCAL_SECURITY_VALIDATION = PASS
LOCAL_REMEDIATION_IMPLEMENTED = YES
REMEDIATION_REVIEW_REQUIRED = YES
REMEDIATION_AUTHORIZED = NO
SANDBOX_TEST_AUTHORIZED = NO
PRODUCTION_DEPLOYMENT_AUTHORIZED = NO
PRODUCTION_TOUCHED = NO
REMOTE_CONFIGURATION_CHANGED = NO
SANDBOX_PAYMENT_PERFORMED = NO
REAL_PAYMENT = NO
JWT_ROTATION = DEFERRED
```

## Loop autonomo local de revision, correccion y validacion - 2026-08-10

### Correcciones locales aplicadas

```text
WEBHOOK_SIGNATURE_COMPONENT = PASS
WEBHOOK_SIGNATURE_WORKFLOW_INTEGRATION = PASS
VALIDATION_BEFORE_FIRST_SIDE_EFFECT = PASS
WEBHOOK_SIGNATURE_FAIL_CLOSED = PASS
WEBHOOK_REPLAY_PROTECTION = PASS
DIRECT_ROLE_CONNECTION_TESTS = PASS
LEAST_PRIVILEGE_TESTS = PASS
CANONICAL_MIGRATION_ORDER = PASS
SUPERSEDED_1500_NEUTRALIZED = YES
INSECURE_OPERATIONAL_WINDOW = NO_FOR_CANONICAL_LOCAL_RUNNER
```

Se agrego validacion HMAC-SHA256 fail-closed de webhooks Mercado Pago antes del primer efecto persistente del receiver local exportado. La validacion usa `x-signature`, `x-request-id`, `data.id`, tolerancia temporal y comparacion timing-safe. El nodo `Validate MP Signature` queda antes de `PG - Register Webhook`.

La migracion `20260810_1600_wc012_payment_security_remediation.sql` queda idempotente aun cuando la migracion historica `20260803_1500_wc012_provision_ba_app.sql` haya sido aplicada. El rol historico `ba_app` se conserva para auditoria, pero queda sin permisos operativos en la cadena canonica local. El manifest local registra `20260810_1600_wc012_payment_security_remediation.sql` como paso canonico posterior a `1500`.

### Validacion final ejecutada

```text
node --check app/backend/wc012_payment_remediation_contract.js = PASS
node --check pruebas/test_wc012_payment_remediation_contract.js = PASS
node --check pruebas/test_wc012_payment_remediation_static.js = PASS
node --check pruebas/wc012_runtime_validation.js = PASS
workflow/manifest JSON parse = PASS
node pruebas/test_wc012_payment_remediation_contract.js = PASS
node pruebas/test_wc012_payment_remediation_static.js = PASS
node pruebas/test_wc012_production_gate_simulator.js = PASS
node pruebas/test_wc005_paid_order_bridge.js = PASS
node pruebas/test_wc006_license_transition_contract.js = PASS
node pruebas/test_wc007_license_assignment_contract.js = PASS
node pruebas/test_wc008_session_access_contract.js = PASS
node pruebas/test_wc009_entitlement_publication_contract.js = PASS
node pruebas/test_wc010_legacy_backfill_simulator.js = PASS
node pruebas/wc012_runtime_validation.js = PASS
git diff --check scoped = PASS
secret scan scoped = PASS_NO_MATCHES
```

### Estado de cierre local

```text
FINAL_LOCAL_SECURITY_VALIDATION = PASS
LOCAL_REMEDIATION_IMPLEMENTED = YES
LOCAL_RUNTIME_VALIDATION_EXECUTED = YES
FRESH_INSTALL_FINAL_STATE = PASS
UPGRADE_FINAL_STATE = PASS
ROLLBACK_LOCAL_TEST = PASS
AMOUNT_VERIFICATION = PASS
CURRENCY_VERIFICATION = PASS
EXTERNAL_REFERENCE_BINDING = PASS
PREFERENCE_BINDING = PASS
PAYMENT_ID_UNIQUENESS = PASS
DUPLICATE_EVENT_IDEMPOTENCY = PASS
CROSS_TENANT_TESTS = PASS
CROSS_TENANT_ZERO_SIDE_EFFECTS = PASS
OUTBOX_CONCURRENCY_TEST = PASS
OUTBOX_RETRY_TESTS = PASS
SECURITY_DEFINER_SAFETY = PASS
PUBLIC_EXECUTE_HARDENED = YES
SEPARATED_ROLES_IMPLEMENTED = YES
WC_011_SHELL_GUARDS = PARTIAL_WSL_E_ACCESSDENIED
WC_011_EQUIVALENT_GUARDS = PASS
PRODUCTION_TOUCHED = NO
REMOTE_CONFIGURATION_CHANGED = NO
SANDBOX_PAYMENT_PERFORMED = NO
REAL_PAYMENT = NO
JWT_ROTATION = DEFERRED
REMEDIATION_REVIEW_REQUIRED = YES
REMEDIATION_AUTHORIZED = NO
SANDBOX_TEST_AUTHORIZED = NO
PRODUCTION_DEPLOYMENT_AUTHORIZED = NO
```
