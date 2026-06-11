# Diagnóstico de Hidratación del Editor desde Flujo de Configuración

**Fecha:** 2026-06-11  
**Auditor:** Antigravity  
**Estado:** `BUG HIDRATACIÓN — DIAGNÓSTICO ENTREGADO`

---

## 1. Resumen Ejecutivo

Este reporte documenta el diagnóstico y análisis del problema de hidratación de datos (servicios, barberos y horarios) en `landing_editor_v2` cuando el usuario navega desde el panel de control a través del flujo **Configuración → "Seguir a la plantilla"**.

El editor abre correctamente en modo edición (`mode=edit`), pero se muestra completamente vacío, sin heredar los servicios, barberos ni horarios existentes en la base de datos para la barbería.

Se determinó que la causa raíz es un **error de referencia de variable de ámbito (scope/binding)** en la función `persistLandingSeed` en [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html). Al evaluar el borrador actual, el código intenta acceder a `window.draft` en lugar de la variable local de bloque `draft`. Dado que `draft` se declara con `let` dentro de un IIFE, `window.draft` resulta `undefined`, lo que provoca que se guarden arrays vacíos `[]` para las colecciones heredadas en el `sessionStorage`/`localStorage` (`ba_landing_seed`).

---

## 2. Flujo Real Detectado

1. **Dashboard Shell (Next.js):** El usuario hace clic en el enlace de "Configuración". La función `buildSettingsEditUrl` en [dashboard-shell.tsx](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/src/components/dashboard-shell.tsx) redirige al usuario a la página de registro/onboarding con los parámetros adecuados de edición:
   `https://barberagency-barberagency.gymh5g.easypanel.host/registro-barberias/?mode=edit&barberia_id=198&slug=barberia-prueba-4`
2. **Registro Barberías (HTML/JS):** Al cargarse la página [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html) en modo edición (`isEditIntent() === true`), se realiza una petición a `/api/dashboard/state` para hidratar el estado local `draft` con la configuración real de la barbería 198.
3. **Pulsar "Seguir a la plantilla":** Se ejecuta `submitDraftAndContinue()`. 
   - Al ser un flujo de edición (`isEdit === true`), se ejecuta el flujo alternativo que no invoca a `/api/configuracion/update` (evitando llamadas innecesarias) y ejecuta:
     ```javascript
     const data = buildEditNavigationData();
     const seedData = { ... };
     persistLandingSeed(payload, seedData);
     window.location.href = buildLandingBuilderUrl(payload, seedData);
     ```
   - `persistLandingSeed` escribe la semilla en `sessionStorage` / `localStorage` bajo la clave `ba_landing_seed`.
   - Se redirige al editor `landing_editor_v2_unico_vscode.html` pasando parámetros como `mode=edit&barberia_id=198&slug=barberia-prueba-4`.
4. **Editor de Landing:** Al cargar, detecta que viene del flujo de registro/edición (`cameFromRegistroEdit === true`).
   - Para evitar sobrescribir los cambios locales con datos viejos de producción, el editor **omite** la llamada a `hydrateInheritedFromPublicProfile()`.
   - Intenta hidratar los servicios, barberos y horarios usando únicamente la semilla almacenada bajo la clave `ba_landing_seed`.
   - Como dicha semilla contiene arrays vacíos (`servicios: []`, `barberos: []`, `horarios: []`), el editor se renderiza sin estos datos heredados.

---

## 3. Datos Reales de `/api/dashboard/state` (Barbería 198)

Cuando se consulta `/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4`, la API de Same-Origin en [route.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/src/app/api/dashboard/state/route.ts) resuelve exitosamente la sesión e integra los siguientes datos desde PostgreSQL y n8n:

