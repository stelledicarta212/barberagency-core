# Matriz de Pruebas de Row Level Security (RLS) - Módulo de Pagos

Este documento define la matriz de casos de prueba físicos para validar que las políticas de RLS de las nuevas tablas de facturación aíslan correctamente a los inquilinos y protegen las tablas de control del backend.

---

## 1. Configuración del Entorno de Pruebas

Para simular las llamadas API a través de PostgREST, se debe impersonar la sesión del inquilino mediante la asignación de variables de sesión en una transacción de PostgreSQL:

```sql
BEGIN;
-- Impersonar Rol del frontend
SET ROLE authenticated;
-- Configurar claims de prueba para el Usuario A (Propietario de Barbería ID A)
SET LOCAL request.jwt.claims = '{"user_id": "101"}'; 
```

---

## 2. Matriz de Casos de Prueba RLS

### Caso 1: Lectura Propia (Usuario A consulta Barbería A)
*   **Contexto:** El usuario `101` es dueño de la barbería ID `10`.
*   **Sentencia Ejecutada:**
    ```sql
    SELECT id, amount, status FROM public.billing_invoices WHERE barberia_id = 10;
    ```
*   **Resultado Esperado:** Retorna los registros de facturas pertenecientes a la barbería ID `10`.
*   **Resultado de Seguridad:** **PASS** (Permitido).

### Caso 2: Intento de Lectura Ajena (Usuario A consulta Barbería B)
*   **Contexto:** El usuario `101` intenta leer datos de la barbería ID `11` (cuyo dueño es el usuario `102`).
*   **Sentencia Ejecutada:**
    ```sql
    SELECT id, amount, status FROM public.billing_invoices WHERE barberia_id = 11;
    ```
*   **Resultado Esperado:** Retorna **0 filas** (Vacío). RLS bloquea de forma silenciosa la consulta.
*   **Resultado de Seguridad:** **PASS** (Contención Tenant exitosa).

### Caso 3: Escritura Directa del Propietario (Intento de Fraude de Invoices)
*   **Contexto:** El usuario `101` intenta saltarse el backend e insertar una factura cobrada falsa.
*   **Sentencia Ejecutada:**
    ```sql
    INSERT INTO public.billing_invoices (barberia_id, amount, currency, status, due_date)
    VALUES (10, 50000.00, 'COP', 'paid', now());
    ```
*   **Resultado Esperado:** Aborta con error de permisos: `ERROR: permission denied for table billing_invoices`.
*   **Resultado de Seguridad:** **PASS** (Frontend sin privilegios de INSERT).

### Caso 4: Alteración Manual de Suscripciones (Bypass de Acceso)
*   **Contexto:** El usuario `101` intenta actualizar la fecha de vencimiento o status de su suscripción de forma directa.
*   **Sentencia Ejecutada:**
    ```sql
    UPDATE public.subscriptions SET period_end = '2030-12-31' WHERE barberia_id = 10;
    ```
*   **Resultado Esperado:** Aborta con error de permisos: `ERROR: permission denied for table subscriptions`.
*   **Resultado de Seguridad:** **PASS** (Frontend sin privilegios de UPDATE).

### Caso 5: Acceso Anónimo (Usuario Anon)
*   **Contexto:** Intento de acceso sin token JWT (`ba_session` ausente).
*   **Sentencia Ejecutada:**
    ```sql
    SET ROLE anon;
    RESET request.jwt.claims;
    SELECT * FROM public.billing_invoices;
    ```
*   **Resultado Esperado:** Retorna **0 filas** (RLS fail-closed) o deniega permisos.
*   **Resultado de Seguridad:** **PASS** (Público bloqueado).

### Caso 6: Lectura de Catálogo Público (Anon lee precios)
*   **Contexto:** El usuario anon carga la landing y visualiza tarifas.
*   **Sentencia Ejecutada:**
    ```sql
    SET ROLE anon;
    SELECT name, amount FROM public.plan_prices WHERE active = true;
    ```
*   **Resultado Esperado:** Retorna las 4 tarifas comerciales COP con éxito.
*   **Resultado de Seguridad:** **PASS** (Lectura del catálogo público permitida).

### Caso 7: Privacidad de Tablas Backend (Fuga de Webhooks y Logs)
*   **Contexto:** El usuario autenticado `101` intenta leer logs de webhooks o tablas de auditoría.
*   **Sentencias Ejecutadas:**
    ```sql
    SET ROLE authenticated;
    SELECT * FROM public.payment_webhook_events;
    SELECT * FROM public.billing_audit_logs;
    ```
*   **Resultado Esperado:** Aborta con error de privilegios en ambas sentencias.
*   **Resultado de Seguridad:** **PASS** (Tablas restringidas al rol superusuario/worker del backend).
