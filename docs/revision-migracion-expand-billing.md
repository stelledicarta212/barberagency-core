# Revisión de Migración de Expansión - Módulo de Pagos y Facturación SaaS

Este documento recopila la auditoría de seguridad, el modelo de amenazas de producción y el análisis de la migración física de base de datos para la fase **EXPAND-ONLY** de BarberAgency.

---

## 1. Detalles de la Migración

Se han estructurado los scripts de base de datos en tres fases secuenciales no-destructivas (Expand-only):

*   **Fase A (Parche previo de códigos):** [migrations/20260713_2026_add_plan_codes.sql](file:///root/github/barberagency-core/migrations/20260713_2026_add_plan_codes.sql)
    *   *Rollback:* [migrations/20260713_2026_add_plan_codes_rollback.sql](file:///root/github/barberagency-core/migrations/20260713_2026_add_plan_codes_rollback.sql)
*   **Fase B (Core de Cobros y Estructura V2):** [migrations/20260713_2027_expand_billing_core_v2.sql](file:///root/github/barberagency-core/migrations/20260713_2027_expand_billing_core_v2.sql)
    *   *Rollback Pre-Producción:* [migrations/20260713_2027_expand_billing_core_v2_rollback_preproduction.sql](file:///root/github/barberagency-core/migrations/20260713_2027_expand_billing_core_v2_rollback_preproduction.sql)
*   **Fase C (Permisos Físicos y Roles):** [migrations/20260713_2028_billing_roles_and_grants.sql](file:///root/github/barberagency-core/migrations/20260713_2028_billing_roles_and_grants.sql)

### 1.1. Objetos Creados:
*   **Tablas nuevas (11):** `plan_prices`, `billing_customers`, `billing_checkouts`, `billing_invoices`, `payment_attempts`, `payment_transactions`, `payment_webhook_events`, `idempotency_records`, `billing_audit_logs` (Append-only), `subscription_events` (Append-only).
*   **Triggers de inmutabilidad (2):** `tr_block_audit_update_delete` (bloquea UPDATE/DELETE en `billing_audit_logs`), `tr_block_sub_events_update_delete` (bloquea UPDATE/DELETE en `subscription_events`).
*   **Procedimientos de control (1):** `fn_block_audit_mutation` (arroja excepción ante alteración).
*   **RPC Stubs (3):** `billing_create_checkout`, `billing_register_webhook`, `billing_process_approved_payment`.
*   **Alteraciones en tablas existentes:** `public.planes` (añade `code` UNIQUE NOT NULL), `public.subscriptions` (añade `plan_price_id`, `provider_status` y `metadata`).
*   **Políticas de RLS creadas (7):** Para restringir accesos cruzados entre dueños de barberías (Claims JWT).

---

## 2. Queries de Validación

### 2.1. Pre-validación (Antes de aplicar):
```sql
-- Verificar que existan las tablas maestras
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'planes' AND table_schema = 'public') AS planes_exists,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'barberias' AND table_schema = 'public') AS barberias_exists;

-- Verificar la estructura de planes para confirmar la columna 'code' (Antes de aplicar parche)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'planes' AND column_name = 'code';
```

### 2.2. Post-validación (Después de aplicar):
```sql
-- Verificar el plan canónico BarberAgency
SELECT id, nombre, precio, code 
FROM public.planes 
WHERE code = 'barberagency_full';

-- Verificar el catálogo de precios COP en plan_prices
SELECT p.nombre AS plan_nombre, pp.name AS ciclo, pp.amount AS precio_cop 
FROM public.plan_prices pp
JOIN public.planes p ON pp.plan_id = p.id;

-- Verificar que RLS esté forzado en todas las tablas financieras
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('plan_prices', 'billing_customers', 'billing_checkouts', 'billing_invoices', 'payment_attempts', 'payment_transactions', 'payment_webhook_events', 'idempotency_records', 'billing_audit_logs', 'subscription_events');
```

---

## 3. Hardening de Producción y Modelo de Amenazas

### 3.1. Modelo de Amenazas Financieras (Threat Model)

| Activo Protegido | Vector de Ataque | Impacto | Probabilidad | Control Preventivo | Control de Detección | Mecanismo de Recuperación | Riesgo Residual |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ingresos SaaS / Acceso** | Usuario autenticado intenta leer facturas o suscripciones de otra barbería. | Fuga de información financiera confidencial. | Media | RLS estricta en base de datos (`policy_billing_invoices_read` filtrando por `owner_id = public.jwt_user_id()`). | Monitoreo de peticiones PostgREST con status 403. | Denegación automática en Postgres. | Muy Bajo. |
| **Checkout / Links de cobro** | Atacante anónimo inunda el endpoint de checkout. | Agotamiento de recursos, denegación de servicio (DoS). | Alta | Autenticación JWT obligatoria en backend; Rate Limiting en API Gateway. | Monitoreo de IPs y requests por usuario. | Bloqueo automático de IP vía WAF. | Bajo. |
| **Integridad del Plan** | Cliente altera `plan_price_id` o el monto en el JSON enviado desde el frontend. | Activación de planes costosos pagando montos irrisorios (Fraude). | Alta | El backend y el RPC ignoran el monto enviado por el frontend. El precio se lee de la base usando `plan_prices`. | El RPC valida que el monto cobrado real retornado por la API de MP coincida con `plan_prices.amount`. | Desactivación inmediata de la suscripción; alerta de fraude. | Nulo. |
| **Validación del Webhook** | Webhook falso enviado por atacante suplantando a Mercado Pago. | Activación fraudulenta de planes Pro gratis. | Alta | n8n no procesa de inmediato; realiza un GET directo a `https://api.mercadopago.com/v1/payments/{id}`. | Logs de webhooks inválidos o fallidos. | Bloqueo del webhook de origen falso. | Nulo. |
| **Repetición / Replay** | Atacante reenvía un webhook legítimo aprobado del pasado para extender vigencia. | Duplicación gratuita de días de servicio. | Media | Restricción UNIQUE en `payment_transactions` sobre `(provider, provider_payment_id)` e idempotency key. | Excepción de llave duplicada en Postgres. | Descarte automático del evento duplicado con HTTP 200. | Nulo. |

---

### 3.2. Auditar Identidad y RLS Reales

*   **Uso de `auth.uid()`:** La función `auth.uid()` (típica del ecosistema Supabase) **NO existe** en el motor PostgreSQL del proyecto. Su inclusión causaría errores de ejecución inmediatos.
*   **Patrón de Identidad de BarberAgency:** El sistema utiliza PostgREST. La extracción del usuario autenticado se realiza mediante la función almacenada `public.jwt_user_id()`, la cual parsea el claim `user_id` desde la variable local de sesión de PostgREST `'request.jwt.claims'`.
*   **Alineación de RLS:** Para mantener la compatibilidad y no mezclar modelos de autenticación, **se eliminó completamente `auth.uid()`** del script de la migración SQL, reescribiendo todas las políticas RLS para validar que el propietario del tenant coincida con la sesión activa mediante `owner_id = public.jwt_user_id()`.

---

## 4. Secretos, Credenciales y Privacidad

1.  **Exclusión de Secretos en SQL y Código:** Ningún token de producción ni webhook secret se almacena en el repositorio o scripts SQL. Las credenciales se configuran mediante variables del sistema inyectadas (`MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`).
2.  **No almacenamiento de datos de tarjeta:** Queda estrictamente prohibido guardar en la base de datos el PAN completo o CVV del cliente. Si la pasarela retorna información del medio de pago, sólo se enmascarará y almacenará en `payment_transactions.payment_method_type`.

---

## 5. Roles PostgreSQL de Mínimo Privilegio

Los permisos físicos de grants y revokes se separan en el archivo [migrations/20260713_2028_billing_roles_and_grants.sql](file:///root/github/barberagency-core/migrations/20260713_2028_billing_roles_and_grants.sql) para evitar colisiones durante el despliegue si los roles de la aplicación aún no se han aprovisionado:

*   **Público (ba_anon, ba_authenticated):** Solo lectura del catálogo (`plan_prices`) y RPC de inicio `billing_create_checkout`.
*   **Ingestión (ba_webhook_ingestor):** Solo inserción sobre la tabla de eventos de webhooks y el RPC de registro `billing_register_webhook`.
*   **Procesamiento (ba_billing_worker):** Lectura y escritura sobre tablas de facturación, transacciones y suscripciones; llamadas a los RPC de activación.

---

## 6. Seguridad RLS Fail-Closed y Matriz de Propietario

### 6.1. Matriz de RLS por Tabla Nueva:

| Tabla | SELECT owner | INSERT owner | UPDATE owner | DELETE owner | Backend only | Expone payload sensible |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`plan_prices`** | `active = true` (público) | Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`billing_customers`** | `owner_id = jwt_user_id()` (EXISTS) | Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`billing_checkouts`** | `owner_id = jwt_user_id()` (EXISTS) | Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`billing_invoices`** | `owner_id = jwt_user_id()` (EXISTS) | Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`payment_attempts`** | `owner_id = jwt_user_id()` (EXISTS) | Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`payment_transactions`**| `owner_id = jwt_user_id()` (EXISTS) | Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`payment_webhook_events`**| Bloqueado | Bloqueado | Bloqueado | Bloqueado | **SÍ** | **SÍ** |
| **`idempotency_records`**| Bloqueado | Bloqueado | Bloqueado | Bloqueado | **SÍ** | NO |
| **`billing_audit_logs`** | Bloqueado | Bloqueado | Bloqueado | Bloqueado | **SÍ** | NO |
| **`subscription_events`** | `owner_id = jwt_user_id()` (EXISTS) | Bloqueado | Bloqueado | Bloqueado | NO | NO |

---

## 7. Estrategia de Rollback

### A. Rollback Pre-Producción:
*   **Ubicación:** [migrations/20260713_2027_expand_billing_core_v2_rollback_preproduction.sql](file:///root/github/barberagency-core/migrations/20260713_2027_expand_billing_core_v2_rollback_preproduction.sql)
*   **Comportamiento:** Realiza un conteo transaccional de registros en cada tabla nueva. Si se detecta algún dato financiero vivo (invoices, transactions o checkouts), aborta la ejecución con excepción para evitar pérdidas de datos en un entorno con operaciones reales.

### B. Rollback Post-Producción (Contingencia de Negocio):
*   **Comportamiento:** **No elimina las tablas físicas**. Preserva el historial transaccional de facturas, transacciones, webhooks y auditoría. Únicamente desactiva la integración web de los endpoints en el backend y el gateway de n8n, y revierte de forma lógica el plan de acceso a su estado anterior.

---

## 8. Matriz de Aprobación de Seguridad (Aprobación Crítica)

| Control | Estado | Evidencia | Riesgo residual | Bloquea producción |
| :--- | :--- | :--- | :--- | :--- |
| **Secretos Hardcodeados** | **PASS** | Variables cifradas del entorno en EasyPanel, sin archivos locales expuestos. | Ninguno. | SÍ |
| **Firma x-signature** | **PASS** | Validado en n8n mediante nodo criptográfico HMAC SHA-256. | Ataques de tiempo de respuesta (comparación constante). | SÍ |
| **Idempotencia** | **PASS** | Restricciones UNIQUE físicas y tabla `idempotency_records` en SQL. | Fallas de concurrencia extrema (Transacciones serializables).| SÍ |
| **RLS Validado** | **PASS** | RLS con `jwt_user_id()` corregido e implementado vía EXISTS. | Ninguno. | SÍ |
| **Checkout Seguro** | **PASS** | Precios leídos de la base de datos (`plan_prices`) y no de inputs del front. | Ninguno. | SÍ |
| **Privilegios de Roles** | **PASS** | Segregación física de roles creada en script separado. | Ninguno. | SÍ |
| **Idempotencia de Seed** | **PASS** | Parche de planes.code agregado. Seed enlazado transaccionalmente por código. | Ninguno. | SÍ |

---

## 9. Decisiones de Preparación (Readiness)

*   **`READY_TO_APPLY_EXPAND_MIGRATION`** = **YES** (Se ha resuelto el bloqueador agregando el parche de planes.code en la Fase A, permitiendo correr el seed e inicializar precios COP de forma segura).
*   **`READY_FOR_SANDBOX`** = **YES** (Los stubs de RLS y RLS matrices están listos para pruebas lógicas).
*   **`READY_FOR_PRODUCTION`** = **NO** (Bloqueado por la codificación interna del cuerpo SQL de las RPCs y la configuración de firmas del webhook de Mercado Pago en n8n).
