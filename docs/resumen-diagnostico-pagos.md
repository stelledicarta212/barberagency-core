# Resumen de Diagnóstico de Base de Datos y Auditoría de Mercado Pago

Este documento recopila la estructura canónica, riesgos críticos, brechas de datos y la auditoría de los flujos de Mercado Pago existentes en los servidores de n8n para el proyecto **BarberAgency**.

---

## 1. Riesgos Críticos Encontrados en la Base de Datos

### R1: Inconsistencia y Split-Brain de estado (`status` vs `estado`) en `subscriptions`
*   **Evidencia exacta:** La tabla `subscriptions` define la columna `status` con default `'active'` y tipo `text`. También posee la columna `estado` (nula, sin restricciones). El registro de la barbería ID 197 posee `status = 'active'` pero `estado = NULL` en la base de datos real.
*   **Tablas o campos afectados:** Tabla `subscriptions` (columnas `status` y `estado`), función `tiene_acceso()`.
*   **Impacto:** Dado que la función almacenada `tiene_acceso()` valida `estado = 'activa'`, barberías con suscripciones técnicamente válidas según `status = 'active'` son rechazadas por el trigger `trigger_validar_acceso_citas`, arrojando el error `Necesitas un plan activo para usar las reservas` a sus clientes y bloqueando su operación.
*   **Solución recomendada:** Eliminar la columna `estado` y migrar la lógica de la función `tiene_acceso()` para que lea directamente la columna estandarizada `status` con el valor `'active'`.

### R2: Restricción UNIQUE en `subscriptions(barberia_id)`
*   **Evidencia exacta:** Restricción de base de datos `unique_barberia_subscription` -> `UNIQUE (barberia_id)` en la tabla `subscriptions`.
*   **Tablas o campos afectados:** Tabla `subscriptions` (columna `barberia_id`), constraint `unique_barberia_subscription`.
*   **Impacto:** Esta restricción impide que una barbería tenga más de una fila en la tabla de suscripciones. Si un cliente cancela, renueva, o se le genera un nuevo intento de facturación, se debe sobreescribir la fila existente. Esto rompe la trazabilidad financiera histórica, impide calcular métricas clave (ej. LTV) e imposibilita auditar transacciones pasadas.
*   **Solución recomendada:** Eliminar la restricción UNIQUE física. Para validar que solo exista una suscripción activa/pendiente concurrentemente por barbería, se debe crear un índice parcial único (`UNIQUE INDEX ... WHERE status IN ('active', 'trialing', 'past_due')`).

---

## 2. Tablas Reutilizables

### 2.1. Tabla `planes`
*   **Qué se puede reutilizar:** Estructura como catálogo jerárquico de planes de la plataforma SaaS (Starter, Pro, etc.).
*   **Qué cambios necesitaría:** Remover la columna `precio` y heredar la relación de costos a una nueva tabla de precios versionados.

### 2.2. Tabla `subscriptions`
*   **Qué se puede reutilizar:** Registro del estado contractual del SaaS por tenant (barberia_id, plan_id, period_start, period_end, provider, provider_ref).
*   **Qué cambios necesitaría:** 
    1. Eliminar la columna `estado`.
    2. Remover la restricción UNIQUE física `unique_barberia_subscription` en `barberia_id`.
    3. Crear el índice único parcial para asegurar una sola suscripción activa/pendiente simultánea por barbería.

---

## 3. Tablas Nuevas Sugeridas

1.  **`plan_prices` (Catálogo de Precios Versionados)**
    *   **Objetivo:** Almacenar los precios de los planes segmentados por periodo de cobro (mensual, trimestral, semestral, anual) y monedas.
    *   **Relaciones principales:** Relación de muchos a uno con `planes` (`plan_id`).
    *   **Prioridad de implementación:** Alta.
2.  **`billing_customers` (Clientes de Facturación)**
    *   **Objetivo:** Mapear la barbería con su identificador único de cliente en la pasarela de pagos (Mercado Pago Customer ID).
    *   **Relaciones principales:** Relación uno a uno con `barberias` (`barberia_id`).
    *   **Prioridad de implementación:** Media.
