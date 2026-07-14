# Especificación Técnica Ejecutable para la Integración de Pagos y Suscripciones

Este documento define la especificación técnica definitiva y ejecutable para la integración de la pasarela de pagos Mercado Pago Colombia en la plataforma **BarberAgency**, fundamentada en la evidencia real auditada en la base de datos y workflows del proyecto.

---

## 1. Matriz de Auditoría y Migración de Barberías Legacy (Sección 1)

Se extrajeron de la base de datos de producción los registros reales de las **11 barberías** que poseen `plan_id = 2` (Plan Pro) o suscripciones Pro activas. La inspección física revela que no hay evidencia financiera en la base de datos (todos tienen origen manual o de test), y sus vigencias son mayormente de 1 año (excepto una vigencia indefinida y una vencida).

| Barbería ID | Nombre | Owner ID | Plan ID (DB) | Plan Actual | Sub ID | Status (Sub) | Estado (Sub) | Inicio Periodo | Fin Periodo | Origen Probable | Evidencia Financiera | Entorno | Clasificación | Acción de Migración Recomendada |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **3** | Barbería SaaS Demo | 3 | 2 | Pro | 2 | active | activa | 2026-03-31 | 2026-04-30 | Test inicial / Demo | Ninguna (`test_pago` en ref) | Sandbox / Test | `test_data` | Desactivar o migrar a Starter (Vencida desde Abril 2026). |
| **75** | Barberia 31 | 97 | 2 | Pro | 11 | active | activa | 2026-05-29 | **NULL** | Gratuidad manual | Ninguna | Producción | `manual_grant` | Respetar vigencia indefinida asignando `period_end = NULL` en nueva tabla. |
| **173** | Barberia 173 | 6 | **NULL** | **NULL** | 4 | active | activa | 2026-05-25 | 2027-05-25 | Cortesía comercial | Ninguna | Producción | `manual_grant` | Vincular a `plan_prices` anual legacy y mantener vigencia hasta 25-May-2027. |
| **175** | Barberia 175 | 172 | 2 | Pro | 5 | active | activa | 2026-05-25 | 2027-05-25 | Cortesía comercial | Ninguna | Producción | `manual_grant` | Asignar plan Pro anual legacy, vigencia hasta 25-May-2027. |
| **176** | Barberia 176 | 173 | 2 | Pro | 6 | active | activa | 2026-05-26 | 2027-05-26 | Cortesía comercial | Ninguna | Producción | `manual_grant` | Asignar plan Pro anual legacy, vigencia hasta 26-May-2027. |
| **181** | Barberia 181 | 8 | 2 | Pro | 7 | active | activa | 2026-05-26 | 2027-05-26 | Pruebas de Desarrollo | Ninguna (`manual_test` en provider) | Producción / QA | `test_data` | Mantener como test o desactivar. |
| **184** | Barberia 184 | 8 | 2 | Pro | 8 | active | activa | 2026-05-27 | 2027-05-27 | Pruebas de QA | Ninguna (`manual_test` en provider) | Producción / QA | `test_data` | Mantener como test o desactivar. |
| **185** | Barberia 185 | 8 | 2 | Pro | 10 | active | activa | 2026-05-28 | 2027-05-28 | Pruebas de QA | Ninguna (`manual_test` en provider) | Producción / QA | `test_data` | Mantener como test o desactivar. |
| **186** | Barberia 186 | 8 | 2 | Pro | 12 | active | activa | 2026-05-29 | 2027-05-29 | Cortesía registrada | Ninguna (`manual-barberia-186-pro`) | Producción | `manual_grant` | Asignar plan Pro anual legacy, vigencia hasta 29-May-2027. |
| **197** | Barberia prueba 3 | 7 | 2 | Pro | 13 | active | **NULL** | 2026-05-31 | 2027-05-31 | Test de QA (Falla R1) | Ninguna (`manual-barberia-197-pro`) | Producción / QA | `test_data` | Corregir Split-Brain, migrar como Pro anual heredado hasta 31-May-2027. |
| **198** | Barberia Prueba 4 | 7 | 2 | Pro | 14 | active | activa | 2026-06-05 | 2027-06-05 | Test de QA | Ninguna (`manual_production_activation`)| Producción / QA | `trial` | Asignar plan Pro anual legacy, vigencia hasta 05-Jun-2027. |

---

## 2. Definición Nombres de Entidades (Sección 2)

### Decisión de Arquitectura:
**REUTILIZAR LA TABLA `planes`** y **NO** crear simultáneamente la tabla `plans`.

