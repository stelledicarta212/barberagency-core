# Revisión Final de la Migración de Expansión V2 (Core de Cobros)

Este documento certifica el análisis técnico, las diferencias frente a la versión anterior y el estado de preparación de los scripts SQL para la fase **EXPAND-ONLY** del módulo de facturación de **BarberAgency**.

---

## 1. Diferencias de la Versión V2 frente a V1

1.  **Eliminación de `auth.uid()`:** Se eliminó cualquier referencia a la función de Supabase `auth.uid()` que no existe en el motor Postgres nativo de BarberAgency, evitando errores de ejecución en PostgREST.
2.  **Alineación de RLS con `public.jwt_user_id()`:** Todas las políticas RLS de inquilino se modificaron para validar la propiedad utilizando la función estable `public.jwt_user_id()` del proyecto, la cual extrae el claim `user_id` de la firma de token PostgREST.
3.  **Uso de `EXISTS` para Inquilinos:** Las políticas de RLS ahora aplican consultas optimizadas mediante `EXISTS` conectadas a `barberias.owner_id = public.jwt_user_id()`, mejorando la velocidad de ejecución y aislamiento.
4.  **Separación de Roles y Permisos:** Los permisos físicos de `GRANT` y `REVOKE` se segregaron a un script de configuración independiente (`20260713_2028_billing_roles_and_grants.sql`), evitando fallas de despliegue en entornos donde los roles aún no estén aprovisionados por el administrador.
5.  **Parche de Códigos de Catálogo (`planes.code`):** Se creó la migración previa (`20260713_2026_add_plan_codes.sql`) para solucionar el bloqueador crítico de datos semilla, permitiendo un seed de precios de forma desacoplada e idempotente.

---

## 2. Catálogo de Planes: Registros y Códigos Asignados

Se auditaron los registros de `public.planes` existentes en el servidor real:

| ID (Físico) | Nombre Actual | Precio Legacy | Código Asignado (Backfill) | Clasificación de Negocio |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Starter | 0.00 COP | `starter` | Plan gratuito básico de onboarding |
| **2** | Pro | 99,000.00 COP | `pro_legacy` | Tarifa especial histórica de producción |

### 2.1. Nuevo Plan Canónico (Creado por la Fase A):
*   **Nombre:** `BarberAgency`
*   **Precio Base:** 50,000.00 COP
*   **Código:** `barberagency_full`
*   **Compatibilidad:** Los registros de barberías y suscripciones históricas que apuntan a `Pro` (ID 2) no sufren alteraciones destructivas y conservan su asociación histórica con `pro_legacy`.

---

## 3. Políticas de RLS en Tablas Nuevas (Modelo V2)

Se configuran las siguientes políticas de Row Level Security para aislar inquilinos (tenants) y prevenir el fraude o la fuga de información financiera:

### 3.1. `plan_prices` (Global Pública)
```sql
CREATE POLICY policy_plan_prices_read ON public.plan_prices
  FOR SELECT TO public USING (active = true);
```

### 3.2. `billing_customers` (Tenant Readable)
```sql
CREATE POLICY policy_billing_customers_read ON public.billing_customers
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.barberias b 
      WHERE b.id = billing_customers.barberia_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );
```

### 3.3. `billing_checkouts` (Tenant Readable)
```sql
CREATE POLICY policy_billing_checkouts_read ON public.billing_checkouts
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.barberias b 
      WHERE b.id = billing_checkouts.barberia_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );
```

### 3.4. `billing_invoices` (Tenant Readable)
```sql
CREATE POLICY policy_billing_invoices_read ON public.billing_invoices
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.barberias b 
      WHERE b.id = billing_invoices.barberia_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );
```

### 3.5. `payment_attempts` (Tenant Readable)
```sql
CREATE POLICY policy_payment_attempts_read ON public.payment_attempts
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.barberias b 
      WHERE b.id = payment_attempts.barberia_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );
```

