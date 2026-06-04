# 📋 Reporte de Hallazgos y Sincronización del Core

**Fecha de Análisis:** 04 de Junio, 2026  
**Proyecto:** BarberAgency Core & Panel de Barbería  
**Estado:** Identificación de Conflictos de Sincronización y Persistencia de Datos (Fuente de Verdad)

---

## 🔍 Resumen del Diagnóstico

El análisis de la coordinación de datos con la fuente de verdad en el Core revela un diseño con buenas intenciones, pero expone **conflictos críticos de sincronización e identidad**. La raíz principal del problema es que el sistema carece de una única fuente de verdad limpia: actualmente compiten múltiples orígenes como `barberia_id`, `slug`, `seed`, `localStorage`, `cache` y fallbacks visuales de datos locales.

A continuación se presenta el desglose detallado de los conflictos identificados y las recomendaciones para mitigarlos.

---

## 🛠️ 1. Conflictos Críticos en Core y Base de Datos

### 1.1 El Conflicto en Horarios (Desactivación Rota)
* **Archivo afectado:** [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html)
* **SQL de referencia:** [2026-05-14-hardening-onboarding-publicacion.sql](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/context/db/2026-05-14-hardening-onboarding-publicacion.sql) (línea 253)

> [!WARNING]
> **El Problema:** La función RPC `ba_sync_registro_horarios` marca un día como inactivo (`activo = false`) únicamente si el día viene explícitamente en el payload y configurado como `activo = false`. 
>
> Sin embargo, el frontend filtra la lista enviando solo los días activos:
> ```javascript
> const activeHours = Array.isArray(horarios) ? horarios.filter((item) => item.activo) : [];
> ```
> 
> **Consecuencia:** Si un usuario desmarca un día en la interfaz (por ejemplo, decide cerrar los martes), ese día es filtrado y no se envía. Como la base de datos no recibe ese día en el bucle SQL, lo ignora y el día permanece activo en la base de datos indefinidamente.

* **Solución:** Modificar el frontend para enviar el arreglo completo de 7 días (incluyendo los que tienen `activo: false`), permitiendo que el bloque SQL procese la desactivación a través del `ON CONFLICT DO UPDATE`:
  ```javascript
  // CORRECCIÓN: Enviar la lista completa en lugar de filtrar activeHours
  p_horarios: horarios
  ```

### 1.2 Conciliación de Servicios y Barberos
* **Proceso:** RPC `ba_sync_publicacion_collections`

> [!IMPORTANT]
> **Funcionamiento:** La RPC realiza una conciliación lógica: actualiza los servicios/barberos del payload y desactiva lógicamente (`activo = false`) los ausentes para no borrar registros históricos necesarios para reportes.
> 
> **El Conflicto:** Si se desactiva un barbero o servicio en el formulario de registro, pero existen citas activas agendadas en el futuro asociadas a ellos, se crea un estado inconsistente en el calendario si no se bloquea la acción o no se notifica al administrador para reasignarlas.

### 1.3 Conflicto de Doble Vía de Escritura (Frontend vs. n8n)
* **Archivo afectado:** [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html)
* **Documentación relacionada:** [02-06-26.md](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/ContextoGeneral/daily/Semana01-07-Junio/02-06-26.md)

> [!WARNING]
> **El Problema:** Se determinó que el frontend debe evitar la doble escritura directa a PostgREST/RPC y depender de n8n para la escritura canónica. No obstante, persiste la bandera de contingencia:
> ```javascript
> if (ALLOW_LOCAL_SEED_FALLBACK && isEditIntent() && isPostgrestPermissionError(error)) {
>    // Permite usar semillas locales si falla el webhook
> }
> ```
> 
> **Consecuencia:** Si el webhook de n8n falla parcialmente pero el fallback local escribe a través de PostgREST, se producen escrituras parciales o registros huérfanos (por ejemplo, barbería guardada pero sin accesos de usuario).

### 1.4 Desincronización de Caché Local (Stale Data)
* **Proceso:** Inicialización del formulario en el Core con la función `loadInitialDraft()`

> [!NOTE]
> **El Problema:** La función mezcla los datos del servidor (`fromSeed`) con el borrador local de `localStorage` (`saved`).
> 
> **El Conflicto:** Si el usuario edita la configuración desde el Dashboard de Next.js (actualizando la base de datos) y luego vuelve al formulario en WordPress, la página carga el borrador antiguo (`saved`) de `localStorage`. Al enviar el formulario, los datos desactualizados en caché sobrescriben los datos reales de la base de datos.

---

## 🆔 2. Conflictos de Identidad y Caché en el Panel de Barbería

### 2.1 Priorización Incorrecta de Semilla sobre la URL
* **Archivo afectado:** [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html) (línea 1590)

> [!WARNING]
> La identidad se compone desde múltiples fuentes (`seedLandingData`, query params, `window.BA_*`, `localStorage`). El editor prioriza `seedLandingData?.slug` y `seedLandingData?.barberia_id` antes que los parámetros explícitos de la URL. Si se abre el editor con parámetros específicos pero existe una semilla vieja en storage, se pueden mezclar IDs de una barbería con slugs de otra.

### 2.2 Contaminación de LocalStorage
* **Archivos afectados:** [barbershop-context.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/barbershop-context.ts) (línea 4) y el Core.

> [!NOTE]
> Tanto el Core como el Dashboard comparten las mismas llaves en `localStorage`: `ba_barberia_id`, `ba_barberia_slug`, y `ba_landing_seed`. Al navegar entre flujos, el Dashboard puede tomar una identidad vieja dejada por el registro o el editor, provocando la hidratación de datos erróneos.

### 2.3 Falta de Autoridad en session/me
* **Archivo afectado:** [barbershop-context.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/barbershop-context.ts) (línea 91)

