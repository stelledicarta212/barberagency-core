# Reporte de Auditoría: Limpieza Legacy, Secretos y Superficie de Riesgo - Bloque 9
**Fecha:** 2026-06-10  
**Decisión recomendada:** **GO CON RESERVAS**

Este reporte detalla los resultados de la auditoría técnica y de seguridad realizada en BarberAgency sobre código legacy, secretos expuestos, variables de entorno, dependencias de almacenamiento local y superficies de riesgo operativo.

---

## 1. Resumen Ejecutivo

La auditoría concluye con una decisión de **GO CON RESERVAS**. 
No se detectaron secretos críticos de producción expuestos en los repositorios, y el blindaje multi-tenant implementado en los bloques anteriores (incluyendo el proxy POS y la erradicación de `eval`) se encuentra sólido. 
Sin embargo, se identificaron hallazgos clasificados como **P1** referentes a la exposición de endpoints directos de n8n en el cliente y llamadas de recuperación de contraseña desde el navegador que deben ser mitigados en un bloque de remediación posterior.

---

## 2. Repositorios y Archivos Revisados

Se auditaron los siguientes repositorios:
1. **`panel_de_barberia`** (Next.js Dashboard - Rama `principal`)
2. **`barberagency-core`** (Arquitectura y Documentación - Rama `main`)

### Archivos clave inspeccionados:
* `src/lib/env.ts` (Variables y fallbacks de entorno)
* `src/lib/dashboard-api.ts` (Cliente de API privada)
* `src/lib/public-rpc.ts` (Mapeador de RPC pública)
* `src/app/api/auth/login/route.ts` (Ruta deprecated)
* `src/app/api/session/me/route.ts` (Proxy de identidad)
* `src/app/api/dashboard/state/route.ts` (Proxy de lectura dashboard)
* `src/app/api/editor/auth.ts` (Helpers de validación de edición)
* `src/store/dashboard-context.tsx` (Proveedor de estado privado)
* `.gitignore` y `.dockerignore` (Políticas de exclusión de compilación)

---

## 3. Matriz de Hallazgos (P0 / P1 / P2)

| ID | Clasificación | Hallazgo | Ubicación / Archivo | Riesgo Real | Recomendación de Fix |
|----|---------------|----------|---------------------|-------------|----------------------|
| **H1.1** | **P1** | **Exposición de URLs directas de webhooks n8n:** `env.ts` declara fallbacks con las URLs completas del host de n8n para inicio de sesión, cobro POS y recuperación de contraseña. | `src/lib/env.ts` | Exposición de la topología interna y URLs de n8n en el bundle distribuido al cliente. | Mover los fallbacks y endpoints de n8n al lado del servidor (server-only) y ocultar la configuración del navegador. |
| **H1.2** | **P1** | **Llamada de webhook n8n directa desde el navegador:** La recuperación de contraseña llama a n8n mediante `fetch` directamente desde el navegador del cliente. | `src/lib/dashboard-api.ts#L200-L226` | Permite llamadas directas CORS a n8n desde el cliente y expone la estructura de datos del webhook. | Crear proxies same-origin en Next.js (ej. `/api/auth/recover/request` y `/api/auth/recover/reset`) para encapsular las llamadas a n8n del lado del servidor. |
| **H2.1** | **P2** | **Funciones/RPCs obsoletas en DB:** Existen RPCs en PostgreSQL que fueron reemplazadas por las llamadas canónicas de Next.js a n8n y ya no se utilizan en la arquitectura. | `app/database/schema/bdmaster.md` | Deuda técnica e incremento menor de la superficie de ataque potencial en PostgreSQL. | Eliminar o deprecar mediante script las funciones `ba_sync_registro_collections`, `ba_sync_registro_horarios`, `ba_publicar_barberia` y `ba_publicar_landing_completa`. |

---

## 4. Respuestas a Preguntas de Auditoría Obligatorias

1. **¿Quedan secretos o URLs sensibles expuestas en cliente?**
   * **Secretos:** No se encontraron API Keys, tokens de producción ni contraseñas.
   * **URLs Sensibles:** Sí, las URLs de los webhooks de n8n están expuestas en `src/lib/env.ts` como fallbacks.