### 3.6. `payment_transactions` (Tenant Readable)
```sql
CREATE POLICY policy_payment_transactions_read ON public.payment_transactions
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.payment_attempts pa
      JOIN public.barberias b ON pa.barberia_id = b.id
      WHERE pa.id = payment_transactions.payment_attempt_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );
```

### 3.7. `subscription_events` (Tenant Readable)
```sql
CREATE POLICY policy_subscription_events_read ON public.subscription_events
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      JOIN public.barberias b ON s.barberia_id = b.id
      WHERE s.id = subscription_events.subscription_id 
      AND b.owner_id = public.jwt_user_id()
    )
  );
```

---

## 4. Matriz de Permisos (GRANT y REVOKE)

Para evitar la exposición no autorizada, se revocaron todos los permisos de `PUBLIC` sobre las nuevas tablas y funciones, asignando de forma explícita privilegios mínimos a los roles de aplicación correspondientes:

```sql
-- Revocar accesos por defecto
REVOKE ALL ON public.plan_prices FROM PUBLIC;
REVOKE ALL ON public.billing_customers FROM PUBLIC;
REVOKE ALL ON public.billing_checkouts FROM PUBLIC;
REVOKE ALL ON public.billing_invoices FROM PUBLIC;
REVOKE ALL ON public.payment_attempts FROM PUBLIC;
REVOKE ALL ON public.payment_transactions FROM PUBLIC;
REVOKE ALL ON public.payment_webhook_events FROM PUBLIC;
REVOKE ALL ON public.idempotency_records FROM PUBLIC;
REVOKE ALL ON public.billing_audit_logs FROM PUBLIC;
REVOKE ALL ON public.subscription_events FROM PUBLIC;

-- Permisos ba_anon (Catálogo público)
GRANT SELECT ON public.planes TO ba_anon;
GRANT SELECT ON public.plan_prices TO ba_anon;

-- Permisos ba_authenticated (Frontend del panel de barbería)
GRANT SELECT ON public.planes TO ba_authenticated;
GRANT SELECT ON public.plan_prices TO ba_authenticated;
GRANT SELECT ON public.billing_customers TO ba_authenticated;
GRANT SELECT ON public.billing_checkouts TO ba_authenticated;
GRANT SELECT ON public.billing_invoices TO ba_authenticated;
GRANT SELECT ON public.payment_attempts TO ba_authenticated;
GRANT SELECT ON public.payment_transactions TO ba_authenticated;
GRANT SELECT ON public.subscription_events TO ba_authenticated;
GRANT EXECUTE ON FUNCTION public.billing_create_checkout(INT, INT) TO ba_authenticated;

-- Permisos ba_webhook_ingestor (Recibe webhooks de Mercado Pago)
GRANT INSERT ON public.payment_webhook_events TO ba_webhook_ingestor;
GRANT EXECUTE ON FUNCTION public.billing_register_webhook(TEXT, TEXT, TEXT, JSONB) TO ba_webhook_ingestor;

-- Permisos ba_billing_worker (Jobs, conciliación y procesamiento asíncrono)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_customers TO ba_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_checkouts TO ba_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_invoices TO ba_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_attempts TO ba_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_transactions TO ba_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_webhook_events TO ba_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.idempotency_records TO ba_billing_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO ba_billing_worker;
GRANT SELECT, INSERT ON public.billing_audit_logs TO ba_billing_worker;
GRANT SELECT, INSERT ON public.subscription_events TO ba_billing_worker;
GRANT EXECUTE ON FUNCTION public.billing_process_approved_payment(TEXT, TEXT, NUMERIC, NUMERIC, TEXT) TO ba_billing_worker;
```

---

## 5. Consultas de Validación