* **Estructura base de respuesta (200 OK):**
  ```json
  {
    "ok": true,
    "identity": {
      "barberia_id": 198,
      "slug": "barberia-prueba-4"
    },
    "barberia": {
      "id": 198,
      "slug": "barberia-prueba-4",
      "nombre": "Barberia Prueba 4",
      "slot_min": 15,
      "timezone": "America/Bogotá"
    },
    "servicios": [
      { "id": 489, "nombre": "Corte Clasico", "activo": true, "precio": "20000.00", "duracion_min": 30 },
      { "id": 490, "nombre": "Barba", "activo": true, "precio": "12000.00", "duracion_min": 30 },
      { "id": 491, "nombre": "Corte + Cejas", "activo": true, "precio": "15000.00", "duracion_min": 30 }
    ],
    "barberos": [
      { "id": 439, "nombre": "Barbero prueba 4", "activo": true },
      { "id": 440, "nombre": "Barbero Prueba 4.1", "activo": true }
    ],
    "horarios": [
      { "dia_semana": 1, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:00:00" },
      { "dia_semana": 2, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" }
    ],
    "descansos": []
  }
  ```

---

## 4. Storage Escrito por `registrobarberia.html`

Debido al bug de referencia, la función `persistLandingSeed(payload, seedData)` genera el siguiente objeto de semilla:

* **Clave de Storage utilizada:** `ba_landing_seed` (guardada en `sessionStorage` e intentada en `localStorage` si falla).
* **Contenido Escrito real en localStorage/sessionStorage:**
  ```json
  {
    "source": "onboarding_complete",
    "created_at": "2026-06-11T13:30:00.000Z",
    "barberia_id": 198,
    "id_barberia": 198,
    "id": 198,
    "slug": "barberia-prueba-4",
    "nombre": "",
    "ciudad": "",
    "direccion": "",
    "maps_url": "",
    "telefono": "",
    "slot_min": 15,
    "barberia": {
      "id": 198,
      "slug": "barberia-prueba-4",
      "nombre": "",
      "ciudad": "",
      "direccion": "",
      "maps_url": "",
      "telefono": "",
      "timezone": "America/Bogotá",
      "slot_min": 15
    },
    "servicios": [],
    "horarios": [],
    "barberos": [],
    "barber_photos": [
      "https://barberagency-barberagency.gymh5g.easypanel.host/wp-content/uploads/2026/04/barbero1.1.png",
      "https://barberagency-barberagency.gymh5g.easypanel.host/wp-content/uploads/2026/04/barbero2.1.png",
      "https://barberagency-barberagency.gymh5g.easypanel.host/wp-content/uploads/2026/04/barbero3.1.png",
      "https://barberagency-barberagency.gymh5g.easypanel.host/wp-content/uploads/2026/04/barbero4.1.png"
    ],
    "accesos": {
      "admin": { "nombre": "", "email": "", "password": "" },
      "barberos": []
    },
    "onboarding_result": {
      "barberia_id": 198,
      "slug": "barberia-prueba-4",
      "barberia": {
        "id": 198,
        "slug": "barberia-prueba-4",
        "nombre": "Barberia Prueba 4",
        "telefono": "...",
        "direccion": "..."
      },
      "message": "Continuando sin cambios pendientes.",
      "servicios": [],
      "barberos": [],
      "horarios": []
    }
  }
  ```

*(Nota cómo `servicios`, `horarios`, y `barberos` se guardan como arrays vacíos, y la información descriptiva de la barbería en la raíz de la semilla queda en blanco).*

---

## 5. Storage Leído por `landing_editor_v2_unico_vscode.html`

El editor ejecuta `readLandingSeed()` al inicializarse:

* **Clave leída:** `ba_landing_seed` (prioriza `sessionStorage`, luego `localStorage`).
* **Lectura de colecciones:**
  ```javascript
  servicios: Array.isArray(sessionSeed?.servicios) ? sessionSeed.servicios : [],
  barberos: Array.isArray(sessionSeed?.barberos) ? sessionSeed.barberos : [],
  horarios: Array.isArray(sessionSeed?.horarios) ? sessionSeed.horarios : []
  ```
  Al recuperar los arrays vacíos `[]`, la interfaz de edición no muestra nada.