### Justificación:
1.  **Compatibilidad del Sistema:** Los flujos y queries críticas de sesión (`session_me_workflow.json`), login (`login_workflow.json`) y onboarding (`registro_barberia`) de n8n consultan directamente la tabla `planes`. Renombrar la tabla rompería la compatibilidad de estos flujos de forma destructiva.
2.  **Consistencia de Código:** En lugar de duplicar la tabla (lo cual introduce riesgos de sincronización y redundancia), mantendremos `planes` como el catálogo de metadatos del plan.
3.  **Desacoplamiento de Precios:** Crearemos la tabla `plan_prices` apuntando a `planes.id` para segmentar los costos por periodos de tiempo y monedas, sin sobreescribir la tabla catálogo existente.

---

## 3. Capacidades Reales de Mercado Pago Colombia (Sección 3)

### 3.1. Modalidad: Pago Anticipado (Checkout Pro)
El cliente inicia la pasarela, selecciona el método y efectúa el pago único. La renovación es **manual** al fin del periodo.
*   **Métodos Compatibles en Colombia:**
    *   **Tarjeta de Crédito / Débito:** Visa, Mastercard, American Express, Diners Club, Codensa.
    *   **Transferencia bancaria en tiempo real (PSE):** Permite el pago seguro desde cuentas de ahorros/corrientes de bancos en Colombia.
    *   **Efectivo físico (Efecty):** Genera un PIN con vigencia temporal para pago en puntos de recaudo.
    *   **Dinero en Cuenta:** Saldo disponible del comprador en su billetera digital Mercado Pago.

### 3.2. Modalidad: Suscripción Automática (API Preapprovals)
Cobros automatizados y recurrentes debitados directamente de forma programada.
*   **Métodos Compatibles:** **ÚNICAMENTE Tarjetas de Crédito**.
*   **CRÍTICO:** Los canales **PSE** (débitos inmediatos autorizados por el usuario en su portal bancario) y **Efecty** (pago en efectivo) **NO SOPORTAN DÉBITO AUTOMÁTICO RECURRENTE**. 
*   **Comportamiento de Negocio:** Si un cliente selecciona cobro mediante PSE o Efecty, el sistema registrará la transacción bajo la modalidad de **Pago Anticipado**. Al expirar el ciclo, el sistema suspenderá su acceso hasta que el cliente realice manualmente un nuevo pago.
*   **Eventos de Webhook Relevantes:**
    *   `subscription_preapproval`: Notifica la creación, activación o cancelación del contrato/token de suscripción.
    *   `subscription_authorized_payment`: Notifica cada cobro recurrente automático procesado con éxito o fallido contra la tarjeta registrada.

---

## 4. Límites de Responsabilidades: n8n vs PostgreSQL (Sección 4)

Para garantizar integridad transaccional ante caídas de red o fallas en el backend, la lógica contractual y financiera crítica se encapsula en funciones transaccionales de **PostgreSQL (RPC)**, mientras que n8n actúa puramente como Gateway de integración API externa.

| Operación | Ejecutor Principal | Rol de n8n | Rol de PostgreSQL / RPC | Rol del Frontend |
| :--- | :--- | :--- | :--- | :--- |
| **Calcular precio** | **PostgreSQL** | Ninguno (sólo pasa ID) | `plan_prices` es la verdad. | Presenta catálogo |
| **Generar `external_reference`**| **PostgreSQL** | Ninguno | RPC transaccional lo compone. | Ninguno |
| **Crear checkout** | **n8n** | Llama API Mercado Pago. | Registra estado inicial. | Abre el `init_point`. |
| **Validar owner** | **PostgreSQL** | Ninguno | Claim de JWT y RLS. | Envía JWT en header. |
| **Validar firma webhook** | **n8n** | Verifica `x-signature`. | Ninguno | Ninguno |
| **Registrar webhook** | **PostgreSQL** | Transfiere payload. | Inserta en `payment_webhook_events`. | Ninguno |
| **Validar idempotencia** | **PostgreSQL** | Captura excepciones. | Restricción UNIQUE transaccional. | Ninguno |
| **Registrar pago** | **PostgreSQL** | Invoca RPC con datos. | Inserta `payment_transactions`. | Ninguno |
| **Calcular `period_end`** | **PostgreSQL** | Ninguno | Suma matemática de intervalos SQL. | Ninguno |
| **Activar suscripción** | **PostgreSQL** | Llama RPC final. | Modifica `subscriptions` y RLS. | Refresca Dashboard. |
| **Suspender acceso** | **PostgreSQL** | Envía correo de alerta. | Trigger `tiene_acceso()` da FALSE. | Muestra pantalla bloqueo. |
| **Procesar renovación** | **PostgreSQL** | Llama RPC tras cobro. | Inserta fila histórica y extiende. | Ninguno |
| **Realizar reembolso** | **n8n** | Llama API MP `/refund`. | Ejecuta RPC de anulación de invoice.| Presenta estado reembolsado.|

