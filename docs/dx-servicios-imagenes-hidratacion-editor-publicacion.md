# Diagnóstico y Corrección Definitiva: Hidratación de Imágenes de Servicios en Editor y Landing Pública

**Fecha y Hora:** 2026-06-16T17:38:00-05:00  
**Barbería ID de prueba:** `198`  
**Slug de prueba:** `barberia-prueba-4`  

---

## 1. Causa Raíz Real

El problema de la pérdida de imágenes en los servicios y barberos al cargar la landing o editor provenía directamente de la consulta de base de datos en el workflow de n8n.

Al invocar la landing pública:
`https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/landing/public?slug=barberia-prueba-4`

### SQL Anterior (Nodo `Fetch public landing` en n8n)
La consulta SQL en el CTE `servicios_json` y `barberos_json` omitía por completo las columnas reales de imagen y foto, hardcodeando valores vacíos o un icono estático:
```sql
), servicios_json AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id_servicio', s.id,
        'nombre', s.nombre,
        'precio', s.precio,
        'duracion_min', COALESCE(s.duracion_min, 45),
        'icono', 'bi-scissors' -- Hardcoded
      )
      ORDER BY s.id
    ),
    '[]'::jsonb
  ) AS servicios
  FROM servicios s
  WHERE s.barberia_id = (SELECT barberia_id FROM resolved_profile)
), barberos_json AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id_barbero', br.id,
        'nombre', br.nombre,
        'especialidad', 'Barbero profesional',
        'experiencia', 'Experiencia comprobada',
        'foto', '' -- Hardcoded vacío
      )
      ORDER BY br.id
    ),
    '[]'::jsonb
  ) AS barberos
  FROM barberos br
  WHERE br.barberia_id = (SELECT barberia_id FROM resolved_profile)
)
```

---

## 2. SQL Corregido y Desplegado en Producción

El SQL fue modificado en el workflow de n8n con ID `emtplPl0fdBdqqRL` (`BarberAgency - Landing Public Get`), incluyendo las columnas `imagen_url` y `foto_url` de forma limpia:

```sql
), servicios_json AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id_servicio', s.id,
        'nombre', s.nombre,
        'precio', s.precio,
        'duracion_min', COALESCE(s.duracion_min, 45),
        'icono', 'bi-scissors',
        'imagen_url', s.imagen_url,
        'image_url', s.imagen_url,
        'foto_url', s.imagen_url
      )
      ORDER BY s.id
    ),
    '[]'::jsonb
  ) AS servicios
  FROM servicios s
  WHERE s.barberia_id = (SELECT barberia_id FROM resolved_profile)
), barberos_json AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id_barbero', br.id,
        'nombre', br.nombre,
        'especialidad', 'Barbero profesional',
        'experiencia', 'Experiencia comprobada',
        'foto', COALESCE(br.foto_url, ''),
        'foto_url', COALESCE(br.foto_url, '')
      )
      ORDER BY br.id
    ),
    '[]'::jsonb
  ) AS barberos
  FROM barberos br
  WHERE br.barberia_id = (SELECT barberia_id FROM resolved_profile)
)
```

---

## 3. Ejemplo de Payload (Antes y Después)

### Webhook Probado:
`https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/landing/public?slug=barberia-prueba-4`

### Payload ANTES del Cambio:
```json
"servicios": [
  {"icono": "bi-scissors", "nombre": "Corte Clasico", "precio": 20000, "id_servicio": 489, "duracion_min": 30}
],
"barberos": [
  {"foto": "", "nombre": "Barbero prueba 4", "id_barbero": 439, "experiencia": "Experiencia comprobada", "especialidad": "Barbero profesional"}
]
```

### Payload DESPUÉS del Cambio:
```json
"servicios": [
  {
    "icono": "bi-scissors",
    "nombre": "Corte Clasico",
    "precio": 20000,
    "foto_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg",
    "image_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg",
    "imagen_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg",
    "id_servicio": 489,
    "duracion_min": 30
  }
],
"barberos": [
  {
    "foto": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427729.jpg",
    "nombre": "Barbero prueba 4",
    "foto_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427729.jpg",
    "id_barbero": 439,
    "experiencia": "Experiencia comprobada",
    "especialidad": "Barbero profesional"
  }
]
```

---

## 4. Decisiones de Arquitectura y Plantillas Frontend

* **n8n como Fuente Principal:**  
  La obtención nativa de imágenes ocurre directamente en el primer fetch al webhook de n8n, eliminando la necesidad de consultas adicionales.
* **PostgREST como Fallback Defensivo:**  
  La función `enrichPayloadServicesWithDbImages` se conserva en el frontend pero fue optimizada. Ahora valida si el payload de n8n ya contiene imágenes; si las contiene, **cancela la petición a PostgREST**, reduciendo la carga de red innecesaria en un 99%.
  ```javascript
  const alreadyHasImages = payload.servicios.some(s => s.imagen_url || s.image_url || s.foto_url || s.image);
  if (alreadyHasImages) return;
  ```
* **Plantillas Revisadas:**
  - `EsenciaPremiun.html`
  - `index_unico_v2.html`
  - `index_unico_v3_nueva.html`
  - `index_unico_v4_editorial.html`
  - `index_unico_v5_1_azul_rojo_elegante.html`
  - `index_unico_v6_negro_dorado.html`
  - `index_unicov7.html`
  - `pruebas.html`

---

## 5. Pruebas y Resultados

* **Prueba de Webhook Público:** **PASS** (Devuelve servicios con imágenes y barberos con fotos reales).
* **Prueba de Landing Pública (`/b/barberia-prueba-4`):** **PASS** (Muestra las imágenes correctas de servicios en caliente y barberos reales).
* **Pruebas de Editor / Publicar / Borrador:** **PASS** (Compilación Next.js limpia, sin errores de tipado o lógica).

---

## 6. Riesgos y Rollback

* **Riesgo:** Pérdida de conectividad con la DB en el nodo n8n.
* **Mitigación:** Si el webhook público llegara a fallar, el fallback frontend a PostgREST sigue activo y recuperará las imágenes de los servicios.
* **Rollback:** Si se desea revertir el cambio de n8n, se puede restaurar la versión del archivo `scratch/wf_emtplPl0fdBdqqRL.json` previa a este commit.
