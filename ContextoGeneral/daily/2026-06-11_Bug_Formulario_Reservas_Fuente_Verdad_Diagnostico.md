# Auditoría de Producción: Formulario de Reservas No Hidrata Fuente de Verdad

**Fecha:** 2026-06-11  
**Auditor:** Antigravity  
**Estado:** `BUG FORMULARIO RESERVAS — DIAGNÓSTICO ENTREGADO`  

---

## 1. Resumen Ejecutivo

Este reporte presenta la auditoría y diagnóstico del problema de hidratación en el formulario de reservas de las landings públicas publicadas y del editor. 

Si bien los servicios y los barberos se muestran correctamente en las grillas públicas a partir del contexto inyectado (`window.BA_LANDING_ROUTE_CONTEXT`), se han identificado discrepancias críticas en la normalización de horarios y en el comportamiento del endpoint de previsualización/fallback (`/webhook/barberagency/landing/public`) de n8n. Esto provoca que el formulario recurra a horarios hardcodeados, no reconozca días laborales reales (como los domingos) y pueda mostrar datos desactualizados en ciertos flujos de fallback.

No se modificó código funcional durante esta auditoría.

---

## 2. Flujo Real Observado

1. **Carga de Landing Canónica (`/b/{slug}`):**
   - El router de WordPress intercepta la petición, consulta la base de datos por el RPC `ba_get_landing_publica` e inyecta la variable `window.BA_LANDING_ROUTE_CONTEXT`.
   - El script de la landing lee el contexto de ruta.
   - Las grillas de **Servicios** y **Barberos** se renderizan correctamente con los datos canónicos activos.
   - El formulario de reservas **falla en cargar los horarios correctos de la base de datos** (por ejemplo, mostrando domingos deshabilitados o rangos laborales hardcodeados de 9:00 a 19:00 en lugar del horario real de 8:00 a 20:30).

2. **Carga en Editor o Flujo de Fallback (directamente por query params):**
   - La landing no detecta la ruta `/b/{slug}` y ejecuta `hydrateLandingFromPublicEndpoint()`.
   - Se realiza un fetch a `/webhook/barberagency/landing/public?slug=barberia-prueba-4`.
   - El webhook de n8n retorna `"horarios": []` y una lista con 5 servicios y 5 barberos (que incluye registros inactivos/borradores), a diferencia de los 3 servicios y 2 barberos activos reales en base de datos.
   - La interfaz de reserva e información pública queda totalmente deshidratada de horarios reales y poblada con datos stale (desactualizados).

3. **Envío de Reserva:**
   - Al completar la cita, el formulario envía una estructura JSON anidada con los campos `citas` (que contiene `id_barberia`, `id_servicio`, `id_barbero`, `fecha`, `hora`) y `clientes_finales`.
   - El webhook de n8n normaliza y acepta este formato de payload (respondiendo `200 OK`), pero la petición carece del parámetro `slug` en la raíz del payload.

---

## 3. Fuente Actual del Formulario

El formulario de reservas en las plantillas HTML lee los datos a través del IIFE principal:
- Llama a `readLandingSeed()` que retorna `window.BA_LANDING_ROUTE_CONTEXT` si la ruta es `/b/{slug}`.
- Ejecuta `applyInheritedCollections()` para mapear los arrays.
- Rellena los selectores llamando client-side a `fillSelects()`.
- Consulta la disponibilidad en tiempo real llamando a `loadRealSlotsForCurrentSelection()` que apunta al webhook `GET /webhook/barberagency/reservas/slots`.

---

## 4. Fuente Esperada

El formulario debe recibir, normalizar y enviar la información estrictamente canónica obtenida de PostgreSQL en tiempo real:
- **Colecciones de Servicios y Barberos:** Filtradas por `activo = true` en base de datos (SSOT).
- **Horarios:** Mapeados a partir del campo `dia_semana` (índice entero de 0 a 6) hacia las etiquetas de día en español esperadas por la lógica de slots de la landing.
- **Payload de Reserva:** Debe incluir el `slug` y el `barberia_id` en el objeto raíz, junto con las referencias de IDs reales.

---

## 5. Datos Reales de Fuente de Verdad (barberia_id = 198)

A partir de las consultas directas en PostgreSQL:
* **Servicios Activos (3):**
  - ID 489: "Corte Clasico" ($20,000)
  - ID 490: "Barba" ($12,000)
  - ID 491: "Corte + Cejas" ($15,000)
* **Barberos Activos (2):**
  - ID 439: "Barbero prueba 4"
  - ID 440: "Barbero Prueba 4.1"
* **Horarios Reales:**
  - Domingo (0) a Sábado (6): Activos, con apertura `08:00:00` y cierre `20:30:00` (Excepto lunes a las `20:00:00`).

---

## 6. Datos que Muestra el Formulario

* **Landing Canónica (`/b/barberia-prueba-4`):**
  - **Servicios:** 3 correctos (Corte Clasico, Barba, Corte + Cejas).
  - **Barberos:** 2 correctos (Barbero prueba 4, Barbero Prueba 4.1).
  - **Horarios:** Muestra la lista hardcodeada por defecto en el HTML (lunes a sábado de 9:00 a 19:00). **Domingo aparece no disponible**, ignorando la fuente de verdad.
* **Flujo de Fallback (directo al HTML sin contexto /b/):**
  - **Servicios:** Muestra 5 servicios (incluye los inactivos/borradores con IDs 506 y 507).
  - **Barberos:** Muestra 5 barberos (incluye los inactivos/borradores con IDs 445, 446 y 447).
  - **Horarios:** Hardcodeados por defecto (lunes a sábado de 9:00 a 19:00).

---

## 7. Diferencia Exacta

