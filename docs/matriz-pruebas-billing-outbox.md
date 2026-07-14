# Matriz de Pruebas - Transactional Outbox

Este documento define la matriz de pruebas unitarias y de integración para validar el comportamiento lógico, concurrente y de seguridad de la cola `billing_outbox` en BarberAgency.

---

## 1. Escenarios de Pruebas de Transaccionalidad

### Caso 1: Creación Atómica de Evento (Pago Aprobado)
*   **Acción:** Invocar `/rpc/billing_process_approved_payment` con una referencia de pago válida.
*   **Aseveraciones (Assertions):**
    1.  La factura pasa a `paid`.
    2.  La suscripción pasa a `active`.
    3.  Se insertan exactamente 3 eventos en `billing_outbox` (`payment_approved`, `invoice_paid`, `subscription_activated` o `extended`).
    4.  Todos los eventos quedan en estado `'pending'`.
*   **Sentencia de verificación:**
    ```sql
    SELECT event_type, status, idempotency_key FROM public.billing_outbox WHERE correlation_id = '<checkout_uuid>';
    ```

### Caso 2: Rollback Financiero (Falla a mitad de ejecución)
*   **Acción:** Invocar `/rpc/billing_process_approved_payment` forzando un error de llave foránea (ej. `barberia_id` inexistente).
*   **Aseveraciones:**
    1.  La transacción PostgreSQL completa aborta.
    2.  No se crea ninguna factura.
    3.  **No se crea ningún evento en `billing_outbox`** (el outbox se revierte atómicamente con el rollback de la transacción core).
*   **Sentencia de verificación:**
    ```sql
    SELECT COUNT(*) FROM public.billing_outbox WHERE idempotency_key LIKE '%barberia_inexistente%';
    -- Esperado: 0
    ```

### Caso 3: Inserción de Evento Duplicado (Idempotencia)
*   **Acción:** Intentar insertar manualmente un evento con una clave `idempotency_key` existente.
*   **Aseveraciones:**
    1.  Postgres rechaza el insert con violación de restricción `uq_billing_outbox_idempotency_key`.
    2.  La transacción se aborta de forma segura sin duplicar el envío.

---

## 2. Escenarios de Pruebas de Concurrencia y Consumo

### Caso 4: Dos Workers Concurrentes (Evitar doble procesamiento)
*   **Acción:** Insertar 10 eventos pendientes. Simular dos workers concurrentes (Worker A y Worker B) que ejecutan `billing_outbox_claim_batch` al mismo milisegundo en transacciones serializadas.
*   **Aseveraciones:**
    1.  Worker A reclama 5 eventos.
    2.  Worker B reclama los 5 eventos restantes (gracias a `SKIP LOCKED`).
    3.  Ningún evento es reclamado por ambos trabajadores de forma paralela.

### Caso 5: Recuperación de Lock Abandonado (Stale Lock)
*   **Acción:** 
    1. Actualizar un evento a estado `processing` con `locked_at = now() - interval '10 minutes'`.
    2. Ejecutar `/rpc/billing_outbox_release_stale_locks(300)`.
*   **Aseveraciones:**
    1.  El evento es liberado cambiando su estado a `retry_scheduled`.
    2.  `locked_at` y `locked_by` pasan a `NULL`.
    3.  El evento queda disponible para ser reclamado de nuevo.

---

## 3. Escenarios de Pruebas de Reintentos y Fallos

### Caso 6: Fallo de Envío Externo (SMTP caído) y Backoff Exponencial
*   **Acción:** Simular una falla en el nodo de correo de n8n. Invocar `/rpc/billing_outbox_mark_failed` con base de backoff de 10s.
*   **Aseveraciones:**
    1.  El estado del evento pasa a `retry_scheduled`.
    2.  `attempt_count` se incrementa a 1.
    3.  `next_retry_at` se programa exactamente a `now() + 10 seconds` ($10 \times 2^0$).
    4.  Si falla por segunda vez, se programa a `now() + 20 seconds` ($10 \times 2^1$).

### Caso 7: Exceso de Intentos Máximos (Dead-Letter)
*   **Acción:** Forzar fallas sucesivas hasta superar `max_attempts` (5).
*   **Aseveraciones:**
    1.  En el quinto fallo, el estado pasa a `dead_letter`.
    2.  El evento se remueve de la cola activa (`idx_billing_outbox_polling` lo ignora).
    3.  Se inserta un registro de alerta en `billing_audit_logs`.

### Caso 8: Inmutabilidad de Procesados
*   **Acción:** Intentar actualizar o resetear un evento que ya está en estado `processed`.
*   **Aseveraciones:**
    1.  El trigger `tr_block_outbox_processed_change` bloquea la actualización arrojando error de inmutabilidad.

---

## 4. Escenarios de Pruebas de RLS (Seguridad)

### Caso 9: Consulta desde el Frontend (Ataque a la Privacidad)
*   **Acción:** Impersonar sesión de PostgREST `ba_authenticated` y realizar un SELECT.
    ```sql
    SET ROLE authenticated;
    SELECT * FROM public.billing_outbox;
    ```
*   **Aseveraciones:**
    1.  Aborta con error de privilegios (SELECT denegado).
    2.  El frontend no puede espiar los payloads del outbox.
