# Auditoría de Integración Continua (CI) y Validación Automática — Bloque 10
**Fecha:** 2026-06-10  
**Estado / Decisión:** **GO CON RESERVAS (Requiere Remediación Controlada de CI y Guardrails)**

---

## 1. Resumen Ejecutivo
Esta auditoría tiene como objetivo evaluar si la infraestructura actual de BarberAgency cuenta con mecanismos automáticos suficientes (CI, scripts, suites de prueba) para prevenir regresiones en la Fuente de Verdad, la seguridad multi-tenant y la inyección segura de secretos. 

La conclusión principal es que **el proyecto carece actualmente de cualquier pipeline de integración continua (CI) y de suites de testing automatizado**. El build, lint y typecheck se ejecutan de manera manual, y no existen guardrails para impedir la subida de secretos expuestos o llamadas directas a webhooks de n8n desde el frontend. Adicionalmente, las API routes de Next.js poseen fallbacks hardcodeados a URLs de n8n de desarrollo, lo cual representa un riesgo de regresión silenciosa.

Se recomienda **GO CON RESERVAS** y se detalla una propuesta de implementación mínima para subsanar los hallazgos P1 antes de proceder con el cierre total del P0.

---

## 2. Repositorios Revisados
* **[`barberagency-core`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core):** Contiene la lógica de base de datos, RLS, documentación central y bitácoras del SaaS.
* **[`panel_de_barberia`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia):** Repositorio del Dashboard administrativo en Next.js (mapeado localmente en la subcarpeta `_work_panel_de_barberia`).

---

## 3. Scripts y Workflows Existentes

### 3.1 Scripts en `panel_de_barberia` ([`package.json`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/package.json)):
* `"dev": "next dev"` (Servidor de desarrollo)
* `"build": "next build"` (Compilación de producción)
* `"start": "next start"` (Inicio del bundle compilado)
* `"lint": "eslint ."` (Validación de reglas de estilo)
* *Observación:* **No existen comandos de prueba** (`npm test`, `npm run test`, `e2e` o similares) ni dependencias de frameworks de test (Vitest, Jest, Playwright).

### 3.2 Scripts en `barberagency-core` ([`package.json`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/package.json)):
* `"test": "echo \"Error: no test specified\" && exit 1"` (Marcador de posición por defecto)

### 3.3 Workflows de CI en GitHub Actions
* **Ausentes por completo.** No existe el directorio `.github/workflows` ni archivos `.yml` de configuración en ninguno de los dos repositorios.

---

## 4. Pruebas y Compilación Ejecutadas en la Auditoría
Durante esta auditoría se ejecutaron de manera local en el entorno del repositorio los siguientes chequeos obligatorios:

1. **TypeScript (`npx tsc --noEmit`):**
   * **Resultado:** exitoso con **0 errores**.
2. **ESLint (`npm run lint`):**
   * **Resultado:** exitoso con **0 errores** y 15 warnings (relacionados principalmente con el uso de la etiqueta nativa `<img>` en lugar del componente `<Image />` de Next.js y variables no usadas menores).
3. **Next.js Build (`npm run build`):**
   * **Resultado:** exitoso. Compiló de manera limpia todas las rutas estáticas y dinámicas en 3.4 segundos.

---

## 5. Matriz de Guardrails de Seguridad

