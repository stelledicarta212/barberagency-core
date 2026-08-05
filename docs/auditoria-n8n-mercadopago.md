# Auditoría de Implementación Existente de Mercado Pago en n8n

Este documento recopila la auditoría completa y de solo lectura de los flujos de n8n relacionados con la pasarela de pagos Mercado Pago en el proyecto **BarberAgency**.

---

## 1. Localización de Workflows (Fase 1)

Se inspeccionaron las definiciones de workflows activos e inactivos en el servidor de n8n, localizando **dos (2) workflows** específicos creados para pruebas de Mercado Pago. Ambos se encuentran actualmente en estado **inactivo**.

No se encontraron archivos JavaScript, configuraciones o rutas de endpoints de Mercado Pago en los repositorios de la aplicación backend o frontend. La lógica de integración existente vive exclusivamente en el motor de n8n.

### Resumen de Workflows Encontrados:
1.  **`CREATE_PAYMENT_MP_FIXED` (Workflow ID: `eBUyejoMu0CLmMe9`)**
    *   **Estado:** Inactivo (`active: false`).
    *   **Creado el:** `2026-04-01T00:02:58.716Z`
    *   **Última actualización:** `2026-04-01T00:15:18.205Z`
2.  **`MP_WEBHOOK_SUBSCRIPTION_FIXED` (Workflow ID: `Oss4Znf14ZIi8LMu`)**
    *   **Estado:** Inactivo (`active: false`).
    *   **Creado el:** `2026-03-31T22:52:41.606Z`
    *   **Última actualización:** `2026-03-31T23:45:04.220Z`

---

## 2. Identificación de Webhooks (Fase 2)

A continuación, se documenta la ficha técnica del disparador de webhook para cada workflow analizado:

### 2.1. Webhook de Creación: `CREATE_PAYMENT_MP_FIXED`
*   **Workflow Name:** `CREATE_PAYMENT_MP_FIXED`
*   **Workflow ID:** `eBUyejoMu0CLmMe9`
*   **Estado:** Inactivo.
*   **Nodo Webhook:** `Webhook` (Node Name), `n8n-nodes-base.webhook` (Type), `typeVersion: 1`.
*   **Método HTTP:** `POST`.
*   **Path:** `create-payment`.
*   **URL de Prueba:** `https://barberagency-n8n.gymh5g.easypanel.host/webhook-test/create-payment`
*   **URL de Producción:** `https://barberagency-n8n.gymh5g.easypanel.host/webhook/create-payment`
*   **Response Mode:** `responseNode` (Responde con la respuesta construida por el nodo final).
*   **Authentication Mode:** `None` (Ninguna autenticación configurada, abierto al público).
*   **Workflow que lo llama:** Invocado externamente desde el frontend/dashboard de la barbería para iniciar el checkout.
*   **Path Duplicado:** No se encontraron paths duplicados para esta ruta.
*   **Accesibilidad actual:** Al estar inactivo el workflow, el servidor de n8n responde con error 404 ante cualquier llamada.

### 2.2. Webhook de Confirmación: `MP_WEBHOOK_SUBSCRIPTION_FIXED`
*   **Workflow Name:** `MP_WEBHOOK_SUBSCRIPTION_FIXED`
*   **Workflow ID:** `Oss4Znf14ZIi8LMu`
*   **Estado:** Inactivo.
*   **Nodo Webhook:** `Webhook` (Node Name), `n8n-nodes-base.webhook` (Type), `typeVersion: 1`.
*   **Método HTTP:** `POST`.
*   **Path:** `mp-webhook`.
*   **URL de Prueba:** `https://barberagency-n8n.gymh5g.easypanel.host/webhook-test/mp-webhook`
*   **URL de Producción:** `https://barberagency-n8n.gymh5g.easypanel.host/webhook/mp-webhook`
*   **Response Mode:** `responseNode` (Responde con la respuesta construida por el nodo final).
*   **Authentication Mode:** `None` (Ninguna autenticación configurada).
*   **Workflow que lo llama:** Invocado por los servidores de Mercado Pago de forma asíncrona tras procesarse un cobro.
*   **Path Duplicado:** No se encontraron otros paths duplicados para esta ruta.
*   **Accesibilidad actual:** Al estar inactivo el workflow, el servidor responde con error 404.

