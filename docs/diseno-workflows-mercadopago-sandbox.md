# Diseño de Workflows para Sandbox de Mercado Pago (n8n)

Este documento detalla el diseño técnico, nodos y variables de integración para los tres workflows que implementan el entorno de pruebas (**Sandbox**) de Mercado Pago en n8n para **BarberAgency**.

---

## 1. Mapa de Integración del Sandbox en n8n

El entorno Sandbox consta de tres flujos separados y desacoplados:

```txt
[Workflow 1: BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX]
Frontend POST 
  --> n8n Webhook (/webhook-test/checkout)
  --> Postgres RPC (billing_create_checkout)
  --> MP API Checkout (Crea preferencia de Sandbox)
  --> Retorna init_point de pruebas

[Workflow 2: BA_MP_WEBHOOK_RECEIVER_SANDBOX]
Mercado Pago POST 
  --> n8n Webhook (/webhook-test/mp-notification)
  --> Postgres RPC (billing_register_webhook) -- Inserción y deduplicación
  --> RESPUESTA INMEDIATA HTTP 200
  --> Dispara asíncronamente Workflow 3

[Workflow 3: BA_MP_WEBHOOK_PROCESSOR_SANDBOX]
Receiver Trigger 
  --> MP API Fetch (/v1/payments/{id}) -- Verifica pago sandbox
  --> Postgres RPC (billing_process_approved_payment) -- Ejecución serializable
  --> Actualiza logs (processed = true)
```

---

## 2. Fichas Técnicas de Workflows Sandbox

### 2.1. `BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX`
*   **Trigger (Gatillo):** Webhook HTTP POST (`/webhook-test/barberagency/billing/prepaid-checkout`).
*   **Autenticación:** JWT `ba_session` verificado en API Gateway.
*   **Nodos y Lógica:**
    1.  **`Webhook Receiver`**: Captura los parámetros `barberia_id` y `plan_price_id` enviados por el administrador.
    2.  **`Execute RPC`**: Llama a la función almacenada `/rpc/billing_create_checkout` en Postgres.
        *   *Parámetros:* `p_barberia_id` y `p_plan_price_id`.
        *   *Salida:* `checkout_id`, `external_reference`, `amount` y `currency`.
    3.  **`MP Checkout Preference (HTTP)`**: Realiza una llamada POST a `https://api.mercadopago.com/checkout/preferences`.
        *   *Credenciales:* Carga el token de pruebas `TEST-` guardado en n8n Credentials. No se quema en JSON.
        *   *Payload:*
            ```json
            {
              "items": [
                {
                  "title": "Plan BarberAgency SaaS",
                  "quantity": 1,
                  "currency_id": "COP",
                  "unit_price": {{ $json.amount }}
                }
              ],
              "external_reference": "{{ $json.external_reference }}",
              "notification_url": "https://barberagency-n8n.gymh5g.easypanel.host/webhook-test/mp-notification",
              "back_urls": {
                "success": "https://tu-sitio-staging.com/success",
                "failure": "https://tu-sitio-staging.com/failure"
              },
              "auto_return": "approved"
            }
            ```
    4.  **`Respond to Webhook`**: Retorna el `init_point` (URL de Checkout Pro de pruebas) al frontend con status HTTP 200.

---

### 2.2. `BA_MP_WEBHOOK_RECEIVER_SANDBOX`
*   **Trigger:** Webhook HTTP POST (`/webhook-test/mp-notification`).
*   **Autenticación:** Validación del header `x-signature` usando el secreto de webhook Sandbox de Mercado Pago.
*   **Nodos y Lógica:**
    1.  **`Webhook Receiver`**: Recibe el payload de notificación enviado por Mercado Pago (incluyendo `data.id` y `type`).
    2.  **`Execute Webhook Log RPC`**: Invoca en Postgres `/rpc/billing_register_webhook` pasando los datos crudos del JSON.
        *   *Lógica:* Valida idempotencia insertando en `payment_webhook_events`. Si ocurre violación de llave única (evento ya registrado), el RPC retorna `already_processed = true`.
    3.  **`Respond to Webhook`**: Retorna HTTP 200 de inmediato a Mercado Pago cerrando la conexión.
    4.  **`Conditional Execution`**: Si `already_processed = false`, ejecuta un nodo *Trigger Workflow* para iniciar asíncronamente el procesamiento en el Workflow 3, pasando el `webhook_id` del evento registrado.

---

### 2.3. `BA_MP_WEBHOOK_PROCESSOR_SANDBOX`
*   **Trigger:** Invocado asíncronamente por el Receiver (Workflow 2).
*   **Nodos y Lógica:**
    1.  **`Fetch Webhook Payload`**: Lee el evento desde `payment_webhook_events` por ID.
    2.  **`Fetch Payment MP (HTTP)`**: Realiza una consulta GET a la API de Mercado Pago para validar la veracidad de la transacción:
        `https://api.mercadopago.com/v1/payments/{{ $json.payload.data.id }}` (Usando credenciales seguras de Sandbox en n8n).
    3.  **`IF Approved`**: Evalúa si el pago fue aprobado:
        *   **Ruta TRUE (Aprobado):** Invoca el RPC `/rpc/billing_process_approved_payment` enviando el `external_reference`, ID de pago, monto real cobrado, comisión retenida y medio de pago. El RPC se ejecuta bajo aislamiento serializable, conciliando facturas y extendiendo la suscripción.
        *   **Ruta FALSE (Rechazado/Pendiente):** Llama a `/rpc/billing_mark_payment_failed` para registrar el rechazo en `payment_attempts`.
    4.  **`Update Webhook Status`**: Actualiza la tabla `payment_webhook_events` marcando `processed = true` con su respectivo log.

---

## 3. Seguridad de Credenciales y Pruning de Datos en n8n

1.  **Rotación de Tokens TEST:** El token heredado expuesto en texto plano en los antiguos flujos `TEST-767149...` se revocará desde Mercado Pago. Se generará un nuevo token de pruebas.
2.  **Uso de n8n Credentials:** Los workflows Sandbox llamarán al manejador de credenciales nativo de n8n para inyectar los headers `Authorization`. No se exportarán ni guardarán tokens en los archivos JSON de los flujos.
3.  **Pruning (Retención de logs):** La base de datos de n8n se configurará para purgar el historial de ejecuciones de webhooks de prueba cada 7 días (`EXECUTIONS_DATA_PRUNE=true`, `EXECUTIONS_DATA_MAX_AGE=168`) para prevenir sobrecarga de disco.