> [!IMPORTANT]
> El Dashboard define la prioridad de identidad en este orden: **URL ➡️ storage ➡️ seed ➡️ env test fallback**. Sin embargo, la regla general establece que la barbería real debe determinarse por la sesión del backend (`session/me`). La ausencia de esta validación como autoridad máxima rompe el principio de multi-tenancy.

### 2.4 Prioridad Peligrosa de Slug sobre ID
* **Archivo afectado:** [dashboard-api.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/dashboard-api.ts) (línea 122)

> [!WARNING]
> La función `buildIdentityQuery()` envía prioritariamente el `slug` y solo usa `barberia_id` como fallback. Si la URL tiene un `barberia_id` válido pero un `slug` antiguo, se hidratará el panel con los datos correspondientes al slug obsoleto, comprometiendo la seguridad entre tenants.

### 2.5 Fallbacks con Datos Ficticios (Mockups)
* **Archivo afectado:** [dashboard-api.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/dashboard-api.ts) (línea 222)

> [!CAUTION]
> Si falla la llamada a `dashboard/state`, el sistema consulta las tablas directamente por PostgREST. Si no encuentra barberos, genera datos artificiales (p. ej., "Alex M.", "James V.") en el frontend. Esto oculta fallos reales de permisos o de base de datos y rompe la regla de **"no datos inventados"**.

### 2.6 Ocultación de Errores con Caché Local
* **Archivo afectado:** [dashboard-context.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/store/dashboard-context.tsx) (línea 257)

> [!NOTE]
> Si la carga remota falla, el Dashboard recurre a la caché del storage y ejecuta `setError(null)`. Para el usuario, el panel parece funcional y sin problemas, pero en realidad podría estar visualizando información obsoleta.

### 2.7 Escalada de Permisos por Defecto
* **Archivo afectado:** [dashboard-access.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/lib/dashboard-access.ts) (línea 80)

> [!CAUTION]
> Si no se detecta un rol válido en el estado del usuario, el sistema devuelve `"admin"` por defecto. Además, si no hay un usuario identificado, toma `rawState?.identity?.barberia_id` como `userId`. Esto es un fallo de seguridad crítico en entornos multi-tenant.

### 2.8 Plantillas Públicas priorizan el Slug
* **Archivo afectado:** [index_unico_v5_1_azul_rojo_elegante.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html) (línea 2437)

> [!NOTE]
> La plantilla pública consulta por `slug` si está disponible, y si no, usa `barberia_id`. Al igual que en el Dashboard, esto produce hidrataciones incorrectas en landings públicas si se recibe una combinación desactualizada.

---

## 💾 3. Hallazgos Críticos de Persistencia

> [!IMPORTANT]
> **Hallazgo Mayor:** El módulo de Citas y la administración de Servicios están funcionando de manera aislada en el estado local de la aplicación, sin persistencia directa en la base de datos PostgreSQL.

### 3.1 Citas en LocalStorage
* **Archivo afectado:** [src/app/citas/page.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/citas/page.tsx)

* **Problema:** Al registrar o editar una cita, la aplicación ejecuta `setRequests(...)` y persiste únicamente en `localStorage` usando la llave `ba_dashboard_reservas`. No existe ninguna llamada a PostgREST, RPC ni webhook de n8n para guardarlas en la tabla `public.citas`.

### 3.2 Mezcla de Reservas Fantasma
* **Archivo afectado:** [dashboard-editor.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/components/dashboard-editor.tsx)

* **Problema:** La vista del editor lee los registros de citas guardados en la caché local (`localStorage`) y, si `merged.appointments` trae datos del servidor, mezcla ambos. Esto genera citas "fantasma" que el usuario visualiza en pantalla pero que no existen físicamente en la base de datos PostgreSQL.

### 3.3 Servicios no Persistidos
* **Archivo afectado:** [src/app/servicios/page.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/servicios/page.tsx)

* **Problema:** Lee del estado unificado `merged.services`, pero los botones para crear, editar o eliminar servicios no ejecutan ninguna mutación remota. Son puramente interactivos en el frontend.

---

## 🎯 4. Plan de Acción y Recomendaciones

Para blindar la arquitectura y asegurar que PostgreSQL sea la única fuente de verdad real (`barberias`, `servicios`, `barberos`, `horarios`, `clientes_finales`, `citas`, `pagos`), se deben priorizar las siguientes acciones:

1. **Jerarquía Única de Identidad:**
   * La sesión autenticada (`session/me` en el backend) debe ser la autoridad de identidad máxima, seguida por la consulta directa a base de datos.
   * Evitar el uso de `localStorage` o `cache` local como fuentes autoritativas; solo deben servir como cachés de lectura temporal con expiración.
2. **Corrección de Horarios:**
   * Remover el `.filter((item) => item.activo)` en el frontend del core ([registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html)) para enviar siempre los 7 días completos al backend.
3. **Validación Cruzada ID-Slug:**
   * En el Dashboard y el editor de landing, si se reciben tanto `barberia_id` como `slug`, validar que correspondan al mismo registro antes de hidratar los datos. Si no coinciden, invalidar el caché.
4. **Remoción de Fallbacks Artificiales:**
   * Eliminar la creación de barberos artificiales en producción si la base de datos retorna vacío.
   * Mostrar mensajes de error claros en lugar de cargar datos antiguos ocultando el error.
5. **Persistencia Directa de Citas y Servicios:**
   * Conectar las acciones de creación/edición en [src/app/citas/page.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/citas/page.tsx) y [src/app/servicios/page.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/_work_panel_de_barberia/src/app/servicios/page.tsx) con la API REST de Supabase/PostgREST o el webhook de n8n para asegurar almacenamiento en PostgreSQL.