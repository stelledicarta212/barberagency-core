# Diagnóstico de Hidratación Canónica Completa

**Fecha:** 2026-06-11
**Auditor:** Antigravity
**Tenant QA:** `barberia_id = 198`, `slug = barberia-prueba-4`

---

## Resumen Ejecutivo

Se identificó que el problema de pérdida de datos en el workflow de creación/publicación de landing no reside en la renderización de la plantilla pública ni en el editor V5, sino en la etapa anterior donde se persiste la semilla canónica (`ba_landing_seed`) desde el flujo de configuración / edición.

El fallo se produce en `project/templates/plantillas/registrobarberia.html` dentro de la función `persistLandingSeed()`. Ahí, el código intenta usar un `draft` global a través de `window.draft` en lugar de la variable local `draft` del ámbito actual.

Como resultado, las colecciones heredadas de la barbería que deberían ser persistidas en la semilla (`servicios`, `barberos`, `horarios`) se escriben como arrays vacíos (`[]`). El editor de landing carga correctamente en modo edición, pero al leer `ba_landing_seed` ya recibe datos perdidos, por lo que se renderiza sin heredar la configuración real del tenant.

---

## Flujo de diagnóstico

1. El usuario abre el flujo de configuración con:
   - `https://barberagency-barberagency.gymh5g.easypanel.host/registro-barberias/?mode=edit&barberia_id=198&slug=barberia-prueba-4`
2. `registrobarberia.html` hidrata el `draft` desde `/api/dashboard/state` para la barbería 198.
3. Al seleccionar "Seguir a la plantilla" en modo edición, se ejecuta `persistLandingSeed(payload, seedData)`.
4. `persistLandingSeed()` escribe `ba_landing_seed` en `sessionStorage` / `localStorage`.
5. El editor `landing_editor_v2_unico_vscode.html` carga en modo `edit` y lee `ba_landing_seed`.
6. El editor omite la llamada de hidratación pública para evitar sobrescribir datos locales y depende únicamente de la semilla guardada.
7. Dado que la semilla ya contiene `servicios: []`, `barberos: []` y `horarios: []`, el editor muestra los datos heredados como vacíos.

---

## Evidencia clave

### Archivo afectado

* `project/templates/plantillas/registrobarberia.html`

### Función causante

* `persistLandingSeed(payload, data)`

### Bug concreto

La línea de código defectuosa es:

```javascript
const sourceDraft = (payload && payload.draft) || window.draft || {};
```

El `draft` relevante está definido en el mismo ámbito del script como variable local, no como propiedad global de `window`. Por ello, cuando `payload.draft` no existe, el fallback `window.draft` es `undefined` y `sourceDraft` queda como `{}`.

Esto lleva a que la semilla se construya con datos en blanco y colecciones vacías, incluso cuando `dashboard/state` devuelve los servicios, barberos y horarios reales de la barbería 198.

---

## Impacto

* El editor de landing V2 carga en modo edición con identidad correcta (`barberia_id=198`, `slug=barberia-prueba-4`).
* La lógica de renderizado del editor no es la causa raíz.
* La pérdida de datos ocurre antes de que el editor reciba la semilla.
* Las plantillas públicas V5 y el formulario de reservas quedan afectados porque consumen una semilla ya incompleta.

---

## Conclusión

El problema es un bug de persistencia de semilla en `registrobarberia.html`, no una falla de renderizado en `landing_editor_v2_unico_vscode.html` ni en las plantillas V5.

La corrección mínima consiste en cambiar la referencia `window.draft` por la variable local `draft` dentro de `persistLandingSeed()` y asegurar que las colecciones finales se construyan a partir de los datos reales del `draft` cuando estén disponibles.

---

## No se modificó código funcional

Este diagnóstico es únicamente de auditoría. No se realizaron cambios en código de producción, base de datos, n8n, EasyPanel, POS, permisos, sesiones, backend de reservas ni en las plantillas más allá de documentar el hallazgo.
