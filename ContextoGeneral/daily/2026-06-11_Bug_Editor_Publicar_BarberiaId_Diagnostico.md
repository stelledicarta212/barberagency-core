# Diagnóstico de Error al Publicar Editor: barberia_id requerido

**Fecha:** 2026-06-11  
**Auditor:** Antigravity  
**Estado:** `BUG PUBLICAR EDITOR — DIAGNÓSTICO ENTREGADO`

---

## 1. Resumen Ejecutivo

Este reporte detalla la auditoría y diagnóstico del error `"No se pudo publicar: barberia_id requerido"` que ocurre al pulsar el botón **"Publicar"** dentro del editor `landing_editor_v2`.

Aunque la URL del editor y la semilla `ba_landing_seed` en el almacenamiento local contienen la identidad correcta de la barbería (`barberia_id=198`), el endpoint de proxy del servidor de Next.js (`/api/editor/publish`) responde con un error `400 Bad Request` indicando que el `barberia_id` es requerido.

Se determinó que la causa raíz es una discrepancia de formato entre cómo el frontend serializa el cuerpo de la petición POST para publicar (envolviendo el payload dentro del parámetro `"p_payload"`) y cómo las funciones de validación del proxy Next.js extraen el `barberia_id` y el `slug` (buscando únicamente en la raíz del cuerpo JSON).

---

## 2. Flujo Real Observado

1. **Hidratación correcta del editor:** El editor carga de forma exitosa, poblando la interfaz con los servicios, horarios, barberos e identidad de la barbería (`barberia_id=198` y `slug=barberia-prueba-4`).
2. **Acción de publicación:** El usuario pulsa el botón **"Publicar"** en la esquina superior derecha.
3. **Petición del frontend:** El handler `publishLanding()` en el editor serializa el diseño de la landing y hace un `POST` al endpoint del proxy `/api/editor/publish`.
4. **Respuesta de error:** El proxy responde inmediatamente con `HTTP 400 Bad Request` y un cuerpo JSON `{ "ok": false, "code": "barberia_id_requerido", "message": "barberia_id requerido" }`.
5. **Alerta visual:** El frontend captura este error y muestra la alerta `"No se pudo publicar: barberia_id requerido"`.

---

## 3. URL Exacta del Editor
`https://barberagency-barberagency.gymh5g.easypanel.host/landing_editor_v2/?barberia_id=198&slug=barberia-prueba-4&edit=1&mode=editar&mode=edit&is_edit=1`

---

## 4. Valores Reales de Query Params

* `barberia_id`: `"198"`
* `slug`: `"barberia-prueba-4"`
* `edit`: `"1"`
* `mode`: `["editar", "edit"]` *(Parámetro duplicado por compatibilidad legacy)*
* `is_edit`: `"1"`

---

## 5. Contenido Relevante de `ba_landing_seed`

El objeto deserializado del `sessionStorage` (o `localStorage`) contiene la identidad estructurada correctamente:
```json
{
  "source": "onboarding_complete",
  "barberia_id": 198,
  "id_barberia": 198,
  "id": 198,
  "slug": "barberia-prueba-4",
  "barberia": {
    "id": 198,
    "slug": "barberia-prueba-4",
    "nombre": "Barberia Prueba 4"
  }
}
```

---

## 6. Payload Real Enviado al Publicar

El frontend envía la petición al backend con el siguiente cuerpo (body) serializado:
```json
{
  "p_payload": {
    "barberia_id": 198,
    "slug": "barberia-prueba-4",
    "site_base_url": "https://barberagency-barberagency.gymh5g.easypanel.host",
    "direccion": "Calle de Prueba 123",
    "template_id": "template_1",
    "branding": {
      "logo_url": "https://...",
      "cover_url": "https://..."
    },
    "landing_publish": {
      "barberia_id": 198,
      "slug": "barberia-prueba-4",
      "template_id": "template_1"
    }
  }
}
```

---

## 7. Endpoint Llamado
* **URL:** `https://barberagency-app.gymh5g.easypanel.host/api/editor/publish` (Proxy Same-Origin de Next.js)
* **Método:** `POST`

---

## 8. Respuesta/Error Exacto
* **Status:** `400 Bad Request`
* **Headers:** `Content-Type: application/json`
* **Body:**
  ```json
  {
    "ok": false,
    "code": "barberia_id_requerido",
    "message": "barberia_id requerido"
  }
  ```