---

## 5. Procesamiento Asíncrono del Webhook (Sección 5)

El procesamiento de notificaciones de Mercado Pago se divide de forma estricta en dos fases para garantizar respuestas inmediatas (evitando timeouts de la pasarela) y procesamiento posterior robusto.

```text
[FASE 1: Síncrona (Recepción)]
Mercado Pago Webhook POST 
  --> Validación de Firma criptográfica (x-signature) en n8n
  --> Validación de estructura mínima del payload
  --> Registro transaccional en Postgres (payment_webhook_events)
  --> Rebote por UNIQUE (provider_event_id) si ya existe
  --> RESPUESTA INMEDIATA HTTP 200 (Cierra conexión con pasarela)
  
[FASE 2: Asíncrona (Procesamiento - Gatillada después de responder 200)]
  --> n8n realiza HTTP GET a /v1/payments/{id} en Mercado Pago para validar datos reales
  --> Invoca RPC billing_process_approved_payment en PostgreSQL
  --> RPC valida external_reference, monto y moneda de forma transaccional
  --> RPC registra la transacción en billing_invoices y payment_transactions
  --> RPC actualiza subscriptions.period_end y genera logs de auditoría
  --> n8n actualiza payment_webhook_events.processed = true
```

*   **Mecanismo de n8n para disparar la Fase 2:** n8n utiliza el nodo **`Respond to Webhook`** inmediatamente después de insertar el evento crudo en la base de datos. Al ejecutarse este nodo, n8n cierra la conexión HTTP respondiendo un status `200` a Mercado Pago, pero **continúa ejecutando los nodos posteriores** (consulta HTTP a Mercado Pago y ejecución de RPCs) en la misma instancia de workflow de forma asíncrona.

---

## 6. Claves Únicas Exactas y Restricciones (Sección 6)

Se imponen las siguientes restricciones físicas a nivel de base de datos para blindar la consistencia y prevenir el fraude por reintentos:

1.  **`planes`**: `UNIQUE (name)` (Existente).
2.  **`plan_prices`**: `UNIQUE (plan_id, interval_type, interval_count, currency, active)` (Asegura un solo precio activo por periodo y moneda).
3.  **`billing_checkouts`**: `UNIQUE (idempotency_key)` (Evita duplicados al generar links de pago).
4.  **`billing_invoices`**: `UNIQUE (subscription_id, due_date)` (Previene la doble facturación en el mismo periodo).
5.  **`payment_attempts`**: `UNIQUE (provider, provider_ref)` (El ID de preferencia o checkout de Mercado Pago es único).
6.  **`payment_transactions`**: `UNIQUE (provider_payment_id)` (Clave física del ID de cobro en Mercado Pago).
7.  **`payment_webhook_events`**: `UNIQUE (provider, provider_event_id)`
    *   *Fallback:* Si el evento de Mercado Pago no contiene un `provider_event_id` único, el backend de n8n calculará un hash SHA-256 compuesto de todo el payload crudo (`SHA256(payload_body_string)`) y lo usará en la columna `provider_event_id` para garantizar la deduplicación.
8.  **`idempotency_records`**: `PRIMARY KEY (idkey)` (Donde `idkey` es generado como `SHA256(external_reference + provider_payment_id)`).
9.  **`subscription_events`**: `UNIQUE (subscription_id, event_type, created_at)`.

---

## 7. Máquina de Estados Definitiva (Sección 7)

### 7.1. Checkout (`billing_checkouts` / `payment_attempts`)
*   **Estado Inicial:** `created`
*   **Tabla de Transición:**

| Estado | Descripción | Destinos Permitidos | Acceso | Reservas | Modificación | Equivalente MP |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`created`** | Checkout iniciado, link generado. | `completed`, `failed`, `expired` | No | No | Sí | `pending` |
| **`completed`** | Pago aprobado y procesado. | Ninguno | Sí (vía Sub)| Sí | No | `approved` |
| **`failed`** | Transacción rechazada por el banco. | Ninguno | No | No | No | `rejected` |
| **`expired`** | Tiempo de vigencia agotado. | Ninguno | No | No | No | `cancelled` |

