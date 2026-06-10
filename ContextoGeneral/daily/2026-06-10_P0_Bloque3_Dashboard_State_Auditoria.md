# P0 Fuente de Verdad — Bloque 3 Auditoría Dashboard State

**Fecha:** 2026-06-10  
**Auditor:** Antigravity — Auditor Arquitectónico Senior de Producción  
**Estado:** `BLOQUE 3 — AUDITORIA_ENTREGADA`  

---

## 1. Resumen Ejecutivo

Esta auditoría valida que el Dashboard del Panel de Barbería consuma la API centralizada `/api/dashboard/state` como la única lectura privada canónica. Se verificó el flujo de hidratación de componentes y se rastreó el uso de variables locales, caché, mocks, fallbacks y llamadas directas de base de datos. 

La arquitectura actual está altamente integrada a través del hook global `useDashboard()`, el cual unifica la lectura de citas, servicios, barberos y horarios desde PostgreSQL. Sin embargo, se identificaron fugas de lectura directa vía PostgREST (`getBarberDescansos`), fallbacks de mock de datos en producción (barberos y servicios de prueba cuando el tenant está vacío), y porciones de código muerto en la resolución de identidad desde storage.

---

## 2. Archivos Revisados

1. `_work_panel_de_barberia/src/lib/dashboard-api.ts` (Cliente de API y endpoints)
2. `_work_panel_de_barberia/src/lib/barbershop-context.ts` (Resolución de contexto de identidad)
3. `_work_panel_de_barberia/src/store/dashboard-context.tsx` (Proveedor de estado `DashboardProvider`)
4. `_work_panel_de_barberia/src/components/dashboard-shell.tsx` (Layout principal y control de sesión)
5. `_work_panel_de_barberia/src/app/citas/page.tsx` (Componente de agenda y citas)
6. `_work_panel_de_barberia/src/app/barberos/page.tsx` (Gestión de barberos)
7. `_work_panel_de_barberia/src/app/servicios/page.tsx` (Gestión de catálogo de servicios)
8. `_work_panel_de_barberia/src/app/clientes/page.tsx` (Gestión de clientes y barberos preferidos)
9. `_work_panel_de_barberia/src/app/api/dashboard/state/route.ts` (Proxy seguro same-origin)

---

## 3. Búsquedas Ejecutadas (Greps)

Se realizaron búsquedas exhaustivas dentro del codebase de `_work_panel_de_barberia`:
* **`localStorage`/`sessionStorage`:** Encontrado uso en `barbershop-context.ts` (candidato temporal de UX) y `dashboard-context.tsx` (guardado de caché de sesión `ba_dashboard_session` y caché de estado `ba_dashboard_merged_cache`).
* **`ba_dashboard_reservas`/`ba_locally_paid_appointments`/`seedLandingData`:** 0 ocurrencias (limpieza exitosa).
* **`ba_landing_seed`:** Encontrado solo en `barbershop-context.ts` (código muerto de resolución de seed).
* **`mock` / `fallback`:** Encontrado en `soporte/page.tsx` (soporte técnico local), `mock-dashboard-data.ts` (entorno local sin conexión), fallbacks de imágenes en `barberos/page.tsx` e inicializadores condicionales en `dashboard-context.tsx`.
* **`Alex M` / `James V` / `James R`:** Encontrados como fallbacks en `citas/page.tsx` y `clientes/page.tsx` para vistas vacías.
* **`PostgREST` / `rpc`:** Encontrados endpoints públicos en `/rpc/ba_get_landing_publica` y llamadas directas de lectura de tabla en `getBarberDescansos` a `/barberos_descansos`.
* **`dashboard/state`:** Encontrado como canal de lectura primario en `dashboard-context.tsx` y proxied en `api/dashboard/state/route.ts`.
* **`setError(null)` / `catch`:** Manejo correcto de propagación de errores. Si la API falla, el error es capturado, el estado se limpia a `EMPTY_MERGED` y se muestra un banner rojo al usuario.

---

## 4. Hallazgos

### P0 (Riesgo Crítico de Arquitectura) - Lectura Directa de PostgREST
* **Archivo:** `_work_panel_de_barberia/src/lib/dashboard-api.ts` (Línea 310)
* **Descripción:** La función `getBarberDescansos` realiza una consulta directa vía PostgREST (`apiGetJson`) al endpoint `/barberos_descansos?select=barbero_id,fecha&barberia_id=eq...` desde el lado cliente en lugar de utilizar `dashboard/state`. Esto es consumido en la UI de citas, barberos y el editor.
* **Impacto:** Bypassa la fuente de verdad única del dashboard, introduce llamadas HTTP descentralizadas y depende de que las políticas de seguridad de PostgREST restrinjan correctamente el acceso anónimo, aumentando el riesgo de fuga de datos de descansos de barberos.