3.  **`billing_invoices` (Facturas del SaaS)**
    *   **Objetivo:** Historial de cobros emitidos a la barbería por el uso de la plataforma.
    *   **Relaciones principales:** Relación muchos a uno con `barberias` (`barberia_id`) y `subscriptions` (`subscription_id`).
    *   **Prioridad de implementación:** Alta.
4.  **`payment_attempts` (Intentos de Pago)**
    *   **Objetivo:** Registrar cada solicitud de cobro enviada a la pasarela (checkout, PSE, link).
    *   **Relaciones principales:** Relación muchos a uno con `barberias` (`barberia_id`) y `billing_invoices` (`invoice_id`).
    *   **Prioridad de implementación:** Alta.
5.  **`payment_webhook_events` (Historial de Webhooks)**
    *   **Objetivo:** Guardar los payloads crudos recibidos desde Mercado Pago para auditoría e investigación.
    *   **Relaciones principales:** Ninguna (tabla de log global).
    *   **Prioridad de implementación:** Alta.
6.  **`idempotency_records` (Control de Idempotencia)**
    *   **Objetivo:** Prevenir que reintentos de red del webhook procesen dos veces la misma transacción.
    *   **Relaciones principales:** Ninguna (registro de tokens único).
    *   **Prioridad de implementación:** Alta.

---

## 4. Campos Posiblemente Obsoletos

1.  **`usuarios.plan_id`**
    *   **Tabla:** `usuarios`
    *   **Uso actual:** Indica si el usuario puede crear barberías durante el onboarding/login.
    *   **Por qué podría deprecarse:** En un modelo multi-tenant las suscripciones se aplican al tenant (barbería) y no al usuario.
    *   **Acción:** Deprecar temporalmente y eliminar tras actualizar los workflows de inicio de sesión (`session_me`, `login`).
2.  **`subscriptions.estado`**
    *   **Tabla:** `subscriptions`
    *   **Uso actual:** Utilizado por la función `tiene_acceso()` para validar el paso de citas.
    *   **Por qué podría deprecarse:** Redundancia con `status` y origen de inconsistencia split-brain.
    *   **Acción:** Eliminar inmediatamente tras actualizar la función `tiene_acceso()`.
3.  **`barberias.plan_id`**
    *   **Tabla:** `barberias`
    *   **Uso actual:** Asociación del plan para caché visual y configuración de widgets.
    *   **Por qué podría deprecarse:** No refleja el estado de pago, vigencia o suspensión contractual real.
    *   **Acción:** Conservar temporalmente como caché de solo lectura; remover en fases futuras.

---

## 5. Fuente Única de Verdad Actual

*   **Plan:** Fragmentado de manera inconsistente entre `barberias.plan_id` y `subscriptions.plan_id`.
*   **Precio:** Estático en la tabla `planes.precio` (no soporta cambios históricos ni periodos).
*   **Suscripción:** Tabla `subscriptions` (afectada por la restricción UNIQUE que impide historial).
*   **Pago:** Tabla `pagos` (que es **exclusiva** de citas/POS físicos, no hay registro de pagos de suscripción SaaS).
*   **Acceso:** La función `tiene_acceso()` que valida que exista un registro con `estado = 'activa'` en la tabla `subscriptions`.
*   **Vencimiento:** El campo `subscriptions.period_end`.

---

## 6. Orden Recomendado de Implementación

1.  **Bloque A: Corrección de Consistencias en Base de Datos (Mitigación R1 y R2)**
    *   Regularizar datos de `subscriptions.estado` a `'activa'`.
    *   Modificar la función `tiene_acceso()` para leer `status = 'active'`.
    *   Eliminar la columna `estado`.
    *   Remover la restricción UNIQUE `unique_barberia_subscription` y crear el índice parcial único.
