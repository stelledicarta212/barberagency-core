# Runbook de Despliegue en Staging - Módulo de Facturación SaaS

Este documento define el procedimiento paso a paso para la aplicación controlada y verificación del parche de códigos de planes, la migración core de cobros y los privilegios físicos de roles en el entorno de **Staging / Pruebas**.

---

## Fase 1: Respaldo y Garantía de Recuperación (RPO = 0)

### 1.1. Ejecutar Backup Lógico
Antes de realizar cualquier modificación, se debe generar un volcado de base de datos (`pg_dump`):
```bash
pg_dump -h <host_db> -U postgres -d barberagency_prod -F c -b -v -f /tmp/pre_billing_expand_$(date +%Y%m%d_%H%M%S).dump
```
*   *Nota:* Para bases de datos en Neon, se puede realizar un snapshot de rama instantáneo a través de la CLI de Neon:
    ```bash
    neon branches create --parent-branch main --name pre-billing-migration-backup
    ```

### 1.2. Prueba de Restauración (Restoration Test)
**CRÍTICO:** Ningún backup se considera válido hasta que se haya comprobado su restauración exitosa.
1.  Crear una base de datos local o en una rama aislada de pruebas (`barberagency_restore_test`):
    ```bash
    createdb -h localhost -U postgres barberagency_restore_test
    ```
2.  Restaurar el volcado generado:
    ```bash
    pg_restore -h localhost -U postgres -d barberagency_restore_test -v /tmp/pre_billing_expand_*.dump
    ```
3.  Validar integridad mínima ejecutando una consulta de control:
    ```sql
    SELECT COUNT(*) FROM public.usuarios;
    ```
    *El recuento debe coincidir exactamente con el de la base original.*

---

## Fase 2: Prechecks (Pre-validaciones Lógicas)

Ejecutar las siguientes consultas lógicas en la base de datos destino antes de iniciar:

```sql
-- 1. Comprobar que planes no tenga códigos para evitar colisiones
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'planes' AND column_name = 'code';
-- Esperado: 0

-- 2. Validar que los nombres de planes Starter y Pro existan para el backfill
SELECT id, nombre FROM public.planes WHERE nombre IN ('Starter', 'Pro');
-- Esperado: 2 filas.
```

---

## Fase 3: Secuencia de Despliegue SQL

Conectarse a la base de datos con el rol propietario principal (`postgres`) y aplicar los scripts en el siguiente orden secuencial estricto:

### 3.1. Aplicar Parche de Planes
```bash
psql -h <host_db> -U postgres -d <dbname> -f migrations/20260713_2026_add_plan_codes.sql
```
*   *Verificación:*
    ```sql
    SELECT id, nombre, code FROM public.planes;
    ```
    *Esperado:* 3 registros (`starter`, `pro_legacy`, `barberagency_full`).

### 3.2. Aplicar Core de Cobros V2
```bash
psql -h <host_db> -U postgres -d <dbname> -f migrations/20260713_2027_expand_billing_core_v2.sql
```
*   *Verificación:*
    ```sql
    SELECT name, amount FROM public.plan_prices WHERE active = true;
    ```
    *Esperado:* 4 registros de precios COP vinculados al plan BarberAgency.

### 3.3. Aplicar Permisos y Grants
```bash
psql -h <host_db> -U postgres -d <dbname> -f migrations/20260713_2028_billing_roles_and_grants.sql
```
*   *Verificación:* Confirmar que el usuario común PostgREST (`authenticated`) puede leer las facturas mediante RLS:
    ```sql
    SET ROLE authenticated;
    SELECT * FROM public.billing_invoices;
    -- Debe retornar 0 filas sin dar error de permisos de lectura.
    RESET ROLE;
    ```

---

## Fase 4: Postchecks (Post-validación de Consistencia)

```sql
-- 1. Validar que RLS esté activo y forzado en las nuevas tablas
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename LIKE 'billing_%';

-- 2. Validar inmutabilidad de logs de auditoría (Debe abortar con error)
BEGIN;
INSERT INTO public.billing_audit_logs (actor_type, entity_type, entity_id, action) 
VALUES ('system', 'test', '999', 'insert_test');
UPDATE public.billing_audit_logs SET action = 'hack' WHERE entity_id = '999';
-- Provocará error por trigger.
ROLLBACK;
```

---

## Fase 5: Procedimiento de Rollback de Emergencia (Staging/Pre-producción)

Si ocurre algún error crítico de rendimiento o consistencia durante la ejecución o verificación del despliegue:

1.  **Ejecutar Rollback de Staging:**
    ```bash
    psql -h <host_db> -U postgres -d <dbname> -f migrations/20260713_2027_expand_billing_core_v2_rollback_preproduction.sql
    ```
    *Este script cuenta transaccionalmente los registros. Si las tablas están vacías (pre-producción), las elimina limpiando el esquema core.*
2.  **Ejecutar Rollback de Parche de Planes:**
    ```bash
    psql -h <host_db> -U postgres -d <dbname> -f migrations/20260713_2026_add_plan_codes_rollback.sql
    ```
3.  **Si ocurre bloqueo de locks persistente:**
    *   Identificar procesos bloqueantes y eliminarlos usando `pg_terminate_backend`.
