# WC-012 final local validation evidence

Fecha: 2026-08-10
Modo: local, sintetico, sin produccion, sin Sandbox, sin JWT rotation.

## Baseline

```text
BRANCH = fix/pos-charge-only-after-service
HEAD = 9dd5b9df8dcff465ed7b8954e2c3d7c3a36af210
WORKTREE = DIRTY_PREEXISTING
```

## Iteraciones del loop

```text
ITERATION_1
failing_check = preflight_without_1600 aborted harness
root_cause = el harness trataba el fail-safe esperado como fallo fatal
files_changed = pruebas/wc012_final_local_validation.js
change_summary = registrar fail-safe sin 1600 como PASS del preflight
targeted_result = PASS en ejecucion posterior

ITERATION_2
failing_check = orden de migraciones del harness
root_cause = 2034 se aplicaba antes de 1600 en la ruta principal del harness
files_changed = pruebas/wc012_final_local_validation.js
change_summary = aplicar 1600 antes de 2033/2034 y nuevamente despues de 1500
targeted_result = PASS en ejecucion posterior

ITERATION_3
failing_check = cross-tenant aceptaba eventos/pagos sin binding de webhook
root_cause = billing_process_approved_payment no exigia webhook registrado ni data.id coincidente; register_webhook aceptaba eventos no soportados
files_changed = migrations/20260810_1600_wc012_payment_security_remediation.sql, pruebas/wc012_final_local_validation.js, pruebas/wc012_runtime_validation.js
change_summary = validar provider/event_type/data.id, exigir webhook registrado, rechazar event/payment mismatch, congelar owner_user_id del checkout
targeted_result = CROSS_TENANT_CASES_EXECUTED 16/16 PASS

ITERATION_4
failing_check = could not determine data type of parameter $3
root_cause = helper de webhook sintetico sin cast explicito
files_changed = pruebas/wc012_final_local_validation.js, pruebas/wc012_runtime_validation.js
change_summary = agregar casts $1::text, $2::text, $3::text
targeted_result = PASS

ITERATION_5
failing_check = mark_processed duplicado y finalizacion outbox sin propiedad efectiva
root_cause = la RPC de finalizacion no exigia locked_by del worker que reclama el evento
files_changed = migrations/20260810_1600_wc012_payment_security_remediation.sql, pruebas/wc012_final_local_validation.js, pruebas/wc012_runtime_validation.js, infra/wc011-staging/migrations/manifest.json
change_summary = agregar RPCs worker-aware para mark_processed/mark_failed, revocar firmas antiguas al worker y validar que worker A no pueda finalizar claim de worker B
targeted_result = OUTBOX PASS
```

## Comandos y resultados

```text
node --check app/backend/wc012_payment_remediation_contract.js = PASS EXIT_CODE=0
node --check pruebas/test_wc012_payment_remediation_contract.js = PASS EXIT_CODE=0
node --check pruebas/test_wc012_payment_remediation_static.js = PASS EXIT_CODE=0
node --check pruebas/wc012_runtime_validation.js = PASS EXIT_CODE=0
node --check pruebas/wc012_final_local_validation.js = PASS EXIT_CODE=0

node pruebas/test_wc012_payment_remediation_contract.js = PASS EXIT_CODE=0
node pruebas/test_wc012_payment_remediation_static.js = PASS EXIT_CODE=0
node pruebas/test_wc012_production_gate_simulator.js = PASS EXIT_CODE=0
node pruebas/test_wc005_paid_order_bridge.js = PASS EXIT_CODE=0
node pruebas/test_wc006_license_transition_contract.js = PASS EXIT_CODE=0
node pruebas/test_wc007_license_assignment_contract.js = PASS EXIT_CODE=0
node pruebas/test_wc008_session_access_contract.js = PASS EXIT_CODE=0
node pruebas/test_wc009_entitlement_publication_contract.js = PASS EXIT_CODE=0
node pruebas/test_wc010_legacy_backfill_simulator.js = PASS EXIT_CODE=0
node pruebas/wc012_runtime_validation.js = PASS EXIT_CODE=0
node pruebas/wc012_final_local_validation.js = PASS EXIT_CODE=0
workflow/manifest JSON parse = PASS EXIT_CODE=0 DURATION_MS=57
manifest hash validation = PASS
git diff --check scoped = PASS
secret scan scoped = PASS_NO_MATCHES
bash infra/wc011-staging/guards/test-startup-guard.sh = NOT_RUN E_ACCESSDENIED
```