2.  **Bloque B: Desacoplamiento de Identidad (Mitigación R3)**
    *   Eliminar la verificación de `usuarios.plan_id` en los workflows de login/sesión en n8n para permitir que nuevos usuarios accedan y completen su onboarding.
3.  **Bloque C: Estructuración Comercial (Precios y Catálogo)**
    *   Crear la tabla `plan_prices` y estructurar el catálogo único de planes (mensual, trimestral, semestral y anual base de 50.000 COP).
    *   Migrar y desasociar la columna de precio estático de `planes`.
4.  **Bloque D: Entidades Financieras e Idempotencia**
    *   Crear las tablas `billing_invoices`, `payment_attempts` e `idempotency_records`.
    *   Configurar RLS en las nuevas tablas para proteger datos financieros de accesos no autorizados.
5.  **Bloque E: Integración de Webhooks y Pasarela**
    *   Crear la tabla `payment_webhook_events`.
    *   Estructurar el procesamiento automático de webhooks en n8n validando firmas y sincronizando estados en `subscriptions`.
6.  **Bloque F: Frontend e Interfaz**
    *   Eliminar el botón "Plan Pro" harcodeado del dashboard y adaptarlo al estado real obtenido de `v_subscription_current` mediante `dashboard/state`.

---

## 7. Conclusión Clara

### Qué está BIEN:
*   La existencia de una tabla `subscriptions` y una función centralizada de verificación de acceso (`tiene_acceso()`) que bloquea o permite el paso en las citas mediante un trigger físico en la base de datos.
*   Políticas RLS básicas configuradas por propietario que restringen el acceso a los datos del tenant.

### Qué está MAL:
*   Inconsistencia severa (Split-Brain) entre las columnas `status` y `estado` en la tabla `subscriptions`.
*   La restricción UNIQUE en `barberia_id` que imposibilita almacenar el historial de facturación de las barberías.
*   El acoplamiento del onboarding a nivel de `usuarios.plan_id` que bloquea a los usuarios nuevos recién creados.

### Qué debe corregirse antes de integrar Mercado Pago:
*   **Prioridad 1:** Resolver la inconsistencia de `tiene_acceso()` apuntándola a `status` y eliminando la columna redundante `estado`.
*   **Prioridad 2:** Eliminar la restricción UNIQUE en `subscriptions(barberia_id)` para permitir guardar múltiples transacciones históricas.
*   **Prioridad 3:** Desvincular la validación de `usuarios.plan_id` en el login/sesión para evitar el bloqueo de registro de nuevos clientes.

---

## 8. Auditoría de Implementación Existente de Mercado Pago

Se realizó una inspección a nivel de base de datos, código fuente y API REST de n8n, revelando la existencia de dos workflows inactivos creados anteriormente para pruebas de integración con Mercado Pago. No existen archivos de Mercado Pago activos en el repositorio de la aplicación backend ni en el frontend.

### 8.1. Detalle de Workflows Detectados en n8n

| ID del Workflow | Nombre del Workflow | Estado Actual | Objetivo Técnico |
| :--- | :--- | :--- | :--- |
| **`eBUyejoMu0CLmMe9`** | `CREATE_PAYMENT_MP_FIXED` | **Inactivo** (false) | Generar preferencias de pago. |
| **`Oss4Znf14ZIi8LMu`** | `MP_WEBHOOK_SUBSCRIPTION_FIXED` | **Inactivo** (false) | Webhook de recepción y actualización de suscripción. |

---

### 8.2. Análisis Técnico del Workflow: `CREATE_PAYMENT_MP_FIXED`
Este flujo actúa como un creador de preferencias de cobro a través del Checkout Pro de Mercado Pago.
*   **Gatillo (Trigger):** Webhook HTTP POST.
*   **Llamada Externa (HTTP Request):** Realiza un POST a `https://api.mercadopago.com/checkout/preferences`.
*   **Cuerpo (Payload) enviado a Mercado Pago:**
    ```json
    {
      "items": [
        {
          "title": "Plan Barbería",
          "quantity": 1,
          "currency_id": "COP",
          "unit_price": 20000
        }
      ],
      "external_reference": "{{ $json.barberia_id || '3' }}",
      "notification_url": "https://barberagency-n8n.gymh5g.easypanel.host/webhook/mp-webhook",
      "back_urls": {
        "success": "https://tu-sitio.com/success",
        "failure": "https://tu-sitio.com/failure"
      },
      "auto_return": "approved"
    }
    ```