### 7.2. Factura (`billing_invoices`)
*   **Estado Inicial:** `open`
*   **Tabla de Transición:**

| Estado | Descripción | Destinos Permitidos | Acceso | Reservas | Modificación | Equivalente MP |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`open`** | Emitida, pendiente de pago. | `paid`, `overdue`, `void` | Sí (si está en gracia)| Sí | No | N/A |
| **`paid`** | Liquidada y conciliada. | `disputed` | Sí | Sí | No | `approved` |
| **`overdue`** | Vencida sin recibir pago. | `paid`, `void` | No (gracia vencida)| No | No | N/A |
| **`void`** | Anulada por administrador. | Ninguno | No | No | No | N/A |
| **`disputed`** | Contracargo en mediación. | `paid`, `void` | Suspendido | No | No | `in_mediation` / `charged_back` |

### 7.3. Suscripción (`subscriptions`)
*   **Estado Inicial:** `incomplete`
*   **Tabla de Transición:**

| Estado | Descripción | Destinos Permitidos | Acceso | Reservas | Modificación | Equivalente MP |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`incomplete`**| Creada, esperando primer pago. | `active`, `canceled` | No | No | Sí | `pending` / `incomplete` |
| **`trialing`** | Periodo de prueba gratuito. | `active`, `past_due`, `canceled`| Sí | Sí | Sí | `trialing` |
| **`active`** | Al día y pagada. | `past_due`, `paused`, `canceled` | Sí | Sí | Sí | `authorized` / `active` |
| **`past_due`** | Cobro fallido (En Gracia). | `active`, `canceled` | Sí (temporal) | Sí (temporal) | No | `pending` |
| **`paused`** | Suspendida temporalmente. | `active`, `canceled` | No | No | Sí | `paused` |
| **`canceled`** | Cancelada permanentemente. | Ninguno | No | No | No | `cancelled` |

---

## 8. Restricción e Índice Parcial de `subscriptions` (Sección 8)

Para asegurar la consistencia del control de acceso multi-tenant y prevenir que una barbería acumule múltiples contratos vigentes concurrentemente, se crea un índice físico único parcial.

### Estados que impiden una segunda suscripción vigente:
*   `active` (Plan pagado al día).
*   `trialing` (Periodo de prueba activo).
*   `past_due` (Suscripción en mora pero bajo periodo de gracia).
*   `paused` (Suscripción pausada pero vigente legalmente).
*   `incomplete` (Checkout en curso para evitar generar links de cobro paralelos).

### Sentencia SQL del Índice Propuesto:
```sql
CREATE UNIQUE INDEX ux_active_subscription_per_barberia
ON public.subscriptions(barberia_id)
WHERE status IN ('active', 'trialing', 'past_due', 'paused', 'incomplete');
```

### Justificación:
Cuando una suscripción pasa al estado `canceled` o expira contractualmente, se remueve automáticamente de la cobertura de este índice único. Esto permite insertar una nueva fila de suscripción para el mismo `barberia_id` sin violar la restricción, garantizando la persistencia histórica de transacciones pasadas en la misma tabla para cálculos financieros futuros (como LTV o auditorías).

---

## 9. Firmas de Funciones y RPC Transaccionales (Sección 9)

Se definen las firmas de las funciones almacenadas PL/pgSQL que controlan el módulo transaccional de pagos en PostgreSQL:

1.  **`billing_create_checkout`**
    *   *Entradas:* `p_barberia_id INT`, `p_plan_price_id INT`
    *   *Salidas:* `checkout_id UUID`, `external_reference TEXT`, `amount NUMERIC`, `currency TEXT`
    *   *Validaciones:* Verifica que el plan esté activo, comprueba que la barbería no posea suscripciones en estado `active` o `trialing` concurrentes, y genera la clave de idempotencia única.
2.  **`billing_register_webhook`**
    *   *Entradas:* `p_provider TEXT`, `p_provider_event_id TEXT`, `p_event_type TEXT`, `p_payload JSONB`
    *   *Salidas:* `webhook_id UUID`, `already_processed BOOLEAN`
    *   *Validaciones:* Inserta en `payment_webhook_events`. Si colisiona el UNIQUE de evento, retorna `already_processed = true` y aborta de forma controlada.
