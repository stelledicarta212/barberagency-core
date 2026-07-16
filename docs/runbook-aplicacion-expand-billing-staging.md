# Runbook de Aplicación en Staging - Módulo de Facturación SaaS

Este manual describe el orden de operaciones y comandos concretos para ejecutar el despliegue del módulo de facturación de **BarberAgency** en el entorno de **Staging / Pruebas**.

---

## 1. Fase de Preparación y Backup

### 1.1. Ejecutar Respaldo Lógico de Datos
Antes de aplicar cualquier script SQL, se debe generar un backup de pre-despliegue mediante la consola de PostgreSQL:
```bash
pg_dump -h <host_staging> -U postgres -d barberagency_staging -F c -b -v -f /tmp/staging_pre_billing_$(date +%Y%m%d_%H%M%S).dump
```

### 1.2. Prueba de Restauración Obligatoria
Garantizar la recuperabilidad del sistema antes del despliegue:
1.  Crear base de datos temporal:
    ```bash
    createdb -h localhost -U postgres db_restore_verification
    ```
2.  Restaurar el dump:
    ```bash
    pg_restore -h localhost -U postgres -d db_restore_verification -v /tmp/staging_pre_billing_*.dump
    ```
3.  Comprobar integridad:
    ```sql
    SELECT COUNT(*) FROM public.barberias;
    ```

---

## 2. Secuencia de Aplicación SQL (Orden de Ejecución)

Ejecutar secuencialmente los scripts SQL utilizando la herramienta de línea de comandos `psql`. **No omitir ningún paso ni alterar el orden de dependencias.**

### Paso A: Parche de Códigos de Catálogo (`planes.code`)
```bash
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2026_add_plan_codes.sql
```
*   **Postchecks de la Fase A:**
    ```sql
    SELECT id, nombre, code, precio FROM public.planes ORDER BY id;
    ```
    *Verificación:* Debe retornar 3 filas (Starter -> `starter`, Pro -> `pro_legacy`, BarberAgency -> `barberagency_full`).

### Paso B: Core de Cobros V2 y Estructuras Core
```bash
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2027_expand_billing_core_v2.sql
```
*   **Postchecks de la Fase B:**
    ```sql
    SELECT name, amount, currency, active FROM public.plan_prices WHERE active = true;
    ```
    *Verificación:* Debe mostrar los 4 precios COP asociados de forma idempotente al plan `barberagency_full`.

### Paso C: Permisos Físicos de Inquilino y Roles
```bash
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2028_billing_roles_and_grants.sql
```
*   **Postchecks de la Fase C:** Confirmar que los permisos a `PUBLIC` se revocaron y se otorgaron los privilegios a `anon` y `authenticated`.

### Paso D: RPC Transaccionales Core
```bash
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2029_billing_rpc_core.sql
```
*   **Postchecks de la RPC:**
    ```sql
    SELECT routine_name, security_type 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name LIKE 'billing_%';
    ```
    *Verificación:* Debe listar las 3 funciones creadas (`billing_create_checkout`, `billing_register_webhook`, `billing_process_approved_payment`).

---

## 3. Plan de Pruebas Lógicas Inmediatas

1.  **Validación de RLS (Propietarios):** Ejecutar la matriz de pruebas de inquilinos detallada en el archivo `matriz-pruebas-rls-billing.md`.
2.  **Pruebas de Regresión:** Realizar las verificaciones de flujo tradicionales según el checklist `checklist-regresion-expand-billing.md`.

---

## 4. Plan de Rollback (Reversión ante Fallas)

Si ocurre algún error en las pre/post-validaciones lógicas o fallas en la regresión del panel de barbería:

### Opción 1: Reversión Rápida en Staging (Tablas Vacías)
Si aún no se han procesado cobros de Sandbox (tablas financieras vacías):
```bash
# Revertir RPCs
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2029_billing_rpc_core_rollback.sql

# Revertir Core de Cobros V2 (Valida transaccionalmente que no haya datos)
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2027_expand_billing_core_v2_rollback_preproduction.sql

# Revertir Parche de Códigos de Catálogo
psql -h <host_staging> -U postgres -d barberagency_staging -f migrations/20260713_2026_add_plan_codes_rollback.sql
```

### Opción 2: Reversión de Emergencia en Producción (Rollback Físico Completo)
Si el error ocurre tras aplicar las tablas y es necesario regresar al snapshot limpio:
1.  Terminar conexiones activas.
2.  Restaurar el snapshot tomado en el Paso 1.1.
