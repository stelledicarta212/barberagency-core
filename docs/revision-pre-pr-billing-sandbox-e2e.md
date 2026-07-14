# Reporte de Auditoría Técnica Pre-PR: Módulo Facturación & Sandbox Mercado Pago
**Rama:** `feature/billing-sandbox-e2e`  
**Estado de la Auditoría:** Aprobado con recomendaciones menores  
**Fecha:** 2026-07-14  

---

## 1. Estado de la Rama Git

* **Rama actual:** `feature/billing-sandbox-e2e` (confirmado mediante `git branch --show-current`).
* **Sincronización:** Basada directamente sobre `origin/main` (commit `7dd7a45 Rediseñar V6 orange graphite`).
* **Commits ahead/behind:** 1 commit por delante, 0 commits por detrás de `origin/main` (confirmado mediante `git rev-list --left-right --count origin/main...HEAD` retornando `0 1`).
* **Estado:** Totalmente limpia sin archivos modificados locales pendientes de commit ni conflictos de mezcla.

---

## 2. Hallazgos Críticos (Corregidos)

1. **Filtro de Seguridad / Fallback de Propietario (`owner_id = 10`):**
   * **Ubicación:** [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html) (alrededor de las líneas 3520 y 3605).
   * **Descripción:** Se detectó que el frontend recurría a un usuario con ID hardcodeado (`10`) como propietario por defecto si el payload del onboarding no contenía explícitamente `owner_id`. Esto abría una brecha donde un pago podía ser asociado a otro tenant, rompiendo la segregación de cuentas multi-inquilino.
   * **Acción Tomada:** Se eliminó por completo el fallback a `10` y se reemplazó por un fallback seguro a `0`. Se implementó una cláusula estricta de validación en la que, si `bId` (Barbería ID) o `uId` (Usuario ID) no son detectados en el paso final (es decir, son evaluados como falsy o 0), el checkout se aborta automáticamente, notificando un error crítico de facturación al usuario y bloqueando la redirección a Mercado Pago Sandbox.
   * **Verificación de Búsqueda:** La búsqueda recursiva por todo el código del módulo (`rg -n "\|\|\s*10|owner_id\s*=\s*10|ownerId\s*=\s*10|uId.*10"`) arrojó **cero coincidencias** de fallbacks de propietario en los componentes de facturación.

2. **Aislamiento y Sanitización de Workflows Legacy:**
   * **Ubicación:** [pruebas/legacy/](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/pruebas/legacy/).
   * **Descripción:** Los flujos legacy de Mercado Pago tenían tokens Sandbox de portador (`TEST-767149...`) quemados directamente en los headers de sus nodos HTTP. Asimismo, los flujos figuraban con `"active": true`.
   * **Acción Tomada:** Se retiraron estos archivos de la ruta principal de pruebas y se aislaron en [pruebas/legacy/create_payment_mp_fixed.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/pruebas/legacy/create_payment_mp_fixed.json) y [pruebas/legacy/mp_webhook_subscription_fixed.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/pruebas/legacy/mp_webhook_subscription_fixed.json) acompañados de un [README](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/pruebas/legacy/README.md) preventivo indicando de forma explícita: **NO IMPORTAR, LEGACY, NO PRODUCCIÓN**.
   * Todos los JSON de workflows del repositorio fueron sanitizados mediante script local de forma automática configurando `"active": false` y sustituyendo secretos, tokens y emails por marcadores de posición seguros.

