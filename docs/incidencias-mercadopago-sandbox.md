# Bitácora de Incidencias y Mitigaciones: Mercado Pago Sandbox

Este documento detalla las incidencias técnicas identificadas y corregidas durante la ejecución de pruebas integradas de facturación y outbox para **BarberAgency**.

---

## Incidencia 1: Conflicto de Clave Duplicada en Idempotencia de Checkouts
*   **Problema:** Al ejecutar múltiples casos de prueba en secuencia para la misma barbería (`10`) y el mismo precio (`monthly`) dentro del mismo bloque de hora, las llamadas consecutivas a `billing_create_checkout` fallaban arrojando:
    `duplicate key value violates unique constraint "billing_checkouts_idempotency_key_key"`
*   **Causa:** La clave de idempotencia se genera concatenando `barberia_id`, `plan_price_id` y el truncamiento de la hora actual (`date_trunc('hour', now())`). Por diseño, Postgres evita la creación de múltiples intenciones de pago idénticas para la misma barbería en la misma hora.
*   **Mitigación:** En el entorno de pruebas, se implementó el ayudante `createTestCheckout` que realiza un vaciado preventivo de la tabla `billing_checkouts` antes de cada creación, permitiendo correr la suite de pruebas múltiples veces de forma rápida sin esperar el cambio de hora.

---

## Incidencia 2: Error de Permisos (`permission denied`) en Consultas de Backend
*   **Problema:** Durante la ejecución de la suite de pruebas, las llamadas a `billing_register_webhook` y `billing_process_approved_payment` fallaban con error de denegación de privilegios:
    `permission denied for function billing_register_webhook`
*   **Causa:** Cuando una conexión al pool ejecuta `SET ROLE authenticated;` (para simular el flujo del frontend), la sesión mantiene el rol `authenticated` para todas las declaraciones posteriores en esa misma sesión de conexión. Como `authenticated` no tiene privilegios de ejecución sobre funciones de webhook o procesamiento de pago, las llamadas fallaban.
*   **Mitigación:** Se actualizó la función `runSQL` de la suite de pruebas para inyectar automáticamente la sentencia `RESET ROLE;` al principio de cada consulta que no configure explícitamente la sesión de usuario. Esto asegura que cada tarea administrativa y de backend corra con privilegios del superusuario propietario de la base de datos (`postgres`).
