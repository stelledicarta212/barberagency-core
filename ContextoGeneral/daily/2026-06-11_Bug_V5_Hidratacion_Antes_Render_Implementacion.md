# BUG V5 HIDRATACIÓN ANTES DEL RENDER — IMPLEMENTACIÓN ENTREGADA

**Fecha:** 2026-06-11
**Auditor:** Antigravity
**Tenant QA:** `barberia_id = 198`, `slug = barberia-prueba-4`

---

## 1. Causa raíz

En `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`, la inicialización de V5 usaba `hydrateLandingFromPublicEndpoint()` sin esperar su finalización y luego ejecutaba inmediatamente el render final:

- `renderServices()`
- `renderBarbers()`
- `fillSelects()`
- `renderLandingQr()`

Esto permitía que la página renderizara con datos mock o seed parcial antes de que la hidratación canónica terminara.

---

## 2. Fix aplicado

Se creó una función `async function initLanding()` que:

1. Lee el seed con `readLandingSeed()`.
2. Extrae datos canónicos con `extractPublicLandingPayload(landingSeed)`.
3. Si `initialPayload.ok`:
   - actualiza `runtimeLandingState` con `barberia_id`, `profile`, `branding` e `inherited`
   - asigna `window.BA_PUBLIC_LANDING_URL`, `window.BA_RESERVATION_URL` y `window.BA_QR_URL` si están presentes
   - llama a `applyInheritedCollections(...)` con servicios/barberos/horarios/celda mínima
   - llama a `applyPublicLandingBranding(initialPayload)`
4. Espera `await hydrateLandingFromPublicEndpoint()`.
5. Ejecuta `initTheme()`, `stripInjectedUi()`, observa mutaciones.
6. Después de la hidratación, renderiza:
   - `renderServices()`
   - `renderBarbers()`
   - `fillSelects()`
   - `renderLandingQr()`

---

## 3. Archivo modificado

- `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`

---

## 4. Resultado esperado

- V5 no renderiza servicios/barberos/formulario antes de aplicar la fuente canónica.
- En `/b/barberia-prueba-4`, si la fuente canónica trae 3 barberos, V5 debe renderizar 3.
- Si la fuente canónica trae fotos de servicios, esas fotos se usan en el render.
- No se crearon IDs inventados ni se usa `idx + 1` como ID real.
- No se modificó DB/n8n/backend/easyPanel/POS/dashboard/reservas.

---

## 5. Validación técnica

- `Node` sintaxis del script embebido: OK
- `git diff --check` en el archivo modificado: OK (solo advertencia CRLF)

---

## 6. Confirmación de WordPress

El HTML actualizado en `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html` es el que debe copiarse a WordPress para desplegar la corrección.

---

## 7. Commit

- `fix(v5): hydrate canonical data before final render`