2. **¿Quedan variables `NEXT_PUBLIC_*` que no deberían ser públicas?**
   * Sí. Las variables `NEXT_PUBLIC_POS_SALE_ENDPOINT`, `NEXT_PUBLIC_DASHBOARD_LOGIN_ENDPOINT`, `NEXT_PUBLIC_DASHBOARD_RECOVER_REQUEST_ENDPOINT` y `NEXT_PUBLIC_DASHBOARD_RECOVER_RESET_ENDPOINT` son accesibles en el navegador y deben ser transformadas a variables privadas del servidor.
3. **¿Quedan webhooks n8n llamados desde navegador?**
   * Sí, los flujos de recuperación de contraseña (`recoverPasswordRequest` y `recoverPasswordReset`) se llaman directamente a n8n desde el navegador.
4. **¿Quedan llamadas directas cliente a PostgREST/RPC?**
   * No en el área privada. En la landing pública y el QR se usan RPCs de PostgREST, pero se ejecutan del lado del servidor de Next.js (Server Components / API Routes).
5. **¿Quedan endpoints duplicados o legacy activos?**
   * No. El endpoint `/api/auth/login` fue correctamente deprecado y devuelve `410 Gone`.
6. **¿Quedan rutas deprecated que deberían devolver 410?**
   * Sí, `/api/auth/login` ya está configurado para devolver `410`.
7. **¿Quedan mocks/fallbacks productivos?**
   * No. La carga fallida de dashboard/state muestra un error real ("No se pudo cargar la fuente de verdad") y vacía los datos locales.
8. **¿Queda localStorage/sessionStorage como autoridad?**
   * No. Solo actúa como caché temporal de conveniencia para la UI, pero la sesión real se verifica obligatoriamente en el montaje llamando a `/api/session/me`.
9. **¿Quedan archivos de build/cache versionados?**
   * No. Se removió exitosamente `tsconfig.tsbuildinfo` de Git y se agregaron las exclusiones a `.gitignore` y `.dockerignore`.
10. **¿Quedan backups con datos sensibles?**
    * No. Los backups de n8n encontrados en `barberagency-core` contienen lógica pura y esquemas SQL sin credenciales.
11. **¿Quedan tokens/API keys/passwords hardcodeados?**
    * No.
12. **¿Quedan endpoints que aceptan `barberia_id` sin validar tenant?**
    * No. Todos los proxies same-origin validan `ba_session` y la pertenencia del tenant antes de proceder.
13. **¿Queda algún flujo que use `email_contacto` como autorización?**
    * No.
14. **¿Queda algún flujo que use `slug` como autoridad privada?**
    * No. El slug solo valida concordancia pero no otorga permisos.
15. **¿Queda algún uso de `eval` o `Function`?**
    * No. `eval` fue reemplazado por la función parser aritmética segura `safeEvaluate`.
16. **¿Queda algún endpoint de escritura no canónico?**
    * No. Todas las escrituras privadas pasan por los proxies del backend.
17. **¿Qué debe eliminarse, deprecarse o moverse a server-only?**
    * Mover las variables directas de n8n a server-only, encapsular las llamadas de recuperación en proxies del servidor y limpiar las RPCs legacy de PostgreSQL.

---

## 5. Pruebas Obligatorias de Validación

1. **Build independiente:** Confirmado. `npm run build` compila al 100% exitosamente tras limpiar `.next` y `tsconfig.tsbuildinfo`.
2. **Políticas de exclusión:** `.gitignore` y `.dockerignore` excluyen correctamente la caché de compilación, módulos de node y variables locales de entorno.
3. **Muted Examples:** `.env.local.example` contiene únicamente valores descriptivos y no expone secretos reales de producción.
4. **Resistencia de rutas deprecadas:** `/api/auth/login` responde con HTTP `410` en todas sus peticiones.

---

## 6. Recomendación de Implementación Controlada (Próximo Bloque)

Para corregir los riesgos **P1** detectados:
1. **Crear proxies de recuperación de contraseña:**
   * Crear el archivo `src/app/api/auth/recover/request/route.ts` que reciba la petición same-origin y la delegue a n8n del lado del servidor.
   * Crear el archivo `src/app/api/auth/recover/reset/route.ts` con el mismo propósito.
2. **Refactorizar `src/lib/dashboard-api.ts`:**
   * Cambiar las llamadas de recuperación de contraseña para que apunten a `/api/auth/recover/request` y `/api/auth/recover/reset`.
3. **Limpiar `src/lib/env.ts`:**
   * Remover del lado del cliente los fallbacks completos de n8n y configurar variables no públicas en el servidor de Next.js.
