# Reporte de Auditoría de Seguridad: Funciones SECURITY DEFINER (Mercado Pago Sandbox)

Este reporte recopila la evidencia del análisis estático y dinámico de seguridad realizado sobre las funciones almacenadas en el esquema `public` de **BarberAgency** que ejecutan bajo el contexto de `SECURITY DEFINER`.

---

## 1. Listado de Funciones Críticas Auditadas

Se realizó una consulta a los catálogos del sistema (`pg_proc`, `pg_namespace`, `pg_description`) para verificar las propiedades de definición de los RPC críticos del módulo de facturación:

| Nombre de la Función | Rol Propietario | SECURITY DEFINER | `search_path` Fijo |
| :--- | :--- | :---: | :---: |
| `billing_create_checkout` | `postgres` | Sí | `public` |
| `billing_register_webhook` | `postgres` | Sí | `public` |
| `billing_process_approved_payment` | `postgres` | No (Invoker) | `public` |

---

## 2. Resultados de las Verificaciones de Seguridad

### A. Fijación de `search_path` (Mitigación de Secuestro de Esquemas)
*   **Requisito:** Cada función `SECURITY DEFINER` debe fijar explícitamente el `search_path` a esquemas seguros (por ejemplo, `public`) para evitar que un usuario malintencionado configure variables de sesión que desvíen la resolución de funciones y operadores hacia esquemas bajo su control.
*   **Evidencia:** Las definiciones SQL de `billing_create_checkout` y `billing_register_webhook` contienen la cláusula `SET search_path = public`. La auditoría de metadatos de Postgres arrojó:
    ```json
    {
      "routine_name": "billing_create_checkout",
      "is_security_definer": true,
      "configuration_parameters": [ "search_path=public" ]
    }
    ```
    *   **Resultado:** **PASADO (HARDENED)**.

### B. Privilegios de Ejecución (`GRANT` / `REVOKE` de `PUBLIC`)
*   **Requisito:** Por defecto, PostgreSQL otorga privilegios de ejecución a `PUBLIC` para cualquier función recién creada. Esto permite que cualquier usuario o rol anónimo invoque la función.
*   **Evidencia:** 
    *   `billing_create_checkout`: Se revocó el acceso de `PUBLIC` y de `anon`. Únicamente se otorgó `EXECUTE` al rol `authenticated` y al superusuario `postgres`.
    *   `billing_register_webhook`: Se revocó el acceso de `PUBLIC`, `anon` y `authenticated`. Únicamente `postgres` (y opcionalmente el rol de backend ingestor) tiene privilegios de ejecución.
    *   `billing_process_approved_payment`: Se revocó de `PUBLIC` y no se expone a PostgREST.
    *   **Resultado:** **PASADO (RESTRICTED)**.

### C. Validación de Identidad del Invocador (`jwt_user_id()`)
*   **Requisito:** `billing_create_checkout` debe verificar que el usuario autenticado que realiza la llamada sea realmente el propietario (`owner_id`) de la barbería para la cual se solicita el checkout, impidiendo ataques de escalamiento horizontal de privilegios (IDOR).
*   **Evidencia:**
    *   El cuerpo de `billing_create_checkout` valida la propiedad mediante:
        ```sql
        SELECT owner_id INTO v_owner_id FROM public.barberias WHERE id = p_barberia_id;
        IF v_owner_id IS NULL OR v_owner_id <> public.jwt_user_id() THEN
          RAISE EXCEPTION 'UNAUTHORIZED: No tiene permiso para esta barbería.' USING ERRCODE = '42501';
        END IF;
        ```
    *   Las pruebas unitarias de RLS confirmaron que si el usuario `99` intenta crear un checkout para la barbería `10` (de propiedad del usuario `10`), el sistema aborta arrojando una excepción `UNAUTHORIZED`.
    *   **Resultado:** **PASADO (SECURE)**.

### D. Ausencia de SQL Dinámico (Prevención de Inyección SQL)
*   **Requisito:** Ninguna de las funciones críticas de facturación o control de webhooks debe usar sentencias `EXECUTE` con cadenas concatenadas de forma dinámica que contengan entradas del cliente.
*   **Evidencia:** Todas las consultas SQL en los RPC son sentencias estáticas parametrizadas nativamente por PL/pgSQL.
*   **Resultado:** **PASADO (SAFE)**.
