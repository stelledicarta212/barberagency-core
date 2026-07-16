# Diseño del Workflow n8n Consumidor: BA_BILLING_OUTBOX_PROCESSOR_SANDBOX

Este documento define las especificaciones del nuevo workflow de n8n diseñado para consumir, procesar y despachar los eventos de la cola de outbox de facturación en el entorno Sandbox de **BarberAgency**.

---

## 1. Ficha Técnica del Workflow

*   **Nombre del Workflow:** `BA_BILLING_OUTBOX_PROCESSOR_SANDBOX`
*   **Active Status:** `false` (Por defecto en Sandbox).
*   **Trigger (Disparador):**
    *   *Opción A:* Cron Node (Ejecución cada 1 minuto).
    *   *Opción B:* Trigger interno gatillado al finalizar la conciliación de pagos.
*   **Autenticación:** Utiliza credenciales de PostgreSQL `"Postgres account"` asociadas al superusuario `postgres`. No se exponen secretos.

---

## 2. Mapa del Flujo en n8n

```txt
Cron Trigger (1 Minuto)
  │
  ▼
PG - Claim Batch (Llama a billing_outbox_claim_batch)
  │
  ├─► [Si no hay eventos] ──► Fin
  │
  ▼
Loop Nodes (Itera por cada evento reclamado)
  │
  ├─► 1. Captura event_id, event_type, payload, correlation_id
  │
  ▼
Switch Event Type (Enruta según event_type)
  │
  ├─► 'checkout_created' ──► Generar Link de pago y Notificar por WhatsApp Mock
  ├─► 'payment_approved' ──► Enviar correo Mock de Confirmación de Pago
  ├─► 'invoice_paid'     ──► Generar PDF Factura y Enviar por Correo Mock
  ├─► 'subscription_activated' ──► Enviar Bienvenida a Plan Pro y Webhook CRM
  │
  ▼
Result Conditional (Evalúa éxito del envío externo)
  │
  ├──► Éxito (True): Llama a RPC billing_outbox_mark_processed(event_id)
  │
  └──► Fallo (False): Llama a RPC billing_outbox_mark_failed(event_id, error, msg, 10)
```

---

## 3. Especificación de los Nodos del Worker

### 1. `PG - Claim Batch` (PostgreSQL Node)
*   **Operación:** `executeQuery`
*   **Query SQL:**
    ```sql
    SELECT * FROM public.billing_outbox_claim_batch(
      'n8n-sandbox-worker-' || substring(gen_random_uuid()::text, 1, 6),
      10, -- Lote de 10 eventos por ciclo
      300 -- Timeout de 5 minutos (300s) para locks colgados
    );
    ```

### 2. `Switch Event Type` (Switch Node)
Enruta el flujo según la propiedad `{{ $json.event_type }}`:
*   **Caso `checkout_created`:** Despacha un WhatsApp ficticio al cliente con la URL del `init_point` Sandbox.
*   **Caso `payment_approved` / `invoice_paid`:** Llama al nodo de email ficticio (SMTP Mock) enviando el comprobante de pago.
*   **Caso `subscription_activated` / `subscription_extended`:** Gatilla el webhook de onboarding del panel para actualizar la interfaz del usuario.

### 3. `SMTP / HTTP Mock Client`
Nodo de integración externa (Mailgun / WhatsApp API / SMTP).
*   *Configuración de Robustez:*
    *   **Timeout:** Fijo en `10s` para evitar colgar al worker.
    *   **Retry on Fail:** Desactivado en el nodo de n8n, ya que la lógica de reintento está delegada directamente a la base de datos a través de `billing_outbox_mark_failed` con backoff exponencial.

### 4. `PG - Mark Processed` (PostgreSQL Node)
*   **Query SQL:**
    ```sql
    SELECT public.billing_outbox_mark_processed('{{ $json.outbox_id }}');
    ```

### 5. `PG - Mark Failed` (PostgreSQL Node - Ejecutado en rama de Catch Error)
*   **Query SQL:**
    ```sql
    SELECT public.billing_outbox_mark_failed(
      '{{ $json.outbox_id }}',
      '{{ $json.error.code || "SMTP_ERROR" }}',
      '{{ $json.error.message || "Falla en conexión con servidor de correo." }}',
      10 -- Base de 10 segundos para el cálculo del backoff
    );
    ```

---

## 4. Workflow de Mantenimiento: `BA_BILLING_OUTBOX_MAINTENANCE`

Para liberar bloqueos y mantener el performance de la cola, se diseña un workflow auxiliar inactivo de mantenimiento:
*   **Trigger:** Cron Node (Cada 5 minutos).
*   **Nodo 1 (PG):** Libera locks colgados que hayan superado el timeout:
    ```sql
    SELECT public.billing_outbox_release_stale_locks(300);
    ```
*   **Nodo 2 (PG):** Purgado automático de eventos procesados viejos (retención de 90 días):
    ```sql
    DELETE FROM public.billing_outbox 
    WHERE status = 'processed' AND processed_at <= now() - interval '90 days';
    ```
