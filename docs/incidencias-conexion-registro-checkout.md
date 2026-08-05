# Bitácora de Incidencias: Conexión de Registro y Checkout

Este documento registra los desafíos técnicos identificados durante el diseño, implementación y prueba de la integración del flujo de facturación, junto con sus respectivas soluciones de ingeniería.

---

## 1. Registro de Incidencias y Mitigaciones

### Incidencia 1: Exposición de Tokens de Acceso en JSONs de Pruebas
*   **Riesgo:** Commits accidentales que contengan claves Bearer de la API de Mercado Pago o n8n.
*   **Solución:** Se realizó una auditoría y se reemplazaron los tokens fijos en `pruebas/mp_webhook_subscription_fixed.json` y `pruebas/create_payment_mp_fixed.json` con variables de sustitución `{{ YOUR_SANDBOX_TOKEN }}`, garantizando la seguridad en el repositorio.

### Incidencia 2: Carrera de Creación de Preferencias (Doble Clic)
*   **Riesgo:** Si un usuario hace clic varias veces rápidamente en "Crear barbería" o "Seguir", se pueden disparar múltiples checkouts concurrentes en Mercado Pago, consumiendo recursos y duplicando referencias.
*   **Solución:** Se implementó bloqueo en el primer clic deshabilitando temporalmente los botones del wizard y cambiando su texto a loading (`Redirigiendo a checkout...`).

### Incidencia 3: Manipulación de Precios (Client-Side Price Tampering)
*   **Riesgo:** Un atacante malintencionado podría interceptar la petición del navegador y alterar el campo de precio o moneda (ej: cambiar 510.000 COP a 1 COP).
*   **Solución:** El frontend no envía montos ni monedas al backend de checkout. Solo transmite `plan_code` y `billing_term`. El workflow de n8n y la base de datos Postgres resuelven de forma exclusiva los valores reales desde la tabla `plan_prices`, asegurando que no se pueda registrar un checkout con precios modificados.

### Incidencia 4: Modificación del ID del Precio (plan_price_id)
*   **Riesgo:** Un usuario podría intentar enviar un `plan_price_id` aleatorio o inactivo para obtener tarifas vencidas o no válidas.
*   **Solución:** En lugar de aceptar `plan_price_id` directamente del cliente, se configuró la consulta en el workflow de n8n para buscar únicamente precios activos en la base de datos filtrando por `active = true` y validando las propiedades del plan comerciales.

### Incidencia 5: Secuestro de Redirección (Open Redirect)
*   **Riesgo:** Redirigir al usuario tras el pago a un sitio de phishing o dominio externo mediante manipulación de parámetros del checkout.
*   **Solución:** Las URLs de retorno (`back_urls`) están estrictamente configuradas del lado del servidor en el nodo de API de Mercado Pago de n8n, utilizando rutas fijas que apuntan exclusivamente al dominio oficial de BarberAgency en staging (`https://barberagency-barberagency.gymh5g.easypanel.host`).
