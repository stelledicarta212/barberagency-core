# BUG V5 ROUTE CONTEXT HIDRATACIÓN — IMPLEMENTACIÓN ENTREGADA

**Fecha:** 2026-06-11
**Auditor:** Antigravity
**Tenant QA:** `barberia_id = 198`, `slug = barberia-prueba-4`

---

## 1. Causa raíz

La plantilla V5 ignoraba `window.BA_LANDING_ROUTE_CONTEXT` en rutas públicas `/b/slug`.

La rama existente en `hydrateLandingFromPublicEndpoint()` devolvía directamente con:

```javascript
if (/^\/b\/[^/]+\/?$/i.test(String(window.location?.pathname || '')) &&
    window.BA_LANDING_ROUTE_CONTEXT &&
    typeof window.BA_LANDING_ROUTE_CONTEXT === 'object') {
  renderLandingQr();
  return;
}
```

Eso significaba que la landing pública V5 no aplicaba:

- servicios
- barberos
- horarios
- branding
- perfil
- cover
- logo
- runtimeLandingState

Y podía quedar con datos mock, seed vieja o datos incompletos.

---

## 2. Fix aplicado

Modifiqué `hydrateLandingFromPublicEndpoint()` para que en rutas `/b/slug`, cuando existe `window.BA_LANDING_ROUTE_CONTEXT`, procese el payload completo como fuente canónica.

Ahora hace:

1. `extractPublicLandingPayload(window.BA_LANDING_ROUTE_CONTEXT)`.
2. Valida `payload.ok`.
3. Setea:
   - `runtimeLandingState.barberia_id`
   - `runtimeLandingState.profile`
   - `runtimeLandingState.branding`
   - `runtimeLandingState.inherited`
4. Aplica URLs runtime si existen:
   - `window.BA_PUBLIC_LANDING_URL`
   - `window.BA_RESERVATION_URL`
   - `window.BA_QR_URL`
5. Ejecuta:
   - `applyInheritedCollections(payload.servicios, payload.barberos, payload.horarios, payload.slot_min)`
   - `applyPublicLandingBranding(payload)`
   - `renderLandingQr()`

---

## 3. Archivo modificado

- `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`

---

## 4. Antes/después de la rama `/b/slug`

### Antes

`BA_LANDING_ROUTE_CONTEXT` solo se usaba para mostrar el QR y se devolvía sin hidratar.

### Después

`BA_LANDING_ROUTE_CONTEXT` se procesa como el contenido canónico de la landing pública, se hidrata totalmente y se renderiza con datos reales.

---

## 5. Validación con 3 barberos

La rama de `BA_LANDING_ROUTE_CONTEXT` ahora aplica los barberos del payload a `applyInheritedCollections`.

Esto permite que V5 reciba y renderice 3 barberos en `/b/barberia-prueba-4` cuando el contexto trae 3 barberos reales.

---

## 6. Validación de fotos de servicios

Los servicios del payload se pasan a `applyInheritedCollections` sin ser omitidos.

Se conservan las imágenes reales en `service.foto_url` / `service.imagen_url` / `service.image_url` si están presentes.

---

## 7. Validación de horarios

Los horarios reales del contexto se aplican directamente a `applyInheritedCollections(..., payload.horarios, payload.slot_min)`.

---

## 8. Confirmación de reserva/dashboard

El fix no toca la lógica de reservas backend ni el dashboard.

Su propósito es asegurar que la landing publicada `/b/slug` use datos reales y no mock.

---

## 9. Confirmación de que no se tocó DB/n8n/backend

No se modificó la base de datos ni n8n.

No se tocó el backend de reservas ni `/api/editor/publish`.

---

## 10. Qué HTML copiar a WordPress

El HTML actualizado de `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html` es el que debe copiarse a WordPress.

---

## 11. Decisión

`BUG V5 ROUTE CONTEXT HIDRATACIÓN — IMPLEMENTACIÓN ENTREGADA`