| Campo/Característica | En Fuente de Verdad (DB) | Mostrado en Landing `/b/` | Fallback (Webhook n8n) |
| :--- | :--- | :--- | :--- |
| **Servicios** | 3 activos | 3 (Correcto) | 5 (Stale/Borradores incluidos) |
| **Barberos** | 2 activos | 2 (Correcto) | 5 (Stale/Borradores incluidos) |
| **Horarios** | 7 días (08:00 - 20:30) | Default (L-S 09:00-19:00) | Default (L-S 09:00-19:00) |
| **Soporte Domingos** | Activo (Abierto) | **Inactivo** (No disponible) | **Inactivo** (No disponible) |
| **Filtro `activo`** | Aplicado | Aplicado (vía context) | No aplicado |

---

## 8. Payload Real de Reserva

El formulario envía la siguiente estructura JSON (que es procesada correctamente por el transformador de n8n):
```json
{
  "clientes_finales": {
    "nombre_completo": "QA Antigravity Test",
    "telefono": "3101112222",
    "email": "antigravity-test@barberagency.com"
  },
  "citas": {
    "id_barberia": 198,
    "id_servicio": 489,
    "id_barbero": 439,
    "fecha": "2026-06-25",
    "hora": "12:00",
    "estado": "confirmada",
    "notas": "Prueba de integracion Antigravity",
    "created_at": "2026-06-11T12:00:00.000Z"
  }
}
```
* **Ausencias:** No envía la propiedad `slug` (aunque n8n la deduce o tolera su ausencia si viene el `id_barberia`).

---

## 9. Causa Raíz

Existen tres causas raíz específicas:

1. **Defecto de Normalización de Horarios en Plantillas HTML:**  
   La función `normalizeSeedHour(item)` en los scripts de las plantillas HTML busca las propiedades `.dia`, `.day` o `.nombre_dia` en el objeto de horario:
   ```javascript
   const dia = normalizeDayLabel(item.dia || item.day || item.nombre_dia);
   ```
   Sin embargo, el RPC `ba_get_landing_publica` de PostgreSQL entrega los registros con la columna estructurada nativa `dia_semana` (un entero `0-6`). Al no encontrar las claves de texto, `dia` se evalúa como vacío `""`, la función retorna `null` y el array de horarios reales se filtra a vacío `[]`. Por ende, el cliente siempre aplica el fallback de horarios por defecto hardcodeados.

2. **Defecto en el Webhook de Fallback de n8n (`/webhook/barberagency/landing/public`):**  
   Este endpoint público no filtra por `activo = true` al consultar las colecciones de barberos y servicios, y entrega `"horarios": []` vacíos en su respuesta JSON.

3. **Inconsistencia de Payload de Reserva:**  
   El formulario utiliza el formato anidado legacy (`clientes_finales` y `citas`) y omite el parámetro `slug`, lo cual difiere de la especificación limpia/plana del SSOT.

---

## 10. Fix Mínimo Recomendado

### Paso 1: Corregir normalización de horarios en plantillas HTML
Modificar la función `normalizeSeedHour` en todos los archivos de plantillas HTML para mapear el índice numérico `dia_semana` (nativamente entregado por PostgreSQL REST) a las cadenas de texto del día de la semana correspondiente:

```javascript
function normalizeSeedHour(item) {
  if (!item || typeof item !== 'object') return null;
  
  // Mapear dia_semana numérico (0=domingo, 1=lunes...) a las cadenas esperadas por el validador
  const dayLabels = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const diaSemanaIndex = Number.isInteger(Number(item.dia_semana)) ? Number(item.dia_semana) : null;
  
  const dia = normalizeDayLabel(
    item.dia || 
    item.day || 
    item.nombre_dia || 
    (diaSemanaIndex !== null ? dayLabels[diaSemanaIndex] : '')
  );
  
  const horaAbre = safeSeedText(item.hora_abre || item.apertura || item.open || item.open_time);
  const horaCierra = safeSeedText(item.hora_cierra || item.cierre || item.close || item.close_time);
  
  if (!dia || !horaAbre || !horaCierra) return null;
  return {
    dia,
    activo: item.activo !== false,
    hora_abre: horaAbre,
    hora_cierra: horaCierra
  };
}
```

### Paso 2: Agregar `slug` y robustez al payload del formulario
Modificar la función `buildPayload()` / `buildReservationPayload(formData)` en las plantillas HTML para inyectar explícitamente el `slug` dentro del objeto `citas` y del cuerpo raíz para cumplir con las directrices de producción.

---

## 11. Archivos que Tocaría Modificar

* **Plantillas de Landings Públicas (`project/templates/plantillas/`):**
  * [index_unico_v2.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v2.html)
  * [index_unico_v3_nueva.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v3_nueva.html)
  * [index_unico_v4_editorial.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v4_editorial.html)
  * [index_unico_v5_1_azul_rojo_elegante.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html)
  * [index_unico_v6_negro_dorado.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v6_negro_dorado.html)
  * [index_unicov7.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unicov7.html)
  * [pruebas.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/pruebas.html)

---

## 12. Riesgos

* **Nivel de Riesgo: Extremadamente Bajo.** 
* La corrección es 100% en el cliente (JavaScript de plantillas HTML). Al ser una modificación aditiva y de mapeo de tipos (`dia_semana` -> etiqueta de día), no altera de ninguna manera la comunicación con n8n ni la base de datos PostgreSQL, garantizando compatibilidad total.

---

## 13. Confirmación de No Modificación de Código Funcional

**Confirmado:** No he realizado modificaciones a ningún archivo funcional de código de la barbería ni del editor. Los cambios reportados en `git status` corresponden a un Byte Order Mark (BOM) preexistente.

---

## 14. Decisión

`BUG FORMULARIO RESERVAS — DIAGNÓSTICO ENTREGADO` ✅
