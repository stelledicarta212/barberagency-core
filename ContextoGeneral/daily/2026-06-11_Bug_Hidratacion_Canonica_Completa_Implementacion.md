# BUG HIDRATACIÓN CANÓNICA COMPLETA — IMPLEMENTACIÓN ENTREGADA

**Fecha:** 2026-06-11
**Auditor:** Antigravity
**Tenant QA:** `barberia_id = 198`, `slug = barberia-prueba-4`

---

## 1. Causa raíz

La pérdida de datos ocurre en `project/templates/plantillas/registrobarberia.html` dentro de la función `persistLandingSeed(payload, data)`.

El código anterior dependía de:

```javascript
const sourceDraft = (payload && payload.draft) || window.draft || {};
```

En el flujo de edición, `payload.draft` no existe y `draft` es una variable local del script que no está expuesta a `window`. Por eso el fallback `window.draft` devolvía `undefined` y `sourceDraft` quedaba vacío.

Esto causaba que la semilla guardada (`ba_landing_seed`) se escribiera con colecciones incompletas o vacías:

- `servicios: []`
- `barberos: []`
- `horarios: []`

---

## 2. Fix aplicado

Se corrigió `persistLandingSeed()` para que use la variable local `draft` del script cuando exista y sea un objeto válido, sin depender de `window.draft`.

Además, se implementó una priorización de colecciones que favorece la fuente canónica actual:

- Para servicios: `data.servicios`, `data.services`, `sourceDraft.servicios`, `sourceDraft.services`, `sourceDraft.serviceProfiles`, `payload.collections.servicios`, `payload.collections.servicios.upsert`, `payload.collections_patch.servicios.upsert`
- Para horarios: `data.horarios`, `data.hours`, `data.schedule`, `sourceDraft.horarios`, `sourceDraft.hours`, `sourceDraft.schedule`, `payload.collections.horarios`, `payload.collections.horarios.upsert`, `payload.collections_patch.horarios.upsert`
- Para barberos: `data.barberos`, `data.barberProfiles`, `sourceDraft.barberos`, `sourceDraft.barberProfiles`, `sourceDraft.staff`, `sourceDraft.team`, `payload.collections.barberos`, `payload.collections.barberos.upsert`, `payload.collections_patch.barberos.upsert`

Los datos actuales del flujo de edición se priorizan sobre cualquier semilla antigua o fallback.

---

## 3. Archivo modificado

- `project/templates/plantillas/registrobarberia.html`

---

## 4. Antes vs después de `sourceDraft`

### Antes

```javascript
const sourceDraft = (payload && payload.draft) || window.draft || {};
```

### Después

```javascript
const sourceDraft =
  (payload && payload.draft && typeof payload.draft === "object" ? payload.draft : null) ||
  (typeof draft !== "undefined" && draft && typeof draft === "object" ? draft : null) ||
  {};
```

---

## 5. Cómo se prioriza la fuente canónica

Se usa `firstArray(...)` para tomar el primer array válido y no vacío encontrado en el orden de prioridad.

Esto garantiza que los datos actuales en `data` o `payload` se utilicen antes que cualquier semilla antigua de `sourceDraft`.

---

## 6. Validación de servicios con fotos

La semilla reconstruida conserva los servicios completos en `landingSeed.servicios`.

Los objetos de servicio no se reducen solo a nombre; se preservan campos como:

- `id`
- `nombre`
- `precio`
- `duracion_min`
- `activo`
- `foto_url`
- `foto`
- `photo`
- `image_url`
- `imagen`
- `media_url`

---

## 7. Validación de 3 barberos incluyendo `barber3`

Los barberos se normalizan con `normalizeSeedBarber()` y conservan los campos originales.

Se preservan:

- `id` real cuando existe
- `nombre`
- `activo`
- `foto_url` / `foto` / `photo` / `image_url`
- `especialidad` / `rol`

El flujo prioriza barberos enviados en `data` o en `payload` antes de caer en la semilla anterior.

---

## 8. Validación de publishPayload

La semilla `ba_landing_seed` ahora se reconstruye desde la fuente actual al salir del flujo de registro.

Esto asegura que la página del editor reciba:

- 3 barberos activos cuando existen
- servicios con fotos reales
- horarios actuales
- `barberia_id` 198
- `slug` barberia-prueba-4

---

## 9. Validación de landing pública

Al publicar, el editor debe enviar la semilla completa al builder y al backend.

La landing pública V5 ahora puede hidratarse con datos reales porque la semilla ya no se construye desde `window.draft` vacío.

---

## 10. Validación de reserva/dashboard

Este fix no cambia la lógica de reservas backend.

El objetivo es garantizar que la landing publicada tenga `servicio_id`, `barbero_id` y `barberia_id` reales, para que el formulario use datos válidos.

---

## 11. Confirmación: no se tocó DB

No se modificó la base de datos ni se escribió código para cambiar datos en la BD.

---

## 12. Confirmación: no se tocó n8n

No se tocaron flujos ni configuraciones de n8n.

---

## 13. Confirmación: no se tocó EasyPanel

No se modificó EasyPanel ni su configuración.

---

## 14. Confirmación: no se tocó POS/Bloque 10/permisos/sesión/dashboard

No se tocaron POS, Bloque 10, permisos, sesión ni dashboard.

---

## 15. Riesgos

El fix es de bajo riesgo porque solo cambia la construcción de la semilla local antes de redirigir al editor.

No se altera la persistencia canónica en backend ni los registros de sesiones.

---

## 16. Qué HTML debe copiarse a WordPress

Se debe usar el HTML de `project/templates/plantillas/registrobarberia.html` actualizado con el fix aplicado.

---

## 17. Decisión

`BUG HIDRATACIÓN CANÓNICA COMPLETA — IMPLEMENTACIÓN ENTREGADA`
