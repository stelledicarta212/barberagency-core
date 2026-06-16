# Diagnóstico DX: Hidratación de Imágenes de Servicios en Editor y Landing Pública

**Fecha y Hora:** 2026-06-16T17:32:00-05:00  
**Barbería ID de prueba:** `198`  
**Slug de prueba:** `barberia-prueba-4`  

---

## 1. Causa Raíz Exacta (Evidencia)

El problema de la pérdida de imágenes en los servicios durante el flujo de hidratación y publicación tiene su origen en el **contrato de datos del backend (n8n)**.

Al consultar el webhook público utilizado para la hidratación:
`https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/landing/public?slug=barberia-prueba-4`

### Contrato JSON Real (Omitiendo Campos Críticos)
El JSON devuelto bajo la clave `servicios` es el siguiente:
```json
"servicios": [
  {"icono": "bi-scissors", "nombre": "Corte Clasico", "precio": 20000, "id_servicio": 489, "duracion_min": 30},
  {"icono": "bi-scissors", "nombre": "Barba", "precio": 12000, "id_servicio": 490, "duracion_min": 30},
  {"icono": "bi-scissors", "nombre": "Corte + Cejas", "precio": 15000, "id_servicio": 491, "duracion_min": 30},
  {"icono": "bi-scissors", "nombre": "Corte de Test", "precio": 15000, "id_servicio": 506, "duracion_min": 30},
  {"icono": "bi-scissors", "nombre": "Corte de Test", "precio": 15000, "id_servicio": 507, "duracion_min": 30}
]
```

### Ubicación del Filtro / Pérdida en n8n
Inspeccionando la definición del nodo SQL de PostgreSQL `Fetch public landing` (encontrado en `scratch/wf_emtplPl0fdBdqqRL.json` línea 42):
```sql
), servicios_json AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id_servicio', s.id,
        'nombre', s.nombre,
        'precio', s.precio,
        'duracion_min', COALESCE(s.duracion_min, 45),
        'icono', 'bi-scissors' -- Hardcoded fallback icon
      )
      ORDER BY s.id
    ),
    '[]'::jsonb
  ) AS servicios
  FROM servicios s
  WHERE s.barberia_id = (SELECT barberia_id FROM resolved_profile)
)
```
* **Diagnóstico:** La consulta SQL en el flujo de n8n construye explícitamente el objeto JSON para cada servicio omitiendo por completo la columna `imagen_url` (u otra columna de imagen/foto) del esquema de la tabla `public.servicios`. Adicionalmente, sobreescribe el campo `icono` fijándolo en `'bi-scissors'`.
* **Barberos:** De forma similar, el nodo de barberos asocia una foto vacía (`'foto', ''`), forzando al frontend a utilizar imágenes de barberos de relleno.

### Contrato de la Base de Datos Real (PostgREST)
Al consultar directamente a través del API público de PostgREST (`https://api.agencia2c.cloud/servicios?barberia_id=eq.198`):
```json
[
  {
    "id": 489,
    "barberia_id": 198,
    "nombre": "Corte Clasico",
    "duracion_min": 30,
    "precio": 20000,
    "activo": true,
    "imagen_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg"
  }
]
```
* **Evidencia:** Las imágenes reales sí existen en la base de datos bajo la columna `imagen_url`.

---

## 2. Solución Aplicada (Estrategia Frontend-First)

Dado que **no se debe modificar el backend, n8n, ni la base de datos directamente**, implementamos una solución de enriquecimiento reactivo en el cliente.

### 2.1 Enriquecimiento de Datos Asíncrono
Se creó una función de ayuda global en las plantillas HTML para consultar las imágenes correspondientes a través de la API pública de PostgREST y fusionarlas con los servicios hidratados:

```javascript
async function enrichPayloadServicesWithDbImages(payload, bId) {
  if (bId && payload && Array.isArray(payload.servicios) && payload.servicios.length > 0) {
    try {
      const dbRes = await fetch(`https://api.agencia2c.cloud/servicios?barberia_id=eq.${bId}`, {
        headers: { Accept: 'application/json' }
      });
      if (dbRes.ok) {
        const dbServices = await dbRes.json().catch(() => []);
        if (Array.isArray(dbServices) && dbServices.length > 0) {
          payload.servicios = payload.servicios.map(s => {
            const sId = Number(s.id_servicio || s.servicio_id || s.id);
            const match = dbServices.find(ds => Number(ds.id) === sId);
            if (match && match.imagen_url) {
              return {
                ...s,
                imagen_url: match.imagen_url,
                image_url: match.imagen_url,
                foto_url: match.imagen_url,
                image: match.imagen_url
              };
            }
            return s;
          });
        }
      }
    } catch (e) {
      console.warn('Error enriching services:', e);
    }
  }
}
```

### 2.2 Integración en Flujo de Plantillas
Este enriquecimiento se integró de forma transparente tanto en la hidratación inicial por servidor/ruta como en la hidratación bajo demanda de `hydrateLandingFromPublicEndpoint`. 

Para evitar bloqueos visuales o demoras en el Render de la Landing:
1. Se pinta el contenido textual y de estructura inmediatamente (enfoque progresivo).
2. Se realiza el fetch asíncrono a la API CORS-friendly de PostgREST en background.
3. Al recibir la respuesta, se actualizan las imágenes y se fuerza un nuevo re-render de la sección de servicios en caliente (`renderServices`).

### 2.3 Manejador de Error/Fallback en Plantilla V2
En `index_unico_v2.html`, la lógica original eliminaba el nodo de la imagen si esta fallaba (`onerror="this.onerror=null;this.remove();"`). Se corrigió para que si una imagen falla al cargar, esta sea reemplazada por el contenedor con el icono correspondiente en lugar de desaparecer:
```javascript
onerror="this.onerror=null; const div = document.createElement('div'); div.className = 'icon-dot mb-3'; div.innerHTML = '<i class=&quot;bi ${s.icono}&quot;></i>'; this.replaceWith(div);"
```

---

## 3. Archivos Modificados

Los cambios han sido aplicados en las siguientes plantillas dentro de `barberagency-core`:
1. [EsenciaPremiun.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/EsenciaPremiun.html)
2. [index_unico_v2.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v2.html)
3. [index_unico_v3_nueva.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v3_nueva.html)
4. [index_unico_v4_editorial.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v4_editorial.html)
5. [index_unico_v5_1_azul_rojo_elegante.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html)
6. [index_unico_v6_negro_dorado.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unico_v6_negro_dorado.html)
7. [index_unicov7.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/index_unicov7.html)
8. [pruebas.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/plantillas/pruebas.html)

---

## 4. Pruebas y Validación

* **Validación de Compilación/Sintaxis:**  
  * `npm run lint` en `panel_de_barberia`: **PASS** (0 errores, 15 warnings de optimizaciones menores).  
  * `npm run build` en `panel_de_barberia`: **PASS** (Compilación Next.js y TypeScript exitosa).
* **Validación de Contratos de Publicación/Draft:**  
  Confirmamos que los endpoints intermedios `/api/editor/publish` y `/api/editor/draft` reenvían intacto el payload de servicios que genera el editor, preservando las URLs de imagen si se editan/publican en el frontend.

---

## 5. Próximos Pasos Recomendados

1. **Corrección del Backend (A Futuro):**  
   Cuando sea permitido editar flujos de n8n, se debe actualizar el nodo SQL `Fetch public landing` para agregar la columna `imagen_url` al `jsonb_build_object` de servicios, y la columna `foto_url` al de barberos.
2. **Despliegue y Pruebas en Vivo:**  
   Subir cambios a producción y validar que los servicios muestren sus imágenes reales en el editor e iframe y al visitar la ruta pública de `/b/barberia-prueba-4`.