*   **Credenciales/Tokens:** Header `Authorization: Bearer TEST-placeholder` (Token de pruebas de Mercado Pago, quemado directamente en el texto del nodo).

---

### 8.3. Análisis Técnico del Workflow: `MP_WEBHOOK_SUBSCRIPTION_FIXED`
Este flujo procesa las notificaciones asíncronas de cobro (IPN/Webhooks) para dar acceso al SaaS.
*   **Gatillo (Trigger):** Webhook HTTP POST (`/webhook/mp-webhook`).
*   **Ruteo de Evento:** Nodo IF verifica que el evento sea de tipo `payment` y que el estado sea `approved`.
*   **Llamada Externa (HTTP Request):** Consulta los detalles del pago de manera segura llamando a:
    `https://api.mercadopago.com/v1/payments/{{$json.body.data.id}}` (Usando el mismo token de pruebas harcodeado).
*   **Actualización de Base de Datos (PostgreSQL):** Ejecuta la siguiente sentencia SQL:
    ```sql
    INSERT INTO subscriptions (
      barberia_id,
      plan_id,
      status,
      estado,
      period_start,
      period_end,
      provider,
      provider_ref
    )
    VALUES (
      {{ $json.external_reference }},
      1,
      'active',
      'activa',
      now(),
      now() + interval '30 days',
      'mercadopago',
      '{{ $json.id }}'
    )
    ON CONFLICT (barberia_id)
    DO UPDATE SET
      plan_id = EXCLUDED.plan_id,
      status = 'active',
      estado = 'activa',
      period_start = now(),
      period_end = now() + interval '30 days',
      updated_at = now();
    ```

---

### 8.4. Diagnóstico de Brechas y Fallas en la Implementación Existente de MP

1.  **Fuga de Seguridad (Tokens Quemados):** El token de acceso (`Bearer TEST-767149...`) está escrito directamente en el cuerpo del parámetro del nodo HTTP en ambos flujos. No se utilizan credenciales seguras de n8n ni variables de entorno.
2.  **Valores de Negocio Harcodeados:**
    *   El precio unitario de la preferencia es de `20000` COP en lugar de los 50.000 COP mensuales/142.500 COP trimestrales etc., definidos por el negocio.
    *   La query SQL asume siempre la inserción de `plan_id = 1` (Plan Starter, cuyo valor es de 0.00 COP) en lugar del plan pagado real.
3.  **Falta de Soporte Multiperiodo:** El cálculo del fin de periodo está harcodeado a `now() + interval '30 days'` de forma inflexible, imposibilitando los pagos trimestrales, semestrales o anuales.
4.  **Carencia de Auditoría y Conciliación:**
    *   No se loggea el webhook en ninguna tabla. Si falla el nodo de Postgres, el webhook responde con error pero no queda rastro del evento para repararlo manualmente.
    *   No hay tabla de facturación (`billing_invoices`) ni registro de intentos (`payment_attempts`).
5.  **Vulnerabilidad ante Reintentos (Sin Idempotencia):** La sentencia SQL utiliza un `ON CONFLICT (barberia_id) DO UPDATE SET period_start = now(), period_end = now() + interval '30 days'`. Si Mercado Pago reenvía el webhook por latencia 5 días después, la fecha de inicio se moverá 5 días adelante de forma incorrecta, y no acumulará el tiempo comprado.
6.  **Incompatibilidad con el Modelo Objetivo:** El uso de `ON CONFLICT (barberia_id)` asume la restricción UNIQUE en `subscriptions(barberia_id)`. Al remover esta restricción para habilitar el historial de pagos, esta query fallará o creará duplicación descontrolada de filas sin control de estado.