### 5.1. Consultas de Pre-validación (Prechecks):
```sql
-- Validar que no existan nombres duplicados de planes en el catálogo antes de parchar
SELECT nombre, COUNT(*) 
FROM public.planes 
GROUP BY nombre 
HAVING COUNT(*) > 1;

-- Comprobar si hay llaves foráneas rotas o nulos en las barberías vivas
SELECT id, nombre, owner_id 
FROM public.barberias 
WHERE owner_id IS NULL OR owner_id NOT IN (SELECT id FROM public.usuarios);
```

### 5.2. Consultas de Post-validación (Postchecks):
```sql
-- Validar que el backfill de planes y códigos se completó sin nulos
SELECT id, nombre, code FROM public.planes;

-- Validar que el seed de precios COP se vinculó correctamente por código de plan
SELECT pp.id, p.nombre, pp.name, pp.amount, pp.currency, pp.active 
FROM public.plan_prices pp
JOIN public.planes p ON pp.plan_id = p.id
WHERE p.code = 'barberagency_full';
```

---

## 6. Gestión de Riesgos de Locks y Estrategia de Rollback

### 6.1. Riesgo de Locks de Esquema:
Agregar columnas a `public.subscriptions` requiere un bloqueo exclusivo (`AccessExclusiveLock`). Si coincide con alta concurrencia de reservas de citas en producción, puede causar un cuello de botella.
*   **Mitigación:** Los scripts configuran `lock_timeout = '5s'` y `statement_timeout = '10s'`. Si el bloqueo no se obtiene en 5 segundos, la transacción aborta automáticamente sin degradar el performance. Se ejecutará durante ventana de mantenimiento a las 02:00 COT.

### 6.2. Rollback Pre-Producción:
El script `expand_billing_core_v2_rollback_preproduction.sql` abortará inmediatamente mediante una excepción si detecta registros en cualquiera de las nuevas tablas de facturación o transacciones, impidiendo pérdida de datos accidental en producción.

### 6.3. Estrategia de Contingencia Post-Producción:
En caso de fallos con la integración viva de cobros:
1.  **NO se borran las tablas de base de datos** para preservar facturas e historial para auditorías.
2.  **Desactivación Lógica:** Se cambian las banderas de los flujos de n8n a inactivo y se redireccionan los endpoints de cobro al portal de facturación manual temporal o Starter.

---

## 7. Matriz de Seguridad y RLS

Esta matriz define las políticas de control de acceso por inquilino y backend:

| Tabla | SELECT owner | INSERT owner | UPDATE owner | DELETE owner | Backend only | Expone payload sensible |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`plan_prices`** | `active = true` (público)| Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`billing_customers`** | `owner_id = jwt_user_id()`| Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`billing_checkouts`** | `owner_id = jwt_user_id()`| Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`billing_invoices`** | `owner_id = jwt_user_id()`| Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`payment_attempts`** | `owner_id = jwt_user_id()`| Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`payment_transactions`**| `owner_id = jwt_user_id()`| Bloqueado | Bloqueado | Bloqueado | NO | NO |
| **`payment_webhook_events`**| Bloqueado | Bloqueado | Bloqueado | Bloqueado | **SÍ** | **SÍ** (Payload MP) |
| **`idempotency_records`**| Bloqueado | Bloqueado | Bloqueado | Bloqueado | **SÍ** | NO |
| **`billing_audit_logs`** | Bloqueado | Bloqueado | Bloqueado | Bloqueado | **SÍ** | NO |
| **`subscription_events`** | `owner_id = jwt_user_id()`| Bloqueado | Bloqueado | Bloqueado | NO | NO |

---

## 8. Certificación de Preparación de la Migración

```txt
PLAN_CODE_PATCH_READY = YES
RLS_MODEL_VERIFIED = YES
READY_TO_APPLY_PLAN_CODE_PATCH = YES
READY_TO_APPLY_EXPAND_MIGRATION_V2 = YES
READY_FOR_SANDBOX = NO
READY_FOR_PRODUCTION = NO
```
