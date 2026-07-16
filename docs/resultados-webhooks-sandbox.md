# Reporte de Resultados: Recepción y Procesamiento de Webhooks (Sandbox)

Este reporte recopila la evidencia de las pruebas sobre la ingesta, validación de autenticidad, deduplicación e idempotencia de las notificaciones de Mercado Pago en **BarberAgency**.

---

## 1. Deduplicación y Evitación de Replay
El primer nivel de defensa contra el reintento de webhooks es la deduplicación física por `provider` y `provider_event_id` en la tabla `payment_webhook_events`.

### Evidencia del Test de Deduplicación (Caso 5):
*   **Intento 1:** Se registra el webhook `'mp_event_case_05'` con un payload simulado.
    *   *Resultado:* `already_processed = false`, `webhook_id = '0681c3ba-483f-427f-a091-9d76faa17b27'`.
*   **Intento 2:** Se intenta re-registrar el mismo webhook `'mp_event_case_05'` con idéntico payload.
    *   *Resultado:* El RPC `/rpc/billing_register_webhook` detecta la existencia previa del evento. Retorna el mismo `webhook_id = '0681c3ba-483f-427f-a091-9d76faa17b27'` e indica `already_processed = true`.
*   **Resultado:** **PASADO (DEDUPLICADO)**.

---

## 2. Ingesta de Estados de Pago no Aprobados

El receptor de webhooks debe persistir todos los eventos crudos sin importar el estado final de la transacción (`approved`, `pending`, `rejected`), garantizando un log histórico fiable.

### A. Caso 2: Pago Pendiente
*   **Acción:** Se recibe una notificación con status `pending`.
*   **Evidencia:** El webhook se registra en `payment_webhook_events` con `processed = false`. El procesador asíncrono no llama a la extensión de suscripción ya que la condición `status == 'approved'` no se cumple.
*   **Resultado:** **PASADO**.

### B. Caso 3: Pago Rechazado
*   **Acción:** Se recibe notificación con status `rejected`.
*   **Evidencia:** El webhook se registra en `payment_webhook_events` y se descarta su procesamiento financiero (evitando otorgar acceso).
*   **Resultado:** **PASADO**.

---

## 3. Validación de Autenticidad (`x-signature` y `timestamp`)
*   **Seguridad en Gateway (n8n):** El webhook receiver en n8n (`BA_MP_WEBHOOK_RECEIVER_SANDBOX`) implementa validación de la firma en la cabecera `x-signature`.
*   **Algoritmo:** HMAC-SHA256 utilizando el token secreto configurado.
*   **Control de Ventana de Tiempo (Timestamp):** El receiver extrae el timestamp del header y descarta notificaciones con más de 5 minutos de antigüedad, impidiendo ataques de replay.
*   **Mitigación de Inyección:** El payload se valida y sanitiza limitando su tamaño a 1MB antes de invocar la escritura en PostgreSQL.
