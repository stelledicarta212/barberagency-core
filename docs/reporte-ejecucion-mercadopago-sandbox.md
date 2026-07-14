# Reporte de Ejecución y Sincronización: Mercado Pago Sandbox

Este informe certifica la implementación, despliegue y pruebas del ciclo completo de integración de Mercado Pago Sandbox y el módulo de facturación con Transactional Outbox para **BarberAgency**.

---

## 1. Identificadores de Workflows Creados en n8n

Los flujos del sandbox se crearon con éxito en la instancia remota de n8n, permaneciendo inactivos hasta su llamada en pruebas controladas:

*   **`BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX`**
    *   *ID de Workflow:* `uKWA9IwRcUciiuQs`
    *   *Ruta Webhook:* `/webhook-test/barberagency/billing/prepaid-checkout`
*   **`BA_MP_WEBHOOK_RECEIVER_SANDBOX`**
    *   *ID de Workflow:* `UsC63EI0QzBFTvfy`
    *   *Ruta Webhook:* `/webhook-test/mp-notification`
*   **`BA_MP_WEBHOOK_PROCESSOR_SANDBOX`**
    *   *ID de Workflow:* `iUllvDVp6NYJxQ7m`
    *   *Gatillo:* Invocado asíncronamente por el Receiver (`UsC63EI0QzBFTvfy`).
*   **`BA_BILLING_OUTBOX_PROCESSOR_SANDBOX`**
    *   *ID de Workflow:* `nNKA5mbrhxvGEAtL`
    *   *Ruta Webhook:* `/webhook-test/barberagency/billing/outbox-worker`

---

## 2. Configuración y Rotación de Credenciales

*   **Rotación exitosa:** Se retiró el token expuesto en el código de los antiguos flujos JSON (`TEST-767149...`).
*   **n8n Credentials:** Se registró el token de Mercado Pago Sandbox mediante una credencial nativa del tipo `httpHeaderAuth` con el nombre `BA_MP_SANDBOX_CRED` (ID: `CGRkoVsQuGre5o37`).
*   **Separación estricta:** La credencial sandbox es independiente de la credencial de producción. Ningún token o secreto se encuentra guardado en texto plano en los nodos de n8n o archivos JSON del repositorio.

---

## 3. Resumen del Estado de la Integración

Se ejecutaron pruebas unitarias e integradas completas sobre el esquema local de Staging simulando el comportamiento exacto de los webhooks de Mercado Pago y el worker de Outbox. El resultado final del ciclo de validación es:

```txt
BACKUP_RESTORE_VERIFIED = YES
MIGRATIONS_APPLIED_IN_STAGING = YES
RLS_TESTS_PASSED = YES
OUTBOX_TESTS_PASSED = YES
REGRESSION_TESTS_PASSED = YES
READY_FOR_MERCADOPAGO_SANDBOX_EXECUTION = YES
READY_FOR_PRODUCTION = NO
```

---

## 4. Pruebas y Validación Ejecutadas

Las pruebas se dividieron en tres matrices detalladas en documentos adjuntos:

1.  **Resultados de Vigencias y Facturación:** Comprobación matemática de vigencias para suscripciones mensuales, trimestrales, semestrales y anuales, así como renovaciones anticipadas y tardías. Ver [resultados-checkout-periodos-sandbox.md](file:///root/github/barberagency-core/docs/resultados-checkout-periodos-sandbox.md).
2.  **Resultados de Webhooks y Procesamiento:** Control de idempotencia, firmas, deduplicación y logs de auditoría. Ver [resultados-webhooks-sandbox.md](file:///root/github/barberagency-core/docs/resultados-webhooks-sandbox.md).
3.  **Resultados de Concurrencia e Idempotencia:** Simulación de accesos simultáneos a las facturas y el bloqueo exclusivo mediante `SKIP LOCKED` en el Outbox. Ver [resultados-concurrencia-idempotencia-sandbox.md](file:///root/github/barberagency-core/docs/resultados-concurrencia-idempotencia-sandbox.md).
4.  **Resultados de Procesamiento de Outbox End-to-End:** Ciclo de vida completo del outbox (pending -> processing -> processed/failed/dead_letter). Ver [resultados-outbox-end-to-end-sandbox.md](file:///root/github/barberagency-core/docs/resultados-outbox-end-to-end-sandbox.md).
5.  **Registro de Incidencias de Integración:** Detalles técnicos sobre los problemas de unicidad de checkouts y resolución de permisos mitigados. Ver [incidencias-mercadopago-sandbox.md](file:///root/github/barberagency-core/docs/incidencias-mercadopago-sandbox.md).
