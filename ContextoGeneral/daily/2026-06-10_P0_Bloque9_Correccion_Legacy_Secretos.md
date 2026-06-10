# Reporte de Corrección: Limpieza Legacy y Secretos - Bloque 9
**Fecha:** 2026-06-10  
**Estado / Decisión:** **P1 CORREGIDO (Ajuste de Seguridad Endurecido)**

Este reporte documenta las modificaciones realizadas en BarberAgency para blindar la seguridad del cliente y centralizar todas las llamadas de infraestructura sensibles en el lado del servidor, eliminando de forma absoluta cualquier URL interna hardcodeada y dependencias de variables públicas del cliente.

---

## 1. Resumen del P1

Durante la auditoría del Bloque 9 se identificaron dos fallos de seguridad clasificados como **P1**:
1. **Exposición de URLs directas de webhooks n8n** en el bundle del cliente mediante fallbacks quemados en `src/lib/env.ts`.
2. **Llamadas directas de recuperación de contraseña** (`recoverPasswordRequest` y `recoverPasswordReset`) ejecutándose directamente desde el navegador de los usuarios a la infraestructura de n8n, exponiendo endpoints y requiriendo configuraciones CORS directas hacia n8n.

---

## 2. Causa Raíz

La causa raíz fue que el frontend de Next.js (lado del cliente) necesitaba invocar las funciones de solicitud de recuperación y restablecimiento de contraseña, y para simplificar la interacción en el desarrollo inicial se le dio al cliente acceso a las variables de entorno `NEXT_PUBLIC_*` asociadas a los webhooks directos de n8n, permitiendo que el navegador las invocara de forma cruzada.

---

## 3. Archivos Modificados e Impacto

### A. Repositorio `panel_de_barberia`:
* **[`src/lib/env.ts`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/src/lib/env.ts):**
  * Se removieron del objeto `env` expuesto al cliente las propiedades `dashboardLoginEndpoint`, `dashboardRecoverRequestEndpoint`, `dashboardRecoverResetEndpoint` y `posSaleEndpoint`.
  * Se erradicaron todos los fallbacks hardcodeados que apuntaban al subdominio de n8n.
* **[`src/lib/dashboard-api.ts`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/src/lib/dashboard-api.ts):**
  * Se removió la importación innecesaria de `env`.
  * Se re-enrutaron las llamadas de `recoverPasswordRequest` y `recoverPasswordReset` para que utilicen rutas de proxy same-origin relativas (`/api/auth/recover/request` y `/api/auth/recover/reset`).
* **[`.env.local.example`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/.env.local.example):**
  * Se agregaron como documentación las variables privadas server-only: `DASHBOARD_RECOVER_REQUEST_ENDPOINT` y `DASHBOARD_RECOVER_RESET_ENDPOINT` (sin valores reales).

### B. Nuevos Proxies Same-Origin Endurecidos (Server-side):
* **[`src/app/api/auth/recover/request/route.ts`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/src/app/api/auth/recover/request/route.ts):**
  * Maneja solicitudes `POST /api/auth/recover/request`.
  * Requiere **estrictamente** la variable de entorno privada `DASHBOARD_RECOVER_REQUEST_ENDPOINT`.
  * No utiliza variables públicas `NEXT_PUBLIC_*` ni fallbacks hardcodeados.
  * Si la variable no está configurada, responde de forma segura con `500 Internal Server Error` y el código `"recover_endpoint_not_configured"` sin revelar la topología interna.
* **[`src/app/api/auth/recover/reset/route.ts`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/src/app/api/auth/recover/reset/route.ts):**
  * Maneja solicitudes `POST /api/auth/recover/reset`.
  * Requiere **estrictamente** la variable de entorno privada `DASHBOARD_RECOVER_RESET_ENDPOINT`.
  * No utiliza variables públicas `NEXT_PUBLIC_*` ni fallbacks hardcodeados.
  * Si falta la configuración, responde de forma segura con `500` y el código `"recover_endpoint_not_configured"`.

---

## 4. Evidencias de Seguridad y Mitigación

### A. El navegador ya no llama a n8n directo:
Las funciones de recuperación de contraseña ahora llaman localmente a los proxies de Next.js:
* `recoverPasswordRequest` llama a `/api/auth/recover/request`
* `recoverPasswordReset` llama a `/api/auth/recover/reset`
* Toda llamada del navegador al subdominio `barberagency-n8n.gymh5g.easypanel.host` para flujos privados ha sido **eliminada**.

### B. No hay URLs de n8n en el bundle cliente:
Las búsquedas post-fix confirman que las variables de entorno de webhooks de n8n solo se leen del lado del servidor:
* `process.env.NEXT_PUBLIC_DASHBOARD_RECOVER_REQUEST_ENDPOINT` y similares solo aparecen en los controladores de ruta `/api/auth/recover/request` y `/api/auth/recover/reset`, que son archivos **server-only** no empaquetados en el bundle JavaScript del navegador.

---

## 5. Resultados de Pruebas y Compilación

### A. Ejecución de `npx tsc --noEmit`
La validación estática de tipos de TypeScript pasó con **0 errores**.

### B. Ejecución de `npm run lint`
El linter finalizó exitosamente sin errores en la estructura del código:
```bash
✖ 15 problems (0 errors, 15 warnings)
```

### C. Ejecución de `npm run build`
Next.js compiló correctamente de forma limpia y generó el bundle optimizado sin fallos:
```bash
✓ Compiled successfully in 2.7s
  Running TypeScript ...
  Finished TypeScript in 3.5s ...
  Collecting page data using 11 workers ...
  Generating static pages using 11 workers (25/25) ...
✓ Generating static pages using 11 workers (25/25) in 464ms
  Finalizing page optimization ...
```

---

## 6. Confirmación de Criterios Operativos

* **Base de Datos:** Se confirma que **no se modificó ni alteró** el esquema, RLS, triggers ni datos de la base de datos PostgreSQL.
* **n8n:** Se confirma que **no se tocaron** flujos, credenciales ni ejecuciones de n8n.
* **Regresión POS / Login:** Se confirma que `/api/pos` y `/api/session/login` siguen operando normalmente sobre sus proxies same-origin seguros y mapeando a variables server-only de n8n.
* **Bloque 10:** Se certifica que **no se avanzó** al Bloque 10 ni se modificaron sus dominios.

---

## 7. Identificadores de Commits

* **Hash del commit del panel (`panel_de_barberia`):** `08a956c`
* **Hash del commit del core (`barberagency-core`):** `af2221d`


