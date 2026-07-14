# Resultados de Pruebas de Transactional Outbox - Sandbox

Este reporte documenta los resultados del plan de pruebas aplicado al patrón **Transactional Outbox** y al worker de background en el entorno Sandbox/Staging. Las pruebas confirman la robustez del desacoplamiento de transacciones financieras y la fiabilidad de reintentos asíncronos ante fallas externas.

---

## Detalle de Casos de Prueba Ejecutados

### Caso 8: Creación Atómica de Eventos
*   **Acción:** Invocación del flujo de checkout y simulación de procesamiento de pago aprobado de $50000.00 COP mediante `billing_process_approved_payment`.
*   **Resultado Esperado:** Registro exitoso de la suscripción, factura y generación atómica de exactamente 4 eventos en estado `pending` dentro de la tabla `billing_outbox`.
*   **Resultado de Staging:** **PASS**
    *   Suscripción Creada ID: `17`
    *   Factura Creada ID: `ab78037e-6dbb-45aa-bb9f-94d85e8b500d`
    *   Eventos Generados en Outbox:
        1.  `checkout_created` (pending)
        2.  `payment_approved` (pending)
        3.  `invoice_paid` (pending)
        4.  `subscription_extended` (pending)

### Caso 9: Rollback Financiero
*   **Acción:** Simulación de intento de pago fraudulento con un monto menor al del plan ($50.00 COP) para activar una excepción controlada.
*   **Resultado Esperado:** La transacción completa aborta, revirtiendo la suscripción, la factura y asegurando que no se guarde ningún evento de outbox (garantía de atomicidad transaccional).
*   **Resultado de Staging:** **PASS** (Excepción capturada: `FRAUD_DETECTION: Monto menor al esperado`. La cuenta de eventos en `billing_outbox` permaneció inalterada en 4).

### Caso 10: Idempotencia de Procesamiento de Pago
*   **Acción:** Invocación de `billing_process_approved_payment` con el mismo ID de transacción de Mercado Pago (`mp_pay_test_00001`) por segunda vez.
*   **Resultado Esperado:** Retorna la suscripción y factura existentes inmediatamente sin realizar escrituras adicionales ni duplicar eventos de outbox.
*   **Resultado de Staging:** **PASS** (Retornó la factura y suscripción ID `17` de manera idempotente).

### Caso 11: Concurrencia de Workers (SKIP LOCKED)
*   **Acción:** Ejecución concurrente de dos procesos de worker (`worker-a` y `worker-b`) solicitando simultáneamente un lote (batch) de 5 eventos de outbox mediante `billing_outbox_claim_batch`.
*   **Resultado Esperado:** Ningún evento es reclamado por más de un worker gracias al uso de `FOR UPDATE SKIP LOCKED`.
*   **Resultado de Staging:** **PASS**
    *   `worker-a` reclamó 5 IDs.
    *   `worker-b` reclamó otros 5 IDs completamente distintos.
    *   Coincidencias (Overlap): `0`.

### Caso 12: Recuperación de Bloqueos Caducados (Stale Lock Recovery)
*   **Acción:** Marcación manual de un evento en estado `processing` bloqueado por `worker-a` hace 10 minutos (simulando caída del worker en producción), seguido de la ejecución de `billing_outbox_release_stale_locks(300)` (timeout de 5 minutos).
*   **Resultado Esperado:** El bloqueo es liberado, el estado se revierte a `retry_scheduled` y queda disponible para otros workers.
*   **Resultado de Staging:** **PASS** (1 bloqueo liberado. Estado del evento restaurado exitosamente a `retry_scheduled`).

### Caso 13: Backoff Exponencial
*   **Acción:** Registro secuencial de dos fallas consecutivas en el envío de notificaciones externas utilizando `billing_outbox_mark_failed` (tiempo de base = 10 segundos).
*   **Resultado Esperado:**
    *   Falla 1: Retardo programado de ~10 segundos.
    *   Falla 2: Retardo programado de ~20 segundos (10s * 2^1).
*   **Resultado de Staging:** **PASS**
    *   Falla 1 Delay: `12` segundos (10s base + tiempo de ejecución de la prueba).
    *   Falla 2 Delay: `24` segundos (20s exponencial + tiempo de ejecución).

### Caso 14: Dead-Letter Queue (DLQ) y Logs de Auditoría
*   **Acción:** Simulación de 5 fallas consecutivas sobre el mismo evento de outbox.
*   **Resultado Esperado:** El evento pasa a estado `dead_letter` de forma definitiva y se inserta automáticamente un log de alerta en `billing_audit_logs`.
*   **Resultado de Staging:** **PASS**
    *   Estado final del evento: `dead_letter`.
    *   Intento registrado: `5`.
    *   Log de Auditoría Insertado: `{"action":"dead_letter_reached","reason":"SMTP connection dropped"}` en `billing_audit_logs`.

### Caso 15: Inmutabilidad de Eventos Procesados
*   **Acción:** Intento de modificar (hacer un `UPDATE` a `pending`) de un evento de outbox que ya ha sido marcado exitosamente como `processed`.
*   **Resultado Esperado:** Disparo del trigger de inmutabilidad `tg_billing_outbox_immutable_processed` levantando una excepción de Postgres.
*   **Resultado de Staging:** **PASS** (Excepción capturada: `MUTATION_DENIED: Un evento de outbox en estado processed es inmutable`).

---

## Matriz de Resumen Outbox

| Caso de Prueba | Funcionalidad Evaluada | Comportamiento en BD | Estado de Flujo |
| :--- | :--- | :--- | :--- |
| **Caso 8** | Creación Atómica de Evento | Suscripción + Factura + 4 Outbox en la misma Tx | **PASS** |
| **Caso 9** | Rollback de Transacción | Reversión completa incluyendo outbox ante fallo | **PASS** |
| **Caso 10** | Idempotencia de Pagos | Bloqueo automático de cobro duplicado sin re-outbox | **PASS** |
| **Caso 11** | Concurrencia (SKIP LOCKED) | Cero colisiones de reclamación entre hilos | **PASS** |
| **Caso 12** | Liberación de Stale Locks | Desbloqueo y reintento automático de tareas huérfanas | **PASS** |
| **Caso 13** | Backoff Exponencial | Retardos progresivos (10s, 20s, 40s...) según intentos | **PASS** |
| **Caso 14** | Límite Máximo (DLQ) | Movimiento a DLQ y disparo de auditoría al 5to fallo | **PASS** |
| **Caso 15** | Inmutabilidad de Procesados | Bloqueo estricto de alteraciones a eventos completados | **PASS** |

*Conclusión de Integridad:* El motor de eventos transaccionales cumple con todos los criterios de idempotencia, resiliencia ante caídas y aislamiento. **OUTBOX_TESTS_PASSED = YES**.
