# Plan de Remediación y Rollback para Migración 2031 (Staging)

Este runbook detalla los pasos para realizar la remediación, control de riesgos y reversión de la migración correctiva `20260713_2031_billing_backend_role.sql` en el entorno de Staging, facilitando la transición ordenada hacia el esquema de máximo endurecimiento definido por la migración `2032`.

---

## 1. Inventario de Objetos y Roles Afectados (Migración 2031)

La migración 2031 introduce los siguientes elementos en la base de datos PostgreSQL de Staging:
* **Rol:** `n8n_billing_worker` (Creado con `LOGIN` y contraseña literal).
* **Membresías:** `GRANT authenticated TO n8n_billing_worker;` (Permite impersonar al rol `authenticated`).
* **Privilegios DML Directos (SELECT, INSERT, UPDATE, DELETE):** Concedidos al rol `n8n_billing_worker` sobre 11 tablas del core de facturación:
  1. `public.plan_prices`
  2. `public.billing_customers`
  3. `public.billing_checkouts`
  4. `public.billing_invoices`
  5. `public.payment_attempts`
  6. `public.payment_transactions`
  7. `public.payment_webhook_events`
  8. `public.idempotency_records`
  9. `public.billing_audit_logs`
  10. `public.subscription_events`
  11. `public.subscriptions`
* **Privilegios de Lectura Directa (SELECT):** Concedidos sobre `public.barberias` y `public.planes`.
* **Privilegios de Ejecución RPC:** Concedidos sobre:
  * `public.billing_create_checkout(INT, INT)`
  * `public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB)`
  * `public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT)`

---

## 2. Riesgos de Ejecución Parcial y Seguridad

1. **Persistencia de Privilegios Excesivos (Brecha de Mínimo Privilegio):**
   Si se aplica la migración 2031 sin revertir los privilegios DML directos de tablas, el worker n8n_billing_worker mantendría acceso directo de escritura y lectura en las tablas, pudiendo saltarse las restricciones de la API/RPC backend.
2. **Impersonación Indeseada (Fuga de RLS):**
   La pertenencia al grupo `authenticated` le permite realizar `SET ROLE authenticated` libremente, lo que puede romper el aislamiento RLS multi-tenant si la conexión n8n no fija los claims correctos.
3. **Bloqueos por DDL:**
   Al revocar o eliminar roles y privilegios, no se producen bloqueos prolongados sobre las tablas, pero se debe asegurar que no haya conexiones activas del rol `n8n_billing_worker` en el momento de la ejecución.

---

## 3. Script de Reversión Completa (Rollback 2031)

Ejecutar la siguiente transacción SQL de forma atómica para limpiar completamente los objetos de la migración 2031 antes de aplicar la migración 2032:

```sql
-- =============================================================================
-- ROLLBACK DE MIGRACIÓN 2031 (SANATIZACIÓN DE ROLES Y PRIVILEGIOS EXCESIVOS)
-- =============================================================================

SET statement_timeout = '10s';
SET lock_timeout = '5s';

BEGIN;

-- 1. Revocar ejecución de funciones del core
REVOKE EXECUTE ON FUNCTION public.billing_create_checkout(INT, INT) FROM n8n_billing_worker;
REVOKE EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) FROM n8n_billing_worker;
REVOKE EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT) FROM n8n_billing_worker;

-- 2. Revocar privilegios directos DML sobre tablas
REVOKE ALL PRIVILEGES ON TABLE public.plan_prices FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.billing_customers FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.billing_checkouts FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.billing_invoices FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.payment_attempts FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.payment_transactions FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.payment_webhook_events FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.idempotency_records FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.billing_audit_logs FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.subscription_events FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.subscriptions FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.barberias FROM n8n_billing_worker;
REVOKE ALL PRIVILEGES ON TABLE public.planes FROM n8n_billing_worker;

-- 3. Revocar acceso a secuencias
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM n8n_billing_worker;

-- 4. Revocar pertenencia a rol autenticado
REVOKE authenticated FROM n8n_billing_worker;

-- 5. Eliminar rol vulnerable
DROP ROLE IF EXISTS n8n_billing_worker;

COMMIT;
```

---

## 4. Orden de Aplicación de la Nueva Arquitectura (2032)

Una vez completado el rollback de la migración 2031, se debe proceder en el siguiente orden para aplicar el esquema seguro:

1. **Paso 1: Ejecutar Rollback de 2031** (Script de la Sección 3).
2. **Paso 2: Aplicar Migración 2032** (`20260713_2032_harden_billing_worker_role.sql`):
   * Crea el rol seguro sin login `n8n_billing_worker_role`.
   * Crea la función segura `billing_create_checkout_backend`.
   * Revoca accesos públicos a los RPC core.
   * Concede exclusivamente permisos de ejecución sobre los RPC backend a `n8n_billing_worker_role`.
   * Fuerza el estado de RLS en todas las tablas de facturación de pagos.
3. **Paso 3: Validar e Implementar el Workflow en n8n:**
   * Cargar el workflow actualizado [BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/n8n/workflows/sandbox/BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX.json).
   * Confirmar la configuración de credenciales del base de datos en n8n utilizando el rol grupo endurecido (`n8n_billing_worker_role`).