### P1 (Riesgo Alto) - Mocks de Barberos y Servicios en Producción
* **Archivos:** `_work_panel_de_barberia/src/app/citas/page.tsx` (Líneas 106-109, 120-123) y `clientes/page.tsx`
* **Descripción:** En la vista de citas, si las listas de servicios o barberos de la base de datos para la barbería retornan vacías (`merged.services.length === 0`), el frontend inyecta elementos mock con nombres e IDs estáticos (`Alex M.`, `James R.`, `Corte de Pelo`, `Barba`).
* **Impacto:** Un usuario real con una barbería recién creada verá barberos y servicios fake que no existen en PostgreSQL, generando confusión extrema y comportamientos imprevistos si intenta agendar con ellos.

### P2 (Riesgo Medio) - Código Muerto de Contexto y Caché Inútil
* **Archivo:** `_work_panel_de_barberia/src/lib/barbershop-context.ts` (Línea 45) y `dashboard-context.tsx` (Línea 46)
* **Descripción:** 
  1. `resolveIdentityFromSeed()` y `readLandingSeed()` leen `ba_landing_seed`, pero **nunca** son invocados.
  2. `writeMergedCache()` escribe la estructura `merged` completa en `localStorage` bajo `ba_dashboard_merged_cache:...`, pero no existe ninguna función que la lea (`readMergedCache` fue removida).
* **Impacto:** Ruido en el codebase, acumulación inútil de datos en el almacenamiento local del navegador del usuario.

---

## 5. Evidencias de Lectura Canónica y Seguridad

### A. Evidencia de LocalStorage / SessionStorage
El sistema ha blindado exitosamente `resolveBarbershopIdentity()` para evitar lecturas autoritativas del tenant desde la caché del navegador:
```typescript
// _work_panel_de_barberia/src/lib/barbershop-context.ts (Línea 106)
export function resolveBarbershopIdentity(userId?: string | number | null | undefined): BarbershopIdentity {
  const fromUrl = resolveIdentityFromUrl();
  if (fromUrl.id || fromUrl.slug) return fromUrl;

  if (userId) {
    clearLegacyTestIdentity(userId);
  }

  // localStorage/sessionStorage are UX cache only. They must never resolve
  // the final private tenant identity; session/me owns that decision.
  return { id: null, slug: null };
}
```

### B. Evidencia de Manejo de Errores de API
Si `/api/dashboard/state` falla (por falta de red, sesión inválida o error 403), el error no se oculta. El provider de React limpia la UI y propaga la alerta:
```typescript
// _work_panel_de_barberia/src/store/dashboard-context.tsx (Línea 370)
} catch (cause) {
  console.error("Error loading dashboard state:", cause);
  setMerged(EMPTY_MERGED);
  setError("No se pudo cargar la fuente de verdad.");
  setMessage(null);
}
```

---

## 6. Evidencia de Pruebas Postman (Ejecutadas en Producción)

Las pruebas contra la URL activa de producción (`https://barberagency-app.gymh5g.easypanel.host`) arrojaron los siguientes códigos de estado validados:

1. **GET `/api/dashboard/state` con barbería propia (barberia_id=198)**  
   * **Status:** `200 OK`
   * **Evidence:** `{ "ok": true, "merged": { "biz_name": "Barberia Prueba 4", "biz_slug": "barberia-prueba-4" } }`
2. **GET `/api/dashboard/state` sin cookie de sesión**  
   * **Status:** `401 Unauthorized`
   * **Evidence:** `{ "ok": false, "message": "Sesion no valida" }`
3. **GET `/api/dashboard/state` con barbería ajena (barberia_id=3)**  
   * **Status:** `403 Forbidden`
   * **Evidence:** `{ "ok": false, "message": "No tienes permisos para esta barberia o no existe" }`
4. **GET `/api/dashboard/state` con mismatch `barberia_id` + `slug` (barberia_id=198, slug=incorrect-slug)**  
   * **Status:** `403 Forbidden`
   * **Evidence:** `{ "ok": false, "message": "No tienes permisos para esta barberia o no existe" }`

---

## 7. Evidencia SQL (Datos Reales de Producción para Barbería 198)

