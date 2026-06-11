# AUDITORÍA PROFUNDA EN VIVO: V5 HIDRATACIÓN PIPELINE CANÓNICA

**Fecha de la Auditoría:** 2026-06-11  
**Auditor:** Antigravity  
**Estatus:** `BUG V5 — CAUSA RAÍZ IDENTIFICADA` ✅  

---

## 1. Resumen Ejecutivo

Esta auditoría en vivo se realizó para diagnosticar de forma precisa el punto exacto de la cadena de datos donde se pierden los barberos, servicios y horarios en la landing pública **V5 (index_unico_v5_1_azul_rojo_elegante)** de Barbería 198 (`barberia-prueba-4`).

El hallazgo clave es que **el HTML del Editor en producción (`landing_editor_v2`) no tiene aplicadas las últimas correcciones locales**. Por este motivo, al publicar cambios desde el editor, este envía las colecciones de barberos y servicios anidadas únicamente dentro del objeto `inherited` y las omite en la raíz del payload. La n8n RPC (`save-v2`) espera las colecciones en la raíz del payload JSON para persistirlas en las tablas canónicas, lo que causa que **las modificaciones de barberos y servicios (como la activación de `barber3`) nunca se persistan en PostgreSQL**. Dado que la base de datos mantiene a `barber3` como inactivo (`activo = false`), la consulta canónica `ba_get_landing_publica` de la landing lo filtra correctamente.

---

## 2. Evidencia de HTML Servido por WordPress

Tras realizar peticiones GET en vivo al servidor de WordPress:

1. **Página Plantilla V5 (`/index_unico_v5_1_azul_rojo_elegante/?v=578e875`)**:
   - Contiene la hidratación correcta: **Sí** (Contiene `extractPublicLandingPayload`, `hydrateLandingFromPublicEndpoint`, `applyInheritedCollections(`, `applyPublicLandingBranding(`, `resolveServiceImage` y `isKnownPlaceholderImage`).
   - Contiene el comportamiento viejo (redirigir al QR inmediatamente sin renderizar): **No**.

2. **Página Editor (`/landing_editor_v2/?v=f953531a`)**:
   - Contiene `isKnownPlaceholderImage` y `getCanonicalSeedCoverUrl()`: **Sí**.
   - **Contiene la estructura de payload de guardado corregida (`servicios`, `barberos` y `horarios` en la raíz de `buildSavePayload`): NO.**
   - *Snippet de código servido en producción:*
     ```javascript
     function buildSavePayload() {
       // ...
       return {
         ...payload,
         ...publishedUrls,
         landing_publish: landingPublish
       };
     }
     ```
     *(Se evidencia que falta la inyección en la raíz de las colecciones de servicios, barberos y horarios).*

3. **Página Registro (`/registro-barberias/?v=6e8491e`)**:
   - Ya no utiliza `window.draft`: **Sí** (Confirmado, ya no lo incluye).

---

## 3. Confirmación de si `/b/slug` usa V5 Real

Se inspeccionó `/b/barberia-prueba-4?v=578e875`:
- **Código de Respuesta:** `200 OK` (No hay redirecciones erróneas).
- **Confirmación del HTML:** El router de WordPress en `/b/barberia-prueba-4` devuelve el HTML del template V5 (`index_unico_v5_1_azul_rojo_elegante`), sirviendo la función `resolveServiceImage` y el bloque `await hydrateLandingFromPublicEndpoint`.
- **window.BA_LANDING_ROUTE_CONTEXT:** Inyectado exitosamente en el DOM con datos de la base de datos canónica.

---

## 4. Fuente de Verdad Actual (PostgreSQL)

Consulta directa de la base de datos para `barberia_id = 198`:

* **Barberos en BD:**
  - ID `439`: "Barbero prueba 4" (`activo: true`)
  - ID `440`: "Barbero Prueba 4.1" (`activo: true`)
  - ID `445`: "barber3" (`activo: false`) ⚠️ *Inactivo*
  - ID `446`: "Barbero de Test" (`activo: false`)
  - ID `447`: "Barbero de Test" (`activo: false`)
  - *Total activos:* **2 barberos**.

* **Servicios en BD:**
  - ID `489`: "Corte Clasico" (`activo: true`)
  - ID `490`: "Barba" (`activo: true`)
  - ID `491`: "Corte + Cejas" (`activo: true`)
  - ID `506`: "Corte de Test" (`activo: false`)
  - ID `507`: "Corte de Test" (`activo: false`)
  - *Total activos:* **3 servicios**.

