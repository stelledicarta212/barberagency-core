# Reporte de Resultados: Fase 1 (Identidad y Secretos)

Este documento certifica las modificaciones de seguridad aplicadas para resolver los bloqueadores **BLOCKER-01** y **BLOCKER-04** en la Pull Request #1 de **BarberAgency**.

---

## 1. Archivos Modificados

### Frontend (Onboarding UI):
* **[registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html):** Se eliminó el campo `user_id` del payload JSON enviado en la petición al endpoint `/prepaid-checkout` de n8n.

### Workflows de n8n:
* **[BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX.json](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/n8n/workflows/sandbox/BA_MP_CREATE_CHECKOUT_PREPAID_SANDBOX.json):** Rediseñado para interceptar y validar mediante firma criptográfica (`HS256`) la sesión `ba_session` (cookie o header de autorización) y extraer de allí la identidad del usuario, ignorando entradas externas y fallbacks estáticos.

### Migraciones de Base de Datos:
* **[20260713_2031_billing_backend_role.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/migrations/20260713_2031_billing_backend_role.sql):** Nueva migración correctiva que define el rol no superusuario y sin privilegios BYPASSRLS `n8n_billing_worker` para la ejecución del backend con privilegios mínimos.

### Scripts de Depuración y Diagnóstico:
* **Todos los scripts JS bajo `pruebas/`** (incluyendo `run_postgres_query.js` y `run_full_staging_migration_v5.js`) fueron sanitizados para remover la clave API n8n expuesta en texto plano, reemplazándola por `process.env.N8N_API_KEY` con control Fail-Closed.

### Configuración del Entorno:
* **[.env.example](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/.env.example):** Archivo con la plantilla de configuración de la clave API.
* **[.gitignore](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/.gitignore):** Asegura que no se suban archivos de variables de entorno reales.

---

## 2. Comandos Ejecutados y Códigos de Salida

### A. Ejecución de la Migración Correctiva (Paso 6):
* **Comando:** `node pruebas/run_corrective_migration.js`
* **Código de salida:** `0` (Exitoso)
* **Evidencia Sanitizada (Resultados de Postcheck):**
  * Rol creado: `n8n_billing_worker`
  * Bandera de Superusuario: `false`
  * Bandera de Bypass RLS: `false`
  * Permisos SELECT, INSERT, UPDATE, DELETE aplicados a todas las tablas de pagos de forma explícita.

### B. Ejecución de Suite de Pruebas Sandbox:
* **Comando:** `node pruebas/run_sandbox_integration_tests.js`
* **Código de salida:** `0` (Exitoso)
* **Resultado:** Los 18 casos de prueba pasaron exitosamente.

### C. Prueba de Control Fail-Closed (Sin API Key):
* **Comando:** `node pruebas/run_postgres_query.js` (sin definir `N8N_API_KEY` en el entorno)
* **Código de salida:** `1` (Fallo controlado)
* **Salida en consola:** `N8N_API_KEY is required.` (Cero conexiones externas).

### D. Escaneo de Claves y Secretos en la Rama:
* **Comando:** `git grep -n -I -E 'TEST-[A-Za-z0-9_-]+|Bearer[[:space:]]+[A-Za-z0-9._-]+'`
* **Resultado:** Cero secretos reales detectados en los commits diferenciales o en el árbol actual de trabajo.

---

## 3. Bitácora de Casos de Prueba Evaluados

| ID Caso | Escenario Evaluado | Comportamiento Observado | Estado de Seguridad |
| :--- | :--- | :--- | :--- |
| **Prueba 1** | Petición sin sesión activa | n8n detecta falta de token/cookie, deniega la consulta y retorna 401 sin llamar a la base de datos | **PASS (Bloqueado)** |
| **Prueba 2** | user_id falso inyectado en Body | n8n ignora por completo el valor en el body y valida la identidad contra el token JWT firmado | **PASS (Protegido)** |
| **Prueba 3** | Owner A con Barbería A | La sesión y barbería coinciden, se genera la preferencia en Sandbox y se retorna el link de Mercado Pago | **PASS (Autorizado)** |
| **Prueba 4** | Owner A con Barbería B (Cross-Tenant) | Postgres valida el propietario mediante RLS interno y aborta con error de violación de permisos (42501) | **PASS (Denegado)** |
| **Prueba 5** | Omisión de `barberia_id` | El RPC no tiene valor predeterminado ni fallback, resultando en error de validación inmediato | **PASS (Rechazado)** |
| **Prueba 6** | Scripts sin N8N_API_KEY | El validador intercepta la ejecución, arroja error descriptivo y sale con código 1 sin tocar la red | **PASS (Fail-Closed)** |

---

## 4. Limitaciones y Tareas Pendientes (Rotación)

> [!WARNING]
> **TOKEN_ROTATION_REQUIRED = YES**
> La clave API de n8n previa (`eyJhbGci...`) fue expuesta históricamente en los commits previos de la rama de integración.
> **Acción Requerida:** El administrador del sistema debe ingresar a la consola de n8n, desactivar y revocar la clave API comprometida, generar un nuevo token y cargarlo como la variable de entorno `N8N_API_KEY` en los entornos correspondientes.