## Firma y replay

```text
manifest = id:123456789;request-id:req-final-001;ts:1700000000;
valid_signature = PASS
missing_secret = PASS WEBHOOK_SECRET_NOT_CONFIGURED
invalid_signature = PASS WEBHOOK_SIGNATURE_MISMATCH
expired_timestamp = PASS WEBHOOK_SIGNATURE_TIMESTAMP_OUT_OF_TOLERANCE
duplicate_component = PASS WEBHOOK_SIGNATURE_MALFORMED
validation_before_first_side_effect = PASS
```

El replay de firma se valida criptograficamente como firma valida; la autoridad de persistencia queda en `billing_register_webhook` y `billing_process_approved_payment`, que ahora deduplican/rechazan `provider_event_id` reutilizado con otro pago.

## Cross-tenant

```text
CROSS_TENANT_CASES_EXECUTED = 16/16
CROSS_TENANT_TESTS = PASS
CROSS_TENANT_ZERO_SIDE_EFFECTS = PASS
```

Los 16 casos registran `webhook/payment/invoice/subscription/license/entitlement/outbox before/after`, `transaction_rolled_back`, `side_effects` y `result`. Todos los casos terminaron en PASS con cero efectos netos por rollback transaccional.

## Outbox

```text
worker_a_claimed = 3
worker_b_claimed = 3
intersection = []
mark_processed = true
mark_processed_duplicate = accepted true, value false
mark_failed = true
worker_a_finish_worker_b_claim = false
worker_a_finalize_worker_b_claim = DENIED
retry_claimed_failed_event = true
processed_event_not_reclaimed = true
OUTBOX_CONCURRENCY_TEST = PASS
OUTBOX_RETRY_TESTS = PASS
OUTBOX_OWNERSHIP_TEST = PASS
OUTBOX_DUPLICATE_EFFECTS = ZERO_FOR_DOMAIN_EFFECT_TABLES
```

No se declara DLQ/dead_letter como aprobado porque no fue forzado hasta max_attempts en esta validacion.

## Roles

```text
ba_checkout_app = direct connection PASS; create_checkout ALLOW; webhook/payment/outbox DENY
ba_webhook_worker = direct connection PASS; register_webhook/process_payment ALLOW; checkout/outbox DENY
ba_outbox_worker = direct connection PASS; claim/mark_processed(worker-aware)/mark_failed(worker-aware) ALLOW; checkout/webhook/payment DENY
PUBLIC_EXECUTE = false para RPCs billing mutantes
RLS_FORCE = true en tablas financieras revisadas
memberships = []
synthetic_passwords_cleared = true
ba_app_process_new = false
```

Nota: `ba_app_connect = true` por herencia de CONNECT via PUBLIC en la base local. No se revoco CONNECT global de PUBLIC para evitar una ampliacion operativa fuera del alcance. La neutralizacion validada es ausencia de EXECUTE sobre la RPC final y reemplazo por roles separados.

## Migraciones

```text
preflight_without_1600 = PASS FAIL_SAFE_BEFORE_1600
fresh_install = PASS
upgrade_1500_to_1600 = PASS
reapply = PASS
rollback = PASS
reapply_after_rollback = PASS
data_preservation_counts_after_rollback_reapply = PASS
manifest_order_1500_1600 = PASS
manifest_hash_1600 = 64C3074DF311E6EF81EB26C1C06A2ADD25573DDE9902DE23B727E5A48AC86FD3
```

## Estado final

```text
INDEPENDENT_REVIEW = PASS
CROSS_TENANT_CASES_EXECUTED = 16/16
SANDBOX_PAYMENT_PERFORMED = NO
JWT_ROTATION = DEFERRED
COMMIT_CREATED = NO
PUSH_PERFORMED = NO
DEPLOY_PERFORMED = NO
SANDBOX_PAYMENT_AUTHORIZED = NO
PRODUCTION_DEPLOYMENT_AUTHORIZED = NO
RESULT = READY_FOR_SANDBOX_OWNER_DECISION
```