* **Horarios en BD:**
  - Domingo (0) a Sábado (6): Apertura `08:00:00` - Cierre `20:30:00` (con lunes a las `20:00:00`). Todos marcados `activo: true`.

---

## 5. Tabla Comparativa por Etapa

### Barberos

| Etapa | Count | IDs de Barberos | ¿Incluye `barber3`? | Estatus |
| :--- | :---: | :--- | :---: | :--- |
| 1. **Fuente de verdad (DB)** | 5 | `439` (act), `440` (act), `445` (inact), `446` (inact), `447` (inact) | Sí (pero `activo: false`) | **Canónico** |
| 2. **Editor (Seed / UI)** | 3 | `439`, `440`, `445` | Sí | Activos + Inactivos en UI |
| 3. **PublishPayload (Enviado)** | 5 | `439`, `440`, `445`, `446`, `447` | Sí (anidado en `inherited`) | **Falta en raíz del JSON** ⚠️ |
| 4. **Respuesta pública (API)** | 5 | `439`, `440`, `445`, `446`, `447` | Sí | Devuelve borradores sin filtrar |
| 5. **BA_LANDING_ROUTE_CONTEXT** | 2 | `439`, `440` | **No** | Filtrado por `activo=true` en RPC |
| 6. **DOM Renderizado (V5)** | 2 | `439`, `440` | **No** | Hidratado de contexto |
| 7. **Formulario de Reservas** | 2 | `439`, `440` | **No** | Sincronizado con DOM |

*¿Dónde desaparece barber3?*  
En la **Etapa 3 (PublishPayload)**. Al no enviarse las colecciones en la raíz del JSON desde el editor de producción, la base de datos nunca recibe la orden de persistir el nuevo estado del barbero, manteniéndolo como inactivo (`activo = false`). Posteriormente, en la **Etapa 5**, la RPC `ba_get_landing_publica` lo excluye de forma correcta por no estar activo.

---

### Servicios / Fotos

| Etapa | Count | IDs de Servicios | Fotos (`imagen_url`) |
| :--- | :---: | :--- | :--- |
| 1. **Fuente de verdad (DB)** | 5 | `489` (act), `490` (act), `491` (act), `506` (inact), `507` (inact) | Sí (R2 URLs en activos) |
| 2. **Editor (Seed / UI)** | 3 | `489`, `490`, `491` | Sí (R2 URLs) |
| 3. **PublishPayload (Enviado)** | 5 | `489`, `490`, `491`, `506`, `507` | Sí (anidado en `inherited`) |
| 4. **Respuesta pública (API)** | 5 | `489`, `490`, `491`, `506`, `507` | Sí |
| 5. **BA_LANDING_ROUTE_CONTEXT** | 3 | `489`, `490`, `491` | Sí (R2 URLs) |
| 6. **DOM Renderizado (V5)** | 3 | `489`, `490`, `491` | Sí (R2 URLs) |

*Fotos:* Las URLs de R2 Storage de las imágenes de servicios viajan correctamente por toda la cadena y se renderizan exitosamente en el DOM del tema V5.

---

### Horarios

| Etapa | Días | Rango Horario | Estatus |
| :--- | :---: | :--- | :--- |
| 1. **Fuente de verdad (DB)** | 7 días (0-6) | `08:00:00` - `20:30:00` | **Canónico** |
| 2. **Editor (Seed / UI)** | 7 días | `08:00:00` - `20:30:00` | Correcto |
| 3. **PublishPayload (Enviado)** | 7 días | `08:00:00` - `20:30:00` | Nested |
| 4. **Respuesta pública (API)** | 0 | `[]` | Vacío en fallback de webhook |
| 5. **BA_LANDING_ROUTE_CONTEXT** | 7 | `08:00:00` - `20:30:00` | Enviado pero ignorado por mismatch |
| 6. **Formulario de Reservas** | 6 (L-S) | `09:00` - `19:00` (L-S) | Fallback estático hardcodeado ⚠️ |

*¿Dónde se pierden los horarios en la landing pública?*  
En la **Etapa 5 (BA_LANDING_ROUTE_CONTEXT)**. El contexto trae el array completo con la llave `dia_semana: 0-6`. Sin embargo, la plantilla V5 espera el día con la propiedad `dia` (ej. "lunes", "martes"). Al no mapearse el índice numérico, todos los horarios reales se evalúan como inválidos y el formulario de reservas cae en el fallback estático (Lunes-Sábado 9:00 - 19:00, Domingos cerrados).

