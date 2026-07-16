# Auditoría de Conexión: WordPress, Página de Registro y Checkout (Mercado Pago Sandbox)

Este documento detalla la auditoría realizada sobre la integración de las tarjetas de planes de WordPress, la página de registro `/registro` (`registrobarberia.html`), y el inicio del checkout del Sandbox de Mercado Pago.

---

## 1. Lectura de Parámetros `plan` y `term` en `/registro`

*   **Pregunta 1: ¿La página `/registro` lee los parámetros `plan` y `term`?**
    *   *Respuesta:* **NO**. El código actual del frontend en `registrobarberia.html` no busca ni extrae los query parameters `plan` o `term` de la URL.
*   **Pregunta 2: ¿En qué archivo o script se leen?**
    *   *Respuesta:* **NINGUNO**. No existen referencias a `plan` o `term` como parámetros de entrada en el flujo de registro o de inicialización del wizard.
*   **Pregunta 3: ¿Se validan contra una allowlist (`plan = barberagency_full`, `term = monthly|quarterly|semiannual|annual`)?**
    *   *Respuesta:* **NO**. No hay implementado ningún validador o allowlist para el plan/período en el frontend.

---

## 2. Persistencia y Asociación del Plan en el Onboarding

*   **Pregunta 4: ¿La selección se conserva durante todo el onboarding?**
    *   *Respuesta:* **NO**. Al no leerse de la URL en la carga inicial, el plan elegido en WordPress no se almacena en el estado del wizard.
*   **Pregunta 5: ¿Dónde se guarda temporalmente?**
    *   *Respuesta:* **NO SE ALMACENA**. El borrador (`draft`) del onboarding guardado en `localStorage` (bajo la clave `ba_landing_seed` / `landing_seed`) contiene datos de la barbería, servicios, horarios, barberos y accesos de administración, pero **no** almacena campos para `plan` o `term`.
*   **Pregunta 6: ¿La selección queda asociada a la barbería correcta después de crearla?**
    *   *Respuesta:* **NO**. El payload enviado al backend (`postOnboardingPayload`) no incluye información del plan seleccionado, por lo que la barbería se crea sin suscripción activa asociada de inmediato.

---

## 3. Conexión de Checkout y Redirección del Frontend

*   **Pregunta 7: ¿El frontend llama al endpoint del workflow `BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX`?**
    *   *Respuesta:* **NO**. El flujo del frontend culmina al completar el Paso 6 redireccionando directamente al constructor de landings (`buildLandingBuilderUrl`), sin invocar la creación de preferencias de Mercado Pago.
*   **Pregunta 8: ¿La llamada incluye la sesión `ba_session`?**
    *   *Respuesta:* **NO**. No se efectúa la llamada.
*   **Pregunta 9: ¿El endpoint del workflow valida `owner_id` y `barberia_id`?**
    *   *Respuesta:* **SÍ**. El RPC subyacente (`billing_create_checkout`) ejecutado por el workflow en Postgres exige que el usuario autenticado (`public.jwt_user_id()`) coincida con el `owner_id` de la barbería (`barberia_id`).
*   **Pregunta 10: ¿El frontend no envía ni controla `amount` o `currency`?**
    *   *Respuesta:* **SÍ**. El diseño de seguridad se cumple en el sentido de que el frontend no envía información de precios; sin embargo, no está conectado el disparador.
*   **Pregunta 11: ¿`billing_create_checkout` resuelve el precio desde `plan_prices`?**
    *   *Respuesta:* **SÍ**. Como se verificó en las pruebas unitarias, el precio y la moneda se extraen directamente del catálogo comercial de la base de datos para prevenir manipulación de precios.
*   **Pregunta 12: ¿El workflow devuelve `init_point`?**
    *   *Respuesta:* **SÍ**. El workflow de n8n creado (`uKWA9IwRcUciiuQs`) llama a Mercado Pago, registra la preferencia en base de datos y retorna el `init_point` (URL de pago).
*   **Pregunta 13: ¿El navegador redirige correctamente a Mercado Pago Sandbox?**
    *   *Respuesta:* **NO**. No existe la lógica de redirección a la pasarela tras el registro.
*   **Pregunta 14: ¿La cancelación o error devuelve al usuario a una página válida?**
    *   *Respuesta:* **NO**. Al no iniciarse el checkout desde el frontend, no hay rutas de retorno activadas en el navegador del usuario real.
*   **Pregunta 15: ¿El pago aprobado termina activando la suscripción correcta?**
    *   *Respuesta:* **SÍ**. En las simulaciones de la suite de pruebas del backend, la ingesta del webhook aprobado asocia y activa el plan con su vigencia exacta en Postgres.