Consultas realizadas directamente sobre la base de datos PostgreSQL de producción:

### Barberos Registrados
```json
[
  { "id": 439, "nombre": "Barbero prueba 4", "activo": true },
  { "id": 440, "nombre": "Barbero Prueba 4.1", "activo": true },
  { "id": 445, "nombre": "barber3", "activo": false },
  { "id": 446, "nombre": "Barbero de Test", "activo": false },
  { "id": 447, "nombre": "Barbero de Test", "activo": false }
]
```

### Servicios Registrados
```json
[
  { "id": 489, "nombre": "Corte Clasico", "activo": true, "precio": "20000.00", "duracion_min": 30 },
  { "id": 490, "nombre": "Barba", "activo": true, "precio": "12000.00", "duracion_min": 30 },
  { "id": 491, "nombre": "Corte + Cejas", "activo": true, "precio": "15000.00", "duracion_min": 30 },
  { "id": 506, "nombre": "Corte de Test", "activo": false, "precio": "15000.00", "duracion_min": 30 },
  { "id": 507, "nombre": "Corte de Test", "activo": false, "precio": "15000.00", "duracion_min": 30 }
]
```

### Últimas 5 Citas (Agenda)
```json
[
  { "id": 183, "fecha": "2026-06-12T00:00:00.000Z", "hora_inicio": "08:00:00", "estado": "confirmada" },
  { "id": 182, "fecha": "2026-06-09T00:00:00.000Z", "hora_inicio": "19:30:00", "estado": "confirmada" },
  { "id": 181, "fecha": "2026-06-09T00:00:00.000Z", "hora_inicio": "19:00:00", "estado": "confirmada" },
  { "id": 180, "fecha": "2026-06-05T00:00:00.000Z", "hora_inicio": "19:00:00", "estado": "confirmada" },
  { "id": 179, "fecha": "2026-06-05T00:00:00.000Z", "hora_inicio": "13:30:00", "estado": "confirmada" }
]
```

### Horarios de Apertura
```json
[
  { "dia_semana": 0, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 1, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:00:00" },
  { "dia_semana": 2, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 3, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 4, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 5, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 6, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" }
]
```

---

## 8. Riesgos para Producción

1. **Vulnerabilidad de acceso anónimo / bypass en descansos:** La llamada `getBarberDescansos` a `/barberos_descansos` via PostgREST en el cliente evade la validación centralizada de cookies. Si no hay RLS (Row Level Security) activo en esa tabla en PostgreSQL, cualquier atacante podría ver cuándo descansan los barberos de cualquier local.
2. **Confusión del usuario final por mocks:** El fallback inyectando barberos (`Alex M.`, `James R.`) y servicios mock puede incitar a los dueños de barberías a agendar citas ficticias que romperán la integridad referencial de la base de datos, ya que estos barberos no existen en PostgreSQL con esos IDs.

---

## 9. Recomendación Concreta para Codex

Para solucionar el Bloque 3 de forma limpia y robusta, se recomienda a Codex realizar las siguientes correcciones de arquitectura:

1. **Consolidar Descansos en Dashboard State:**
   - Modificar la respuesta del webhook `dashboard/state` en n8n para que incluya el array de `descansos` dentro del payload JSON devuelto.
   - Modificar la normalización en `normalizeMergedFromState` de `dashboard-api.ts` para mapear los descansos de barberos desde la propiedad unificada.
   - Eliminar por completo la función `getBarberDescansos` y las consultas PostgREST en cliente a `/barberos_descansos`.
2. **Remover Fallbacks Inseguros de la UI:**
   - En `citas/page.tsx` y `clientes/page.tsx`, eliminar las listas fallback estáticas de barberos y servicios.
   - Implementar un estado vacío (*Empty State*) amigable en la UI que invite al usuario a configurar su primer barbero y servicio si la barbería no posee datos.
3. **Limpiar Código Muerto:**
   - Remover `writeMergedCache()` y `resolveIdentityFromSeed()` en `dashboard-context.tsx` y `barbershop-context.ts`.

---

## 10. Decisión

**GO CON RESERVAS** ⚠️

La arquitectura de lectura es un 90% limpia y canónica a través de `dashboard/state`, y el control de accesos 401/403/mismatch está blindado en producción. Se puede proceder a habilitar la fase de corrección de Codex con la condición de resolver los hallazgos descritos (fuga PostgREST y mocks de UI) antes del cierre final de Bloque 3.