---

## 6. Payload Real de Publicación (PublishPayload en Producción)

El editor de producción envía este JSON incompleto a `/api/editor/publish`:
```json
{
  "barberia_id": 198,
  "slug": "barberia-prueba-4",
  "direccion": "Calle 131#101-10",
  "template_id": "v5",
  "inherited": {
    "barberia_id": 198,
    "slug": "barberia-prueba-4",
    "servicios": [ ... ],
    "barberos": [ ... ],
    "horarios": [ ... ]
  },
  "branding": { ... },
  "profile": { ... },
  "barberia": { ... },
  "landing_publish": { ... }
}
```
*(Faltan `servicios`, `barberos` y `horarios` en el primer nivel del JSON payload).*

---

## 7. Respuesta de `ba_get_landing_publica` (Inyectado en context)

El contexto inyectado en `/b/barberia-prueba-4` devuelve:
```json
{
  "ok": true,
  "barberia": {
    "id": 198,
    "slug": "barberia-prueba-4",
    "nombre": "Barberia Prueba 4"
  },
  "barberos": [
    { "id": 439, "nombre": "Barbero prueba 4", "foto_url": "..." },
    { "id": 440, "nombre": "Barbero Prueba 4.1", "foto_url": "..." }
  ],
  "servicios": [
    { "id": 489, "nombre": "Corte Clasico", "precio": 20000, "imagen_url": "..." },
    { "id": 490, "nombre": "Barba", "precio": 12000, "imagen_url": "..." },
    { "id": 491, "nombre": "Corte + Cejas", "precio": 15000, "imagen_url": "..." }
  ],
  "horarios": [
    { "activo": true, "hora_abre": "08:00:00", "dia_semana": 0, "hora_cierra": "20:30:00" },
    ...
  ]
}
```

---

## 8. Punto Exacto de la Ruptura e Identificación de Causa Raíz

1. **Ruptura de Barberos y Servicios:** Ocurre entre el **Editor de producción** y el **Backend**. El editor de producción no incluye el fix local en `buildSavePayload()`, por lo que las colecciones no viajan en el nivel raíz del JSON. El backend al procesar la publicación no actualiza las tablas canónicas en Postgres. `barber3` permanece inactivo (`activo = false`) y no es devuelto por la consulta pública.
2. **Ruptura de Horarios en Formulario:** Ocurre en el **Cliente (V5 HTML)**. El validador `normalizeSeedHour(item)` no reconoce el formato de la columna `dia_semana` numérico que sirve el RPC, lo que causa que descarte toda la grilla de horarios de Postgres y active el fallback estático del formulario.

---

## 9. Fix Mínimo Recomendado

1. **Copiar y Actualizar el Editor en WordPress:**  
   Se debe copiar el código local corregido de `project/templates/editor/landing_editor_v2_unico_vscode.html` que expone los arrays de colecciones en la raíz del payload:
   ```javascript
   return {
     ...payload,
     ...publishedUrls,
     landing_publish: landingPublish,
     servicios: inheritedCollections.services,
     barberos: inheritedCollections.barbers,
     horarios: inheritedCollections.hours
   };
   ```

2. **Corregir Normalización de Horarios en Plantillas HTML (incluida V5):**  
   Modificar `normalizeSeedHour(item)` en las plantillas HTML para procesar el índice numérico `dia_semana` recibido en el contexto:
   ```javascript
   function normalizeSeedHour(item) {
     if (!item || typeof item !== 'object') return null;
     const dayLabels = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
     const idx = Number.isInteger(Number(item.dia_semana)) ? Number(item.dia_semana) : null;
     const dia = normalizeDayLabel(item.dia || item.day || item.nombre_dia || (idx !== null ? dayLabels[idx] : ''));
     const horaAbre = safeSeedText(item.hora_abre || item.apertura);
     const horaCierra = safeSeedText(item.hora_cierra || item.cierre);
     if (!dia || !horaAbre || !horaCierra) return null;
     return { dia, activo: item.activo !== false, hora_abre: horaAbre, hora_cierra: horaCierra };
   }
   ```

---

## 10. Confirmación de Reglas de Producción

* **No se modificó código funcional** (El diagnóstico se realizó en vivo mediante análisis de red y consultas SQL de lectura).
* **DB/n8n/EasyPanel permanecieron intactos.**

---

## 11. Decisión de Auditoría

`BUG V5 — CAUSA RAÍZ IDENTIFICADA`