---

## 6. Diferencia Exacta entre Formato Escrito y Formato Esperado

No hay una discrepancia de nombres de claves o estructura básica, sino una **pérdida total de datos** en la semilla debido a la resolución errónea de la variable de origen:

| Campo en `ba_landing_seed` | Formato Esperado (Con Datos) | Formato Escrito Actual (Vacio) |
| :--- | :--- | :--- |
| `servicios` | Array de objetos de servicio con `id`, `nombre`, `precio`, `duracion_min` | `[]` |
| `barberos` | Array de objetos de barbero con `id`, `nombre`, `activo`, `foto_url` | `[]` |
| `horarios` | Array de horarios con `dia`, `activo`, `hora_abre`, `hora_cierra` | `[]` |
| `nombre` | Nombre de la barbería (ej: `"Barberia Prueba 4"`) | `""` |
| `telefono` | Teléfono de la barbería | `""` |
| `direccion` | Dirección de la barbería | `""` |

---

## 7. Causa Raíz

En [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html), la función `persistLandingSeed` contiene la siguiente línea (Línea 2043):
```javascript
const sourceDraft = (payload && payload.draft) || window.draft || {};
```
1. En el flujo de edición, `payload` es construido por `buildPatchPayload()` y no contiene la propiedad `.draft`.
2. Como `payload.draft` es `undefined`, el código evalúa la expresión de respaldo `window.draft`.
3. Sin embargo, la variable del estado del asistente se declara con `let draft` dentro del ámbito local del IIFE (Línea 279), **no en el objeto global `window`**.
4. Por lo tanto, `window.draft` devuelve `undefined`, y `sourceDraft` se inicializa como un objeto vacío `{}`.
5. Las propiedades `servicios`, `horarios` y `barberos` se extraen de `sourceDraft`, lo que resulta en arrays vacíos de forma silenciosa.

---

## 8. Fix Mínimo Recomendado

### Fix 1: Cambiar `window.draft` por `draft`
En la función `persistLandingSeed` de [registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html) (Línea 2043), remover la referencia a `window` para que acceda a la variable local `draft` en el mismo ámbito:
```diff
- const sourceDraft = (payload && payload.draft) || window.draft || {};
+ const sourceDraft = (payload && payload.draft) || draft || {};
```

### Fix 2: Asegurar la consistencia de los datos modificados en `persistLandingSeed`
Para garantizar que si el usuario realizó modificaciones parciales estas se fusionen con la semilla existente en lugar de ser ignoradas, se recomienda que `persistLandingSeed` use los datos provistos en el parámetro `data` (que ya contiene los upserts de servicios/barberos/horarios de `seedData`) si están presentes y tienen datos:
```javascript
      // Servicios
      const finalServices = Array.isArray(data?.servicios) && data.servicios.length
        ? data.servicios
        : (sourceDraft.servicios || []);

      // Horarios
      const finalHours = Array.isArray(data?.horarios) && data.horarios.length
        ? data.horarios
        : (sourceDraft.horarios || []);

      // Barberos
      const finalBarbers = Array.isArray(data?.barberos) && data.barberos.length
        ? data.barberos
        : (barberProfiles.length ? barberProfiles : barberAccesses);
```
Y mapearlos en el objeto `landingSeed`:
```javascript
        servicios: finalServices,
        horarios: finalHours,
        barberos: finalBarbers,
```

---

## 9. Archivos a Modificar

* `barberagency-core`:
  * [project/templates/plantillas/registrobarberia.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/registrobarberia.html)

---

## 10. Riesgos

* **Bajo impacto y riesgo nulo:** La corrección propuesta solo afecta el proceso de escritura de la semilla en storage justo antes de redirigir al constructor de landing. No altera la base de datos ni los flujos de creación/registro desde cero.

---

## 11. Decisión

* **BUG HIDRATACIÓN — DIAGNÓSTICO ENTREGADO** ✅
