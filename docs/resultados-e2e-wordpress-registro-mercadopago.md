# Resultados de Pruebas E2E: WordPress, Registro y Mercado Pago Sandbox

Este documento resume los resultados obtenidos en las comprobaciones de integración y las pruebas de simulación de extremo a extremo (E2E) para la conexión del flujo de facturación.

---

## 1. Comprobaciones de Tarifas y Redirecciones

### Caso 1: Tarjeta Mensual (`monthly`)
*   **Comportamiento Esperado:** Lectura del parámetro `term=monthly`, cálculo server-side de 50.000 COP y generación del checkout.
*   **Resultado:** **PASADO**. El plan se lee correctamente, la base de datos resuelve 50.000 COP usando el catálogo y se genera el `init_point`.

### Caso 2: Tarjeta Trimestral (`quarterly`)
*   **Comportamiento Esperado:** Lectura de `term=quarterly`, resolución en base de datos de 142.500 COP y checkout exitoso.
*   **Resultado:** **PASADO**. El monto devuelto coincide con el catálogo de Staging.

### Caso 3: Tarjeta Semestral (`semiannual`)
*   **Comportamiento Esperado:** Lectura de `term=semiannual`, resolución server-side de 270.000 COP y checkout exitoso.
*   **Resultado:** **PASADO**. Los precios se comprueban estrictamente del lado del servidor.

### Caso 4: Tarjeta Anual (`annual`)
*   **Comportamiento Esperado:** Lectura de `term=annual`, resolución server-side de 510.000 COP y checkout exitoso.
*   **Resultado:** **PASADO**. Se genera la preferencia en Mercado Pago con el valor total esperado.

### Caso 5: URL sin Parámetros
*   **Comportamiento Esperado:** La página de registro carga de forma estándar (sin redirección de checkout/suscripción al finalizar).
*   **Resultado:** **PASADO**. `billing_selection` queda en `null` y el flujo finaliza en el editor de landing estándar como de costumbre.

### Caso 6: Período (`term`) Inválido
*   **Comportamiento Esperado:** Uso de `monthly` como fallback seguro si el período provisto no está en la lista permitida.
*   **Resultado:** **PASADO**. Parámetros como `term=invalid_value` se corrigen de inmediato a `monthly`.

### Caso 7: Plan Inválido
*   **Comportamiento Esperado:** Si el plan no es `barberagency_full`, se sustituye o ignora, garantizando que solo planes aprobados entren al flujo.
*   **Resultado:** **PASADO**. Solo el código `barberagency_full` es aceptado y persistido.

---

## 2. Pruebas de Persistencia, Concurrencia y Robustez

### Caso 8: Recarga durante el Onboarding
*   **Comportamiento Esperado:** La selección de facturación debe conservarse al refrescar la página.
*   **Resultado:** **PASADO**. Se almacena en `localStorage` y se vuelve a inyectar al inicializar el borrador.

### Caso 9: Login Intermedio
*   **Comportamiento Esperado:** Si el usuario inicia sesión durante el wizard o retorna tras Google Login, la selección no se pierde.
*   **Resultado:** **PASADO**. El borrador en `localStorage` persiste intacto durante los flujos de autenticación.

### Caso 10: Doble Clic (Protección Doble Envío)
*   **Comportamiento Esperado:** Los botones se inhabilitan al momento de invocar el checkout.
*   **Resultado:** **PASADO**. Se inyecta la clase disabled y texto de cargando en el primer clic.

### Caso 11: Usuario A intentando usar `barberia_id` de B
*   **Comportamiento Esperado:** El backend/RPC debe validar que el `jwt_user_id()` coincide con el propietario de la barbería antes de procesar checkout.
*   **Resultado:** **PASADO**. RLS y validaciones en `billing_create_checkout` deniegan la operación devolviendo error HTTP 403.

### Caso 12: Fallo de Endpoint de Checkout
*   **Comportamiento Esperado:** Si n8n o Mercado Pago fallan, la barbería no se pierde y se habilita un botón de reintento.
*   **Resultado:** **PASADO**. La UI dibuja el mensaje de error y agrega dinámicamente el botón "Reintentar checkout".

### Caso 13: Checkout Duplicado (Idempotencia)
*   **Comportamiento Esperado:** La clave de idempotencia evita la creación de transacciones concurrentes repetidas para el mismo período.
*   **Resultado:** **PASADO**. Postgres e n8n detectan el checkout existente dentro de la misma hora calendario y devuelven el mismo identificador.

---

## 3. Comprobaciones de Retorno y Polling

### Caso 14: Retorno `approved` (Pago Exitoso)
*   **Comportamiento Esperado:** Muestra mensaje informativo, inicia polling y activa botón al detectar estado `'active'` en DB.
*   **Resultado:** **PASADO**. Se espera al webhook de fondo sin otorgar acceso local directo desde el cliente.

### Caso 15: Retorno `pending` (Pago Pendiente)
*   **Comportamiento Esperado:** Muestra mensaje de pago pendiente de confirmación y mantiene polling activo.
*   **Resultado:** **PASADO**. Dibuja la UI correspondiente y se mantiene a la espera del procesamiento de red de Mercado Pago.

### Caso 16: Retorno `rejected` (Pago Rechazado)
*   **Comportamiento Esperado:** Muestra mensaje indicando fallo del pago y permite reintentar o volver.
*   **Resultado:** **PASADO**. Se informa claramente al usuario que el cobro no se pudo concretar.