### 5.1 Guardrails Existentes
* **Exclusión de archivos temporales:** El archivo [.gitignore](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/.gitignore) y [.dockerignore](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/.dockerignore) excluyen correctamente `.next`, `tsconfig.tsbuildinfo` y `.env.local` tras las correcciones aplicadas en el Bloque 8.
* **Validaciones manuales:** Se dispone de colecciones Postman como [`postman-registro-sync-qa.postman_collection.json`](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/context/backend/postman-registro-sync-qa.postman_collection.json) y scripts de verificación HTTP ([run_bloque9_production_validation.js](file:///C:/Users/calvi/.gemini/antigravity-cli/brain/41beed8f-85de-4915-9f96-cd94d98649ee/scratch/run_bloque9_production_validation.js)), pero dependen de ejecución y control manual.

### 5.2 Guardrails Faltantes
* **Falta de CI Automatizado:** No se ejecutan `lint`, `tsc` ni `build` automáticamente al hacer Push o Pull Request a las ramas `main` o `principal`.
* **Falta de escáner contra fugas de webhooks/secretos:** No existe ningún validador estático (como un script de pre-commit o test en CI) que analice el bundle del cliente para detectar si se vuelve a hardcodear la URL de n8n o a filtrar variables privadas mediante `NEXT_PUBLIC_*`.
* **Falta de pruebas de regresión multi-tenant:** No hay tests automáticos integrados en la suite que verifiquen que llamadas sin cookies a endpoints de escritura (`/api/pos`, `/api/configuracion/update`) o lecturas de tenant ajeno en `/api/dashboard/state` devuelvan estados controlados (`401` / `403`).

---

## 6. Riesgos Clasificados

### Riesgos P1:
1. **Falta de pipeline de CI (Integración Continua):** No hay automatización de calidad de código. Código con errores de compilación, sintaxis o linter puede ser empujado a producción directamente.
2. **Ausencia de Guardrails de Secretos en el Frontend:** Riesgo de volver a exponer webhooks directos de n8n (`barberagency-n8n.gymh5g.easypanel.host`) o inyectar secretos en el bundle de React sin alertas tempranas que lo bloqueen.
3. **Ausencia de Tests de Seguridad Automatizados:** No se verifica programáticamente que endpoints sensibles como `/api/pos` (POS) o `/api/configuracion/update` (Configuración) no sufran regresiones y permitan escrituras no autorizadas o sin cookies.

### Riesgos P2:
1. **Lógica de fallbacks silenciosa en API routes (Riesgo Técnico):**
   Las rutas del servidor Next.js tienen fallbacks hardcodeados en sus declaraciones:
   * [src/app/api/session/login/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/session/login/route.ts#L3-L6):
     ```typescript
     const DASHBOARD_LOGIN_ENDPOINT =
       process.env.DASHBOARD_LOGIN_ENDPOINT ??
       process.env.NEXT_PUBLIC_DASHBOARD_LOGIN_ENDPOINT ??
       "https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/dashboard/login";
     ```
   * Si en producción se omite por error la variable privada `DASHBOARD_LOGIN_ENDPOINT`, el servidor derivará de forma silenciosa el tráfico hacia el webhook público/desarrollo de n8n, exponiendo datos y fallando de forma opaca.
2. **Duplicación y desactualización de variables en Dockerfile:** El [Dockerfile](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/Dockerfile) contiene declaraciones `ENV` estáticas de endpoints que ya fueron deprecados en el código (como `NEXT_PUBLIC_DASHBOARD_STATE_ENDPOINT`). Esto añade confusión y ruido en el mantenimiento del contenedor.

---

## 7. Recomendación de Implementación Controlada (Fixes del Bloque 10)

Para cerrar de forma segura el Bloque 10 y concluir el plan P0, es necesario implementar de forma controlada los siguientes cambios mínimos:

### Paso 1: Configurar GitHub Actions (Integración Continua)
Crear el pipeline de CI en el panel Next.js para ejecutar lint, typecheck y compilación en cada PR/Push.

### Paso 2: Implementar suite de testing de seguridad automatizada
Instalar Vitest o Jest en `panel_de_barberia` y crear una prueba estática automatizada que analice el código fuente y el bundle compilado buscando:
- Presencia del dominio hardcodeado de n8n (`barberagency-n8n.gymh5g.easypanel.host`).
- Declaración de variables `NEXT_PUBLIC_DASHBOARD_*` o similares asociadas a recuperación/POS.

### Paso 3: Erradicar fallbacks silenciosos en API routes
Reemplazar todos los fallbacks de URL hardcodeadas por excepciones HTTP 500 controladas de configuración. Si la variable de entorno privada del servidor (ej. `DASHBOARD_LOGIN_ENDPOINT` o `CONFIG_UPDATE_ENDPOINT`) no está inyectada en el entorno, el route handler debe fallar explícitamente y retornar un error controlado, en lugar de intentar llamar a la URL por defecto de n8n.

---

## 8. Lista de Archivos a Crear / Modificar para el Cierre de Bloque 10

* **Crear:**
  - `_work_panel_de_barberia/.github/workflows/ci.yml` (Pipeline de CI).
  - `_work_panel_de_barberia/tests/security.test.ts` (TestSuite de Vitest/Jest para validaciones estáticas).
* **Modificar:**
  - `_work_panel_de_barberia/package.json` (Agregar Vitest como devDependency y los comandos `npm run test` y `npm run typecheck`).
  - Erradicar las URLs hardcodeadas de n8n y establecer fallos firmes (throw/500) en:
    - [src/app/api/session/login/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/session/login/route.ts)
    - [src/app/api/configuracion/update/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/configuracion/update/route.ts)
    - [src/app/api/dashboard/barberos/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/dashboard/barberos/route.ts)
    - [src/app/api/dashboard/citas/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/dashboard/citas/route.ts)
    - [src/app/api/dashboard/state/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/dashboard/state/route.ts)
    - [src/app/api/editor/draft/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/editor/draft/route.ts)
    - [src/app/api/editor/publish/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/editor/publish/route.ts)
    - [src/app/api/pos/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/pos/route.ts)
    - [src/app/api/session/me/route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/session/me/route.ts)
    - [src/app/api/editor/auth.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/api/editor/auth.ts)
  - Limpiar variables obsoletas en:
    - [Dockerfile](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/Dockerfile)