---

## 3. Mapa de Flujo Nodo a Nodo (Fase 3)

### 3.1. Workflow: `CREATE_PAYMENT_MP_FIXED` (Checkout / Preferencia)

El flujo se compone de tres nodos secuenciales:

```text
Webhook (Gatillo) 
  → Create Payment MP (HTTP Post a Mercado Pago) 
  → Respond (Retorno JSON con init_point)
```

#### Nodo 1: `Webhook`
*   **Tipo:** `n8n-nodes-base.webhook` (version 1)
*   **Propósito:** Recibir la petición de inicio de pago del cliente.
*   **Entradas:** Petición HTTP POST externa.
*   **Salidas:** Body con `barberia_id` enviado por el cliente.
*   **Errores posibles:** Error de parsing si el body no es JSON.
*   **Credenciales:** Ninguna.

#### Nodo 2: `Create Payment MP`
*   **Tipo:** `n8n-nodes-base.httpRequest` (version 4.1)
*   **Propósito:** Registrar una preferencia de Checkout Pro en Mercado Pago.
*   **Entradas:** Flujo del nodo Webhook.
*   **Salidas:** JSON de respuesta de Mercado Pago con los parámetros de la preferencia (incluyendo `init_point`, `id` de preferencia).
*   **Variables relevantes & Expresiones:**
    *   `Authorization`: Header estático con token de pruebas (Ver sección de seguridad).
    *   `external_reference`: `{{ $json.barberia_id || '3' }}`. Define el tenant destinatario.
    *   `notification_url`: `https://barberagency-n8n.gymh5g.easypanel.host/webhook/mp-webhook`
    *   `unit_price`: `20000` (COP) harcodeado.
    *   `back_urls`: Redirecciones de éxito/fallo harcodeadas a `https://tu-sitio.com`.
*   **Errores posibles:** Token de Mercado Pago expirado/inválido (HTTP 401), parámetros inválidos de precio (HTTP 400), caída de red de Mercado Pago (5xx).
*   **Credenciales:** No usa el manejador de credenciales de n8n; el token de portador está quemado en texto en los parámetros del nodo.

#### Nodo 3: `Respond`
*   **Tipo:** `n8n-nodes-base.respondToWebhook` (version 1)
*   **Propósito:** Responder al cliente que inició la petición retornando la URL de pago de Mercado Pago.
*   **Entradas:** Flujo del nodo `Create Payment MP`.
*   **Salidas:** JSON: `{"url": "{{$json.init_point}}"}`.
*   **Variables relevantes:** `{{$json.init_point}}` (URL de Checkout Pro provista por Mercado Pago).
*   **Errores posibles:** Falla en la expresión de resolución si el nodo anterior no retornó `init_point`.
*   **Credenciales:** Ninguna.

---

### 3.2. Workflow: `MP_WEBHOOK_SUBSCRIPTION_FIXED` (Recepción de Pago)

El flujo se compone de seis nodos y un camino condicional:

```text
Webhook (Gatillo) 
  → IF Type = payment (Valida evento) 
      → Get Payment MP (HTTP GET a Mercado Pago) 
          → IF Approved (Valida aprobación)
              → Upsert Subscription (Escribe en PostgreSQL)
                  → Respond (Respuesta HTTP)
```

#### Nodo 1: `Webhook`
*   **Tipo:** `n8n-nodes-base.webhook` (version 1)
*   **Propósito:** Recibir notificaciones instantáneas de pago (IPN) de Mercado Pago.
*   **Entradas:** HTTP POST externo desde Mercado Pago.
*   **Salidas:** Body con los datos básicos del evento (ej. `action`, `type`, `data.id`).
*   **Errores posibles:** Error de parsing si el body no es JSON.
*   **Credenciales:** Ninguna.

