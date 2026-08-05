# Reporte de Resultados: Concurrencia e Idempotencia (Sandbox)

Este documento contiene la evidencia y el análisis de las garantías de concurrencia y protección contra duplicados (idempotencia) de la base de datos de **BarberAgency** durante transacciones concurrentes en el Sandbox de Mercado Pago.

---

## 1. Idempotencia Física de Transacciones Financieras

La idempotencia financiera asegura que la confirmación duplicada de una transacción (por ejemplo, webhooks repetidos enviados por Mercado Pago debido a delays de red) no altere el estado financiero del cliente ni extienda su suscripción múltiples veces de forma ilícita.

### Evidencia del Test de Idempotencia (Caso 11):
*   **Intento 1:** Se procesa la transacción de Mercado Pago `'mp_pay_case_11'` asociada a un checkout.
    *   *Resultado:* `success = true`, `invoice_id = '292e5edd-9e5e-4622-8f8c-a65c4c8eccb9'`, `subscription_id = 17`.
*   **Intento 2:** Se simula un reintento del webhook enviando exactamente la misma referencia de pago `'mp_pay_case_11'`.
    *   *Resultado:* El RPC `/rpc/billing_process_approved_payment` intercepta el duplicado mediante la condición:
        ```sql
        IF EXISTS (SELECT 1 FROM public.payment_transactions WHERE provider_payment_id = p_provider_payment_id) THEN
          ...
          RETURN NEXT;
        END IF;
        ```
    *   *Respuesta en DB:* Retorna exactamente los mismos identificadores creados en el paso anterior (`invoice_id = '292e5edd...'`, `subscription_id = 17`) con status `success = true`.
*   **Resultado:** **PASADO (CORRECTO)**.

---

## 2. Concurrencia del Worker (Garantía de SKIP LOCKED)

Cuando hay múltiples hilos o instancias de workers reclamando tareas del outbox concurrentemente, existe el peligro de que dos workers reclamen la misma tarea y la procesen simultáneamente (enviando correos o mensajes duplicados).

### Garantía Técnica:
El RPC `billing_outbox_claim_batch` utiliza la cláusula `FOR UPDATE SKIP LOCKED` en PostgreSQL:
```sql
SELECT id FROM public.billing_outbox
WHERE status IN ('pending', 'retry_scheduled')
  AND (locked_at IS NULL OR locked_at < now() - v_stale_threshold)
ORDER BY created_at ASC
LIMIT p_batch_size
FOR UPDATE SKIP LOCKED;
```
*   **Evidencia:** Las pruebas concurrentes demuestran que las filas lockeadas por el Worker A son omitidas instantáneamente por el Worker B en su respectivo lote, garantizando el procesamiento exclusivo y serializable.
*   **Resultado:** **PASADO**.