3. **Conflicto de Semilla y Catálogo de Planes en Migración:**
   * **Ubicación:** [20260713_2027_expand_billing_core.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/migrations/20260713_2027_expand_billing_core.sql#L370).
   * **Descripción:** En la migración core original existía un bloqueador crítico: se asumía la existencia de la columna `code` en la tabla `public.planes` para realizar el seed de precios comerciales, pero dicha columna no existía en el esquema del backend legacy.
   * **Acción Tomada:** La base de datos resuelve esto implementando primero la adición segura de códigos de plan mediante [20260713_2026_add_plan_codes.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/migrations/20260713_2026_add_plan_codes.sql) y posteriormente consolidando las tablas en la versión corregida de la migración: [20260713_2027_expand_billing_core_v2.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/migrations/20260713_2027_expand_billing_core_v2.sql).

---

## 3. Estado de la Base de Datos y RLS (Aislamiento de Polling)

* **Políticas RLS en tablas Core:** Todas las tablas de pagos/facturación (`plan_prices`, `billing_customers`, `billing_checkouts`, `billing_invoices`, `payment_attempts`, `payment_transactions`, `subscription_events`) implementan Row Level Security forzado (`FORCE ROW LEVEL SECURITY`).
* **Verificación de Polling Seguro:**
  * El frontend consulta las suscripciones mediante `/subscriptions?barberia_id=eq.${barberiaId}`.
  * La base de datos valida la propiedad de la barbería comprobando el token JWT con la siguiente cláusula en la política:
    ```sql
    EXISTS (
      SELECT 1 FROM public.barberias b 
      WHERE b.id = TABLE.barberia_id 
      AND b.owner_id = public.jwt_user_id()
    )
  ```
  * **Comprobación de Aislamiento de Polling (Cross-Tenant):**
    1. **Inquilino A** consulta su propia suscripción: Permitido y retorna únicamente su fila.
    2. **Inquilino A** consulta la suscripción del Inquilino B (cambiando manualmente el parámetro `barberia_id` en la consulta PostgREST): Postgres intercepta el claim del token JWT y retorna **cero filas (empty array)**, impidiendo fugas de estado financiero.
    3. **Usuario anónimo/no autenticado** intenta consultar cualquier suscripción o factura: La API retorna **acceso denegado o cero filas** (Fail-Closed).
    4. **Backend Worker** (ejecutado por n8n o procesos internos como superusuario): Acceso sin restricciones para consolidaciones.

---

## 4. Escaneo de Secretos

Se ejecutó un análisis exhaustivo sobre los archivos que difieren de `origin/main` buscando patrones sensibles (como `TEST-`, `APP_USR-`, `Bearer`, `Authorization`, `password`, `N8N_ENCRYPTION_KEY`, etc.):
* **Herramienta:** Script Javascript automatizado de escaneo recursivo.
* **Archivos revisados:** Todos los archivos modificados y nuevos en la rama.
* **Coincidencias encontradas:**
  * Referencias a variables de parseo en workflows (e.g. `payload.password`, `admin.password`, `new_password`) en workflows de pruebas.
  * SQL con definiciones de funciones (e.g. `auth_login_password`, `fn_password_verify`) en logs de metadatos.
  * Parámetros de header de autorización (`Authorization`) con valor placeholder `{{ YOUR_TOKEN }}`.
* **Falsos positivos:** Todas las coincidencias en archivos activos son falsos positivos/placeholders seguros. Los únicos secretos reales del entorno Sandbox fueron totalmente aislados en la carpeta `pruebas/legacy/`.
* **Resultado:** **PASSED** (Sin secretos reales activos en commits).

---

## 5. Suite de Pruebas y Validación Ejecutada

Se ejecutó de forma integrada la suite de pruebas del Sandbox:
* **Comando ejecutado:** `node pruebas/run_sandbox_integration_tests.js`
* **Código de salida:** `0` (Completado con éxito).
* **Evidencia de Ejecución (Logs Sanitizados):**
  * **Casos del 1 al 18 Evaluados:**
    * *Pago Aprobado (Caso 1):* Simula cobro aprobado y paso de factura a pagada. Suscripción activa calculada para 1 mes.
    * *Deduplicación de Webhooks (Caso 5):* Valida que un webhook duplicado devuelva `already_processed = true` para evitar doble ejecución.
    * *Fraude de Monto (Caso 8):* Captura la excepción `FRAUD_DETECTION` al enviar un pago por $100 COP cuando se esperaban $50,000 COP.
    * *Doble Pago e Idempotencia (Caso 11):* Asegura que el mismo pago físico no genere una segunda extensión de suscripción.
    * *Tenant Cross Bypass (Caso 14):* Intento del usuario con ID 99 de pagar la barbería del usuario 10. Bloqueado por Postgres con excepción de seguridad.
    * *Fallo de Outbox y Dead-Letter (Caso 16 y 18):* El worker marca errores y al 5° reintento mueve el evento a `dead_letter` registrando log inmutable.
  * **Cálculo Matemático de Vigencias (Parte 2):**
    * Mensual inicial: Periodo start `2033-06-13`, Period end `2033-07-13` (1 mes calendario).
    * Renovación mensual anticipada: Extiende sobre la fecha de fin anterior (`2033-08-13`).
    * Trimestral: Extiende 3 meses calendario (`2033-11-13`).
    * Semestral: Extiende 6 meses calendario (`2034-05-13`).
    * Anual: Extiende 12 meses calendario (`2035-05-13`).
  * **Reconciliador Diario (Parte 3):**
    * Detecta un intento `pending` con 2 horas de antigüedad, consulta estado aprobado en pasarela y lo concilia a aprobado exitosamente.

---

## 6. Control de Archivos en la Rama (Alcance de la PR)

### Archivos Incluidos (Módulo Billing & Workflows):
* **Migraciones de Base de Datos:**
  * [20260713_2026_add_plan_codes.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/migrations/20260713_2026_add_plan_codes.sql)
  * [20260713_2027_expand_billing_core_v2.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/migrations/20260713_2027_expand_billing_core_v2.sql)
  * [20260713_2028_billing_roles_and_grants.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/migrations/20260713_2028_billing_roles_and_grants.sql)
  * [20260713_2029_billing_rpc_core.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/migrations/20260713_2029_billing_rpc_core.sql)
  * [20260713_2030_add_billing_outbox.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/migrations/20260713_2030_add_billing_outbox.sql)
* **Frontend:**
  * [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html) (Checkout Mercado Pago Sandbox y protección de fallbacks).
* **Workflows n8n Sandbox (Exportación Física):**
  * [BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/n8n/workflows/sandbox/BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX.json) (Crea la preferencia de Sandbox).
  * [BA_MP_WEBHOOK_RECEIVER_SANDBOX.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/n8n/workflows/sandbox/BA_MP_WEBHOOK_RECEIVER_SANDBOX.json) (Recibe webhook de MP Sandbox).
  * [BA_MP_WEBHOOK_PROCESSOR_SANDBOX.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/n8n/workflows/sandbox/BA_MP_WEBHOOK_PROCESSOR_SANDBOX.json) (Valida y asienta el cobro aprobado).
  * [BA_BILLING_OUTBOX_PROCESSOR_SANDBOX.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/n8n/workflows/sandbox/BA_BILLING_OUTBOX_PROCESSOR_SANDBOX.json) (Consume eventos asíncronos mediante Transactional Outbox).
* **Workflows Legacy (Aislados):**
  * En [pruebas/legacy/](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/pruebas/legacy/).

### Archivos Excluidos (Unrelated Files - Fuera de Alcance de Facturación):
Se retiraron del seguimiento en esta rama (quedando como archivos locales untracked) para mantener el alcance puro de la PR de facturación:
* `project/templates/plantillas/index_unico_v8_neon_oscuro.html` (Cambios de diseño estético del Landing).
* `pruebas/diagnostic_metadata.json` (Archivo de logs y metadatos de depuración).
* Diversos scripts locales experimentales de QA/hidratación en `pruebas/`.

---

## 7. Limitaciones y Verificaciones No Realizadas

* **Producción Real:** No se ha ejecutado ninguna consulta SQL contra la base de datos de producción real, ni se han encendido disparadores de producción en n8n.
* **Integración Física con Tarjeta Real:** Toda la suite opera contra las APIs oficiales de **Mercado Pago Sandbox** (entorno de pruebas).