#### Nodo 2: `IF Type = payment`
*   **Tipo:** `n8n-nodes-base.if` (version 1)
*   **Propósito:** Asegurar que el webhook recibido sea referente a un pago (`payment`) y no a otros eventos de Mercado Pago.
*   **Entradas:** Flujo del webhook.
*   **Salidas:** Salida "true" si la expresión se cumple; de lo contrario "false" (el flujo se detiene).
*   **Expresión utilizada:** `{{ $json.body.type }}` igual a `"payment"`.

#### Nodo 3: `Get Payment MP`
*   **Tipo:** `n8n-nodes-base.httpRequest` (version 4.4)
*   **Propósito:** Consultar los detalles del pago de manera directa a la API de Mercado Pago usando el ID del recurso. Esto sirve como validación de seguridad (evita que se envíen peticiones falsificadas al webhook).
*   **Entradas:** Flujo "true" del nodo anterior.
*   **Salidas:** Detalle del pago (monto, estado, referencia externa).
*   **Expresión de URL:** `https://api.mercadopago.com/v1/payments/{{$json.body.data.id}}`
*   **Credenciales:** Token quemado en texto plano en el nodo (`Authorization: Bearer TEST-767149...`).
*   **Errores posibles:** Token inválido/expirado (401), recurso de pago no encontrado en Mercado Pago (404).

#### Nodo 4: `IF Approved`
*   **Tipo:** `n8n-nodes-base.if` (version 1)
*   **Propósito:** Filtrar transacciones aprobadas físicamente.
*   **Entradas:** Flujo de `Get Payment MP`.
*   **Salidas:** Salida "true" si el estado del pago es aprobado; de lo contrario "false" (el flujo se detiene).
*   **Expresión utilizada:** `{{ $json.status }}` igual a `"approved"`.

#### Nodo 5: `Upsert Subscription`
*   **Tipo:** `n8n-nodes-base.postgres` (version 2)
*   **Propósito:** Insertar o actualizar los datos de la suscripción de la barbería en PostgreSQL.
*   **Entradas:** Flujo "true" del nodo anterior.
*   **Salidas:** Confirmación de inserción/actualización de fila.
*   **Tablas modificadas:** `subscriptions` (escribe y actualiza).
*   **Sentencia SQL ejecutada:**
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
*   **Credenciales:** Usa credenciales configuradas en n8n llamadas `"Postgres account"` (ID: `SOV6oSyuHI9cxgLF`).
*   **Errores posibles:** Error de sintaxis SQL, error de conexión con la base de datos, violación de llaves foráneas (`barberia_id` inexistente en `barberias`).

#### Nodo 6: `Respond`
*   **Tipo:** `n8n-nodes-base.respondToWebhook` (version 1)
*   **Propósito:** Retornar una respuesta HTTP 200 a Mercado Pago para confirmar la recepción exitosa del webhook.
*   **Entradas:** Flujo del nodo `Upsert Subscription`.
*   **Salidas:** Respuesta HTTP vacía o predeterminada con código 200.

---

## 4. Análisis de Reutilización

### ¿Qué se puede reutilizar?
1.  **Arquitectura del Webhook de Recepción:** El flujo de recibir el webhook, verificar que el tipo sea `payment`, consultar los detalles del pago llamando a `/v1/payments/{id}` a Mercado Pago para validar la autenticidad y actuar según el estado (`approved`) es un patrón correcto y seguro que debe conservarse.
2.  **Flujo del Webhook de Checkout:** El flujo de recibir el `barberia_id` del frontend, crear la preferencia de cobro y retornar el `init_point` es correcto y reutilizable.

---

## 5. Riesgos Críticos antes de la Integración con el Modelo de Pagos

El análisis de solo lectura de estos workflows revela los siguientes riesgos e incompatibilidades que deben resolverse antes de su activación:

