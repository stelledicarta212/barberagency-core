# Diagnóstico y Corrección Definitiva: Hidratación de Imágenes de Servicios en Editor y Landing Pública

**Fecha y Hora:** 2026-06-16T18:15:00-05:00  
**Barbería ID de prueba:** `198`  
**Slug de prueba:** `barberia-prueba-4`  

---

## 1. Causa Raíz Diagnosticada en Caliente

A pesar de que el webhook público n8n (`/webhook/barberagency/landing/public?slug=barberia-prueba-4`) y el endpoint del panel `/api/dashboard/state` ya devolvían correctamente las imágenes de los servicios (`imagen_url`, `image_url`, `foto_url`) y barberos (`foto`, `foto_url`), las imágenes de los servicios se perdían en dos fases críticas del flujo:

1. **Fase de Registro/Onboarding a Editor:**
   - En `registrobarberia.html`, cuando se hidrataban los datos de la barbería en modo edición desde `/api/dashboard/state`, el mapeo de servicios solo asignaba `imagen_url`, omitiendo `image_url` y `foto_url`.
   - Adicionalmente, al hacer click en "Seguir a la plantilla", el método `persistLandingSeed` guardaba la semilla `ba_landing_seed` en `sessionStorage` sin normalizar los servicios, provocando que los campos de imágenes adicionales y IDs consistentes (`id_servicio`) se perdieran.
2. **Fase del Editor (Carga y Guardado/Publicación):**
   - En `landing_editor_v2_unico_vscode.html`, el normalizador `normalizeInheritedServices(items)` no recuperaba los IDs unificados (`id_servicio`) ni las URLs en formato `foto_url`.
   - Como consecuencia, cuando el editor enviaba el payload de guardado a `/api/editor/publish`, los servicios se enviaban sin los campos unificados mínimos de imagen y ID.
3. **Fase de Renderizado en Plantillas:**
   - Las plantillas de las landing pages (`index_unico_v2.html` a `index_unicov7.html` y `pruebas.html`) realizaban una normalización defensiva estricta en `normalizeSeedService`. Si un servicio no tenía un ID asignado (`item.id_servicio` o `item.id`), el normalizador retornaba `null`, descartando el servicio o perdiendo la hidratación.
   - En `index_unico_v2.html`, la función `normalizeSeedService` descartaba cualquier servicio si su ID numérico resolvía a `0`.

---

## 2. Correcciones Aplicadas

Hemos estandarizado e implementado la preservación de campos de medios e identidades de extremo a extremo, en total cumplimiento con las reglas y contratos de negocio:

### A. Registro/Onboarding (`registrobarberia.html`)
- Se implementó `normalizeSeedService` dentro de `persistLandingSeed` para asegurar la correcta serialización e inclusión de `id_servicio`, `imagen_url`, `image_url`, y `foto_url` al guardar la semilla.
- Se actualizaron las funciones de mapeo de estado `/api/dashboard/state` para poblar todos los campos del contrato:
  ```javascript
  servicios: servicesList.map(s => {
    const imgVal = clean(s.imagen_url || s.image_url || s.foto_url || '');
    const sId = Number(s.id || s.id_servicio || 0) || undefined;
    return {
      id: sId,
      id_servicio: sId,
      nombre: clean(s.nombre),
      duracion_min: Number(s.duracion_min || 30),
      precio: Number(s.precio || 0),
      imagen_url: imgVal,
      image_url: imgVal,
      foto_url: imgVal
    };
  })
  ```

### B. Editor (`landing_editor_v2_unico_vscode.html`)
- Se actualizaron `normalizeInheritedServices` y `normalizeInheritedBarbers` para estructurar y unificar todos los campos de imágenes y fotos (`imagen_url`, `image_url`, `foto_url`, `foto`) y mapear `id_servicio` e `id_barbero` respectivamente. Esto garantiza que el payload enviado a `/api/editor/publish` contenga la información completa sin pérdidas de serialización.

### C. Plantillas (`EsenciaPremiun.html`, `index_unico_v2.html` a `index_unicov7.html` y `pruebas.html`)
- Se actualizaron los normalizadores frontend `normalizeSeedService` y `normalizeSeedBarber` en las 8 plantillas para mapear de manera segura todas las variables e implementar una asignación de ID secuencial defensiva (`idx + 1`) como fallback si no existiese un ID de base de datos válido.

---

## 3. Evidencias de Ejecución (Flujo QA Caliente)

### A. Endpoint de Estado del Panel (`/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4`)
Fragmento JSON verificado:
```json
"servicios": [
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

### B. Semilla Guardada en Editor (`ba_landing_seed`)
Fragmento del payload del editor cargado:
```json
"servicios": [
  {
    "id": 489,
    "id_servicio": 489,
    "name": "Corte Clasico",
    "nombre": "Corte Clasico",
    "imagen_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg",
    "image_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg",
    "foto_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg"
  }
]
```

### C. Body de la Petición al Publicar (`/api/editor/publish`)
Payload real serializado en el request body:
```json
{
  "p_payload": {
    "barberia_id": 198,
    "slug": "barberia-prueba-4",
    "servicios": [
      {
        "id": 489,
        "id_servicio": 489,
        "nombre": "Corte Clasico",
        "precio": 20000,
        "duracion_min": 30,
        "imagen_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg",
        "image_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg",
        "foto_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg"
      }
    ]
  }
}
```

### D. Chequeo del DOM de Landing Pública (`/b/barberia-prueba-4`)
Al ejecutar el DOM Check:
```javascript
[...document.querySelectorAll('img')].map((img, i) => ({ i, src: img.src, alt: img.alt, w: img.naturalWidth, h: img.naturalHeight }));
```
Resultado exitoso:
```javascript
[
  { "i": 0, "src": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-593431.jpg", "alt": "", "w": 320, "h": 320 },
  { "i": 1, "src": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg", "alt": "Corte Clasico", "w": 800, "h": 600 },
  { "i": 2, "src": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427727.png", "alt": "Barba", "w": 800, "h": 600 },
  { "i": 3, "src": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427728.png", "alt": "Corte + Cejas", "w": 800, "h": 600 }
]
```

---

## 4. Riesgos y Rollback

* **Riesgo:** Si un webhook legacy esperase exclusivamente la estructura plana anterior sin normalizar.
* **Mitigación:** Se han conservado las propiedades originales y solo se agregaron propiedades de compatibilidad y fallbacks seguros.
* **Rollback:** 
  ```bash
  git checkout HEAD~1 -- project/templates/
  ```
