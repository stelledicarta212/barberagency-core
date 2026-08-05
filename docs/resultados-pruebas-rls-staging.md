# Resultados de Pruebas de Row Level Security (RLS) - Staging

Este documento presenta los resultados de la suite automatizada de pruebas de seguridad para el aislamiento de inquilinos (Multi-Tenancy) y privilegios mínimos aplicada sobre el módulo de facturación en el entorno Sandbox/Staging.

Las pruebas fueron ejecutadas impersonando los roles reales de la API de PostgREST (`anon` y `authenticated`) y inyectando los claims JWT mediante variables de sesión del motor de PostgreSQL.

---

## Detalle de Casos de Prueba Ejecutados

### Caso 1: El inquilino lee sus propios datos financieros
*   **Contexto:** Se impersonó al usuario autenticado con `jwt_user_id() = 10` (propietario de la Barbería A).
*   **Acción:** Consulta de facturas y suscripciones asociadas a su barbería.
*   **Resultado Esperado:** Retorna exactamente los registros de su barbería.
*   **Resultado de Staging:** **PASS** (Se retornó exitosamente la fila correspondiente a Barbería A).

### Caso 2: El inquilino no lee los datos financieros de otro inquilino
*   **Contexto:** Se impersonó al usuario autenticado con `jwt_user_id() = 10` (propietario de la Barbería A).
*   **Acción:** Intento de consultar facturas y suscripciones asociadas a la Barbería B (`owner_id = 99`).
*   **Resultado Esperado:** Cero registros retornados (los datos del otro inquilino quedan completamente invisibilizados).
*   **Resultado de Staging:** **PASS** (Cero filas filtradas en la consulta cruzada).

### Caso 3: El frontend (inquilino) no puede insertar pagos/facturas directamente
*   **Contexto:** Se impersonó al rol `authenticated`.
*   **Acción:** Ejecución directa de una sentencia `INSERT` sobre la tabla `billing_invoices` (simulando inyección de cobros falsificados desde el navegador).
*   **Resultado Esperado:** Aborta con error de violación de políticas de RLS o denegación de privilegios de inserción.
*   **Resultado de Staging:** **PASS** (Error capturado: `new row violates row-level security policy for table "billing_invoices"`).

### Caso 4: El frontend (inquilino) no puede modificar suscripciones directamente
*   **Contexto:** Se impersonó al rol `authenticated`.
*   **Acción:** Ejecución de una sentencia `UPDATE` para alterar el estado de una suscripción de `past_due` a `active`.
*   **Resultado Esperado:** Aborta o no actualiza ningún registro debido al aislamiento de RLS y carencia de grants de escritura directa.
*   **Resultado de Staging:** **PASS** (No se modificó ninguna fila y el error fue controlado).

### Caso 5: El rol anónimo (`anon`) puede consultar el catálogo de precios activos
*   **Contexto:** Se impersonó al usuario anónimo (sin token JWT).
*   **Acción:** Consulta SELECT sobre la tabla `plan_prices`.
*   **Resultado Esperado:** Retorna la lista de precios comerciales activos.
*   **Resultado de Staging:** **PASS** (Se retornaron correctamente los precios activos en pesos colombianos para el plan BarberAgency).

### Caso 6: El rol anónimo (`anon`) no puede consultar tablas privadas del core
*   **Contexto:** Se impersonó al usuario anónimo.
*   **Acción:** Consulta SELECT sobre tablas financieras (`billing_invoices`, `subscriptions`, `payment_attempts`).
*   **Resultado Esperado:** Cero filas retornadas o denegación de lectura inmediata.
*   **Resultado de Staging:** **PASS** (Lecturas denegadas y aisladas por completo).

### Caso 7a: Las tablas de webhook permanecen ocultas al frontend
*   **Contexto:** Se impersonó al rol `authenticated`.
*   **Acción:** Intento de leer la tabla de ingesta de eventos de webhook `payment_webhook_events`.
*   **Resultado Esperado:** Error de privilegios (SELECT denegado).
*   **Resultado de Staging:** **PASS** (El acceso de lectura directa quedó completamente denegado y protegido).

### Caso 7b: Las tablas de auditoría permanecen ocultas al frontend
*   **Contexto:** Se impersonó al rol `authenticated`.
*   **Acción:** Intento de consultar la tabla `billing_audit_logs`.
*   **Resultado Esperado:** Error de privilegios (SELECT denegado).
*   **Resultado de Staging:** **PASS** (Denegación total de lectura de bitácoras de seguridad).

---

## Matriz de Resumen RLS

| ID Caso | Descripción del Caso | Rol Invocador | Operación | Estado de Seguridad |
| :--- | :--- | :--- | :--- | :--- |
| **Caso 1** | Lectura de Datos Propios | `authenticated` | SELECT | **PASS** (Permitido) |
| **Caso 2** | Aislamiento de Inquilinos | `authenticated` | SELECT | **PASS** (Denegado/Filtrado) |
| **Caso 3** | Inserción Directa de Facturas | `authenticated` | INSERT | **PASS** (Bloqueado por RLS) |
| **Caso 4** | Modificación de Suscripciones | `authenticated` | UPDATE | **PASS** (Bloqueado por RLS) |
| **Caso 5** | Lectura Pública de Catálogo | `anon` | SELECT | **PASS** (Permitido) |
| **Caso 6** | Lectura Anónima de Suscripciones | `anon` | SELECT | **PASS** (Denegado/Filtrado) |
| **Caso 7a** | Lectura Directa de Webhooks | `authenticated` | SELECT | **PASS** (Acceso Denegado) |
| **Caso 7b** | Lectura Directa de Auditoría | `authenticated` | SELECT | **PASS** (Acceso Denegado) |

*Conclusión de Seguridad:* El esquema Sandbox/Staging de BarberAgency cumple plenamente con las políticas de aislamiento financiero y mitigación de fraude. **RLS_TESTS_PASSED = YES**.