---

## 9. Ubicación Exacta del Código de Validación

El mensaje es devuelto por el middleware/validador de sesión de Next.js en el archivo:  
[panel_de_barberia/src/app/api/editor/auth.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/src/app/api/editor/auth.ts)

Específicamente en las líneas 124 a 135:
```typescript
  const barberiaId = resolvePayloadBarberiaId(payload);
  if (!barberiaId) {
    return {
      ok: false,
      status: 400,
      body: {
        ok: false,
        code: "barberia_id_requerido",
        message: "barberia_id requerido"
      }
    };
  }
```

Y el extractor de ID está definido en las líneas 83 a 86 del mismo archivo:
```typescript
function resolvePayloadBarberiaId(payload: Record<string, unknown>): number | null {
  const id = Number(payload.barberia_id ?? payload.p_barberia_id ?? payload.draft_seed_barberia_id ?? 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}
```

---

## 10. Diferencia entre lo que se Tiene y lo que se Envía

* El frontend **sí tiene** el `barberia_id=198` en la URL y la semilla.
* El frontend **sí lo envía** en el cuerpo de la petición POST, pero **envuelto** bajo el objeto contenedor `"p_payload"` (requerido por compatibilidad con los endpoints RPC de PostgreSQL/PostgREST consumidos a través de n8n).
* El validador del backend Next.js **espera que la clave esté en la raíz** del cuerpo JSON (`payload.barberia_id`) e ignora la envoltura `p_payload`.

---

## 11. Causa Raíz

La causa raíz es que la función de extracción `resolvePayloadBarberiaId` (y su homóloga `resolvePayloadSlug`) en el backend de Next.js **no inspecciona la clave contenedor `p_payload`** cuando el cuerpo de la petición viene formateado para un RPC de publicación. 

Dado que el botón de **"Guardar Borrador"** envía la data plana (`body: JSON.stringify(draft)`), este funciona correctamente porque las claves quedan en la raíz del JSON. En cambio, el botón de **"Publicar"** envía el formato envuelto (`body: JSON.stringify({ p_payload: publishPayload })`), lo que rompe la validación del backend Next.js.

---

## 12. Fix Mínimo Recomendado

Modificar las funciones de resolución de payload en [panel_de_barberia/src/app/api/editor/auth.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/src/app/api/editor/auth.ts) para que den soporte a la envoltura `p_payload` si esta se encuentra presente:

```typescript
function resolvePayloadBarberiaId(payload: Record<string, unknown>): number | null {
  const innerPayload = isRecord(payload.p_payload) ? payload.p_payload : null;
  const id = Number(
    payload.barberia_id ?? 
    payload.p_barberia_id ?? 
    payload.draft_seed_barberia_id ?? 
    innerPayload?.barberia_id ?? 
    innerPayload?.p_barberia_id ?? 
    innerPayload?.draft_seed_barberia_id ?? 
    0
  );
  return Number.isFinite(id) && id > 0 ? id : null;
}

function resolvePayloadSlug(payload: Record<string, unknown>): string | null {
  const innerPayload = isRecord(payload.p_payload) ? payload.p_payload : null;
  const slug = safeText(
    payload.slug ?? 
    payload.biz_slug ?? 
    payload.draft_seed_slug ?? 
    innerPayload?.slug ?? 
    innerPayload?.biz_slug ?? 
    innerPayload?.draft_seed_slug
  );
  return slug || null;
}
```

---

## 13. Archivos a Modificar

* `panel_de_barberia`:
  * [src/app/api/editor/auth.ts](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/panel_de_barberia/src/app/api/editor/auth.ts)

---

## 14. Riesgos de Producción

* **Bajo impacto y nulo:** Esta modificación es puramente aditiva y de compatibilidad para el validador del backend. No altera las políticas de seguridad (RLS), mantiene la restricción de validación basada en sesión activa (`ba_session`), y permite que tanto el guardado de borradores como la publicación pasen el filtro de propiedad del tenant correctamente.

---

## 15. Confirmación de No Modificación de Código Funcional
**Confirmado:** No he realizado modificaciones en ningún archivo funcional de código de la barbería ni del editor. Solo se ha creado y guardado este reporte de diagnóstico.

---

## 16. Decisión

`BUG PUBLICAR EDITOR — DIAGNÓSTICO ENTREGADO` ✅