### 1. Fuga de Seguridad (Tokens Quemados en Código)
*   **Ubicación:** 
    *   Workflow `CREATE_PAYMENT_MP_FIXED`, nodo `Create Payment MP`, parámetro header `Authorization`.
    *   Workflow `MP_WEBHOOK_SUBSCRIPTION_FIXED`, nodo `Get Payment MP`, parámetro header `Authorization`.
*   **Variable expuesta:** Access Token de prueba de Mercado Pago: `TEST-placeholder`.
*   **Riesgo:** Si bien es un token de entorno de pruebas (`TEST`), su quemado directo en el JSON expone credenciales en exportaciones y git.
*   **Mitigación:** Mover el token a una credencial oficial de n8n o leerlo desde las variables de entorno de EasyPanel mediante variables locales del backend.

### 2. Precios e Identificadores de Plan Harcodeados
*   **Ubicación:** 
    *   `CREATE_PAYMENT_MP_FIXED` define `"unit_price": 20000` (COP) de manera estática.
    *   `MP_WEBHOOK_SUBSCRIPTION_FIXED` ejecuta un SQL que escribe `plan_id = 1` por defecto (Plan Starter, valor 0.00 COP).
*   **Riesgo:** El precio comercial establecido para el plan único de BarberAgency es de **50.000 COP mensual**, con variantes trimestrales, semestrales y anuales. La implementación actual ignora los requerimientos comerciales y asigna planes equivocados a nivel de base de datos.
*   **Mitigación:** Leer el precio dinámicamente desde la nueva tabla `plan_prices` según el periodo de facturación seleccionado por el administrador en el frontend.

### 3. Vulnerabilidad ante Reintentos y Latencia (Falta de Idempotencia)
*   **Ubicación:** `MP_WEBHOOK_SUBSCRIPTION_FIXED`, sentencia del nodo `Upsert Subscription`.
*   **Riesgo:** Al hacer un `DO UPDATE SET period_start = now(), period_end = now() + interval '30 days'`, el inicio y fin de la suscripción quedan atados estrictamente al segundo exacto en que se ejecuta el query. Si Mercado Pago reenvía el webhook 3 días después por un reintento de red, las fechas del cliente se correrán 3 días hacia adelante, y no acumulará el tiempo comprado. Además, peticiones concurrentes duplicarían la extensión.
*   **Mitigación:** Registrar primero las transacciones e ingresos en una tabla de auditoría, validar contra `idempotency_records` y actualizar la fecha de vencimiento sumando el intervalo de forma matemática en lugar de usar `now()`.

### 4. Rompimiento de Historial Financiero
*   **Ubicación:** `MP_WEBHOOK_SUBSCRIPTION_FIXED`, query SQL.
*   **Riesgo:** El query utiliza `ON CONFLICT (barberia_id) DO UPDATE`. Esto asume que la tabla `subscriptions` solo puede tener un registro por barbería. Al remover la restricción UNIQUE física (requerimiento crítico R2 para mantener historial y auditoría), esta query arrojará errores de colisión o creará duplicación de registros desordenados.
*   **Mitigación:** La query del webhook debe insertar en `billing_invoices` y generar un nuevo registro histórico en `subscriptions` (o actualizar solo la fila marcada como activa según el índice único parcial).

### 5. Inexistencia de Firma de Validación del Webhook
*   **Ubicación:** `MP_WEBHOOK_SUBSCRIPTION_FIXED`, nodo `Webhook`.
*   **Riesgo:** El webhook no valida el encabezado de firma secreta de Mercado Pago (`x-signature` o similar). Cualquiera que conozca la URL pública `/webhook/mp-webhook` podría enviar peticiones falsas. Si bien el nodo realiza un `Get Payment` asíncrono para verificar (lo que mitiga en gran parte el fraude), se debe robustecer con la firma nativa para evitar sobrecargar los límites de API de Mercado Pago.