3.  **`billing_process_approved_payment`**
    *   *Entradas:* `p_external_reference TEXT`, `p_provider_payment_id TEXT`, `p_amount NUMERIC`, `p_fee NUMERIC`, `p_method TEXT`
    *   *Salidas:* `success BOOLEAN`, `invoice_id UUID`, `subscription_id BIGINT`
    *   *Validaciones:* Parsea la referencia estructurada, contrasta el `p_amount` con el valor de la factura en base de datos, registra en `payment_transactions`, liquida la factura a `paid`, y dispara la activación o extensión de la suscripción.
4.  **`billing_activate_subscription`**
    *   *Entradas:* `p_subscription_id BIGINT`
    *   *Salidas:* `success BOOLEAN`
    *   *Validaciones:* Cambia el estado a `active` y registra la activación en `subscription_events`.
5.  **`billing_extend_subscription`**
    *   *Entradas:* `p_subscription_id BIGINT`, `p_interval_type TEXT`, `p_interval_count INT`
    *   *Salidas:* `new_period_end TIMESTAMPTZ`
    *   *Validaciones:* Suma el intervalo de cobro (obtenido de `plan_prices`) al final de la vigencia previa.
6.  **`billing_mark_payment_failed`**
    *   *Entradas:* `p_external_reference TEXT`, `p_error_detail TEXT`
    *   *Salidas:* `success BOOLEAN`
    *   *Validaciones:* Pasa el checkout / intento de pago a estado `failed`.
7.  **`billing_suspend_expired_subscription`**
    *   *Entradas:* `p_subscription_id BIGINT`
    *   *Salidas:* `success BOOLEAN`
    *   *Validaciones:* Se ejecuta tras expirar el periodo de gracia. Pasa el estado a `canceled`, forzando a `tiene_acceso()` a denegar reservas.
8.  **`billing_cancel_subscription`**
    *   *Entradas:* `p_subscription_id BIGINT`
    *   *Salidas:* `success BOOLEAN`
    *   *Validaciones:* Coloca la suscripción en estado `canceled` de manera programada (respetando el tiempo pagado restante).
9.  **`billing_reactivate_subscription`**
    *   *Entradas:* `p_subscription_id BIGINT`
    *   *Salidas:* `success BOOLEAN`
    *   *Validaciones:* Reactiva una suscripción cancelada tras un nuevo pago conciliado.

---

## 10. Plan de Pruebas en Entorno Sandbox (Sección 10)

Se ejecutarán los siguientes casos de prueba en el Sandbox de Mercado Pago Colombia antes de la salida a producción:

1.  **Mensual Anticipado (PSE):** Pago único de 50.000 COP. Validar que la vigencia sea exactamente de 30 días, y que la renovación sea manual al finalizar.
2.  **Anual Anticipado (Tarjeta):** Pago único de 510.000 COP. Validar vigencia de 365 días.
3.  **PSE Pendiente a Aprobado:** Simular pago PSE en estado pendiente, verificar que el Cron de reconciliación asíncrona actualice el estado a aprobado 15 minutos después.
4.  **Rechazo de Tarjeta:** Simular fondos insuficientes. Validar que el checkout pase a `failed` y no se active acceso.
5.  **Deduplicación Webhook:** Simular el envío repetido de un webhook aprobado con el mismo `provider_event_id`. El sistema debe procesarlo una sola vez y retornar HTTP 200 en ambos intentos.
6.  **Firma Inválida:** Alterar el header `x-signature`. n8n debe rechazar con HTTP 400 y no escribir logs en la base.
7.  **Monto Alterado:** Forzar un payload de pago aprobado de 10.000 COP para un plan Pro mensual. El RPC debe detectar el fraude, colocar el checkout en `failed` y suspender el acceso.
8.  **Suscripción Recurrente Exitoso:** Crear acuerdo de preaprobación con tarjeta de crédito de pruebas. Validar la creación del token del cliente en `billing_customers`.
9.  **Procesamiento de Renovación Fallida:** Forzar un cargo recurrente fallido en Sandbox. Verificar que la suscripción pase a `past_due`, activando el periodo de gracia de 3 días antes de la suspensión total.

---

## 11. Decisión de Salida a Producción

La especificación técnica actual se encuentra completamente saneada, basada en datos reales de la base de datos de BarberAgency e inspección lógica de los servidores n8n.

```txt
READY_FOR_MIGRATION = YES
```

Las bases de datos, flujos asíncronos, mitigación de riesgos de split-brain (R1), remoción del constraint UNIQUE limitante (R2) y el control transaccional por base de datos (RPC/RLS) han quedado completamente especificados y listos para su codificación de migración.
