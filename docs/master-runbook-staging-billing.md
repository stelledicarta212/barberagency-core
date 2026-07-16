# Runbook Maestro de Despliegue en Staging - Módulo de Facturación SaaS

Este manual consolida la estrategia, el orden de dependencias y los comandos concretos para aplicar el módulo completo de facturación y suscripciones SaaS de **BarberAgency** en el entorno de **Staging / Pruebas**.

---

## 1. Fase de Preparación y Backup de Garantía

### 1.1. Ejecutar Respaldo Lógico de Datos
Antes de realizar cualquier modificación, se debe generar un volcado de base de datos (`pg_dump`):
```bash
pg_dump -h <host_staging> -U postgres -d barberagency_staging -F c -b -v -f /tmp/staging_pre_billing_master_$(date +%Y%m%d_%H%M%S).dump
```

### 1.2. Prueba de Restauración Obligatoria (RPO = 0)
**CRÍTICO:** Ningún backup se considera válido hasta que se haya comprobado su restauración exitosa en un entorno aislado.
1.  Crear base de datos temporal local:
    ```bash
    createdb -h localhost -U postgres db_restore_verification
    ```
2.  Restaurar el dump:
    ```bash
    pg_restore -h localhost -U postgres -d db_restore_verification -v /tmp/staging_pre_billing_master_*.dump
    ```
3.  Comprobar integridad básica:
    ```sql
    SELECT COUNT(*) FROM public.usuarios;
    ```

---

## 2. Fase de Prechecks (Pre-validaciones Lógicas)

Conectarse al psql de staging y ejecutar:
```sql
-- 1. Validar que la tabla public.planes no contenga columna 'code'
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'planes' AND column_name = 'code';
-- Esperado: 0

-- 2. Confirmar que existan los registros Starter y Pro
SELECT id, nombre FROM public.planes WHERE nombre IN ('Starter', 'Pro');
-- Esperado: 2 filas.
```

---

## 3. Secuencia de Aplicación SQL (Orden de Dependencias)

Ejecutar secuencialmente los scripts SQL utilizando la herramienta de línea de comandos `psql`. **No omitir ningún paso ni alterar el orden de dependencias.**

### Paso A: Parche de Códigos de Catálogo (`planes.code`)
```bash
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2026_add_plan_codes.sql
```
*   *Verificación:* `SELECT id, nombre, code FROM public.planes;` (Starter -> `starter`, Pro -> `pro_legacy`, BarberAgency -> `barberagency_full`).

### Paso B: Core de Cobros V2 y Estructuras Core
```bash
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2027_expand_billing_core_v2.sql
```
*   *Verificación:* `SELECT name, amount FROM public.plan_prices WHERE active = true;` (Debe mostrar los 4 precios COP creados por el seed de forma idempotente).

### Paso C: Permisos Físicos de Inquilino y Roles
```bash
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2028_billing_roles_and_grants.sql
```
*   *Verificación:* Confirmar que los permisos a `PUBLIC` se revocaron y se otorgaron los privilegios mínimos a `anon` y `authenticated`.

### Paso D: RPC Transaccionales Core
```bash
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2029_billing_rpc_core.sql
```
*   *Verificación:* `SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'billing_%';` (Debe listar `billing_create_checkout`, `billing_register_webhook` y `billing_process_approved_payment` en modo stub inicial).

### Paso E: Patrón Transactional Outbox y Re-escritura RPC
```bash
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2030_add_billing_outbox.sql
```
*   *Verificación:* 
    ```sql
    SELECT table_name FROM information_schema.tables WHERE table_name = 'billing_outbox';
    -- Esperado: 1 fila.
    ```
    *Verificación de Triggers:* Confirmar que el trigger `tr_block_outbox_processed_change` está activo sobre `billing_outbox`.

---

## 4. Fase de Postchecks (Verificación de Consistencia)

```sql
-- 1. Validar que el seed se vinculó al plan canónico BarberAgency
SELECT pp.id, p.nombre, pp.name, pp.amount 
FROM public.plan_prices pp
JOIN public.planes p ON pp.plan_id = p.id
WHERE p.code = 'barberagency_full';
-- Esperado: 4 filas (monthly, quarterly, semiannual, annual).

-- 2. Validar inmutabilidad de la tabla de auditoría (Debe abortar con error)
BEGIN;
INSERT INTO public.billing_audit_logs (actor_type, entity_type, entity_id, action) 
VALUES ('system', 'test', '999', 'insert_test');
UPDATE public.billing_audit_logs SET action = 'hack' WHERE entity_id = '999';
ROLLBACK;
```

---

## 5. Protocolo de Pruebas en Staging

1.  **Pruebas de RLS (Casos de Inquilinos):** Ejecutar la batería de pruebas descrita en [docs/matriz-pruebas-rls-billing.md](file:///root/github/barberagency-core/docs/matriz-pruebas-rls-billing.md) e impersonar usuarios.
2.  **Pruebas del Outbox:** Ejecutar la batería de pruebas descrita en [docs/matriz-pruebas-billing-outbox.md](file:///root/github/barberagency-core/docs/matriz-pruebas-billing-outbox.md) para verificar atomicidad de pagos e inmutabilidad de eventos procesados.
3.  **Pruebas de Regresión General:** Completar el checklist funcional [docs/checklist-regresion-expand-billing.md](file:///root/github/barberagency-core/docs/checklist-regresion-expand-billing.md).

---

## 6. Procedimiento de Rollback de Emergencia (Staging/Pre-producción)

Si ocurre algún error crítico durante la ejecución o las pruebas:

### Paso 1: Reversión del Outbox y RPCs
```bash
# Revertir RPCs y Tabla de Outbox (Valida transaccionalmente que la tabla outbox esté vacía)
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2030_add_billing_outbox_rollback_preproduction.sql
```

### Paso 2: Reversión del Core de Cobros
```bash
# Revertir RPCs Core
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2029_billing_rpc_core_rollback.sql

# Revertir Core de Cobros V2 (Valida transaccionalmente que no haya datos financieros)
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2027_expand_billing_core_v2_rollback_preproduction.sql
```

### Paso 3: Reversión de Códigos de Catálogo
```bash
# Revertir Parche de Códigos de Planes
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2026_add_plan_codes_rollback.sql
```
