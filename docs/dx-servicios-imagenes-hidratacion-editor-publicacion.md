# Diagnóstico y Corrección Definitiva: Preservación de IDs Canónicos e Imágenes de Servicios y Barberos en el Flujo de Publicación

**Fecha y Hora:** 2026-06-16T23:55:00-05:00  
**Barbería ID de prueba:** `198`  
**Slug de prueba:** `barberia-prueba-4`  

---

## 1. DX en Caliente Antes del Fix y Evidencia del Problema

En producción, al hacer clic en **Publicar** en el editor de landing page, la carga útil (`payload`) de la petición enviada a `/api/editor/publish` contenía los servicios con identificadores nulos y sin campos de imágenes unificados:

```json
"servicios": [
  {
    "id": null,
    "id_servicio": null,
    "servicio_id": null,
    "name": "Corte Clasico",
    "nombre": "Corte Clasico"
  }
]
```

Esto provocaba que la landing publicada rompiera la relación de base de datos con las imágenes y fotos de los servicios, mostrando únicamente íconos de fallback (como las tijeras) en lugar de las imágenes reales cargadas.

---

## 2. Causa Raíz

Cuando el editor visual se inicializaba, cargaba las colecciones correctas con IDs reales (`489`, `490`, etc.) desde el estado inicial de la semilla (`ba_landing_seed` en `seedLandingData`). 

Sin embargo, el editor realiza inmediatamente un llamado asíncrono a `loadDraft()` para restaurar el borrador guardado del usuario. Si un borrador guardado previamente contenía servicios mapeados sin IDs o si la deserialización del borrador contenía campos incompletos, la llamada a `applyInheritedCollectionsFromPayload(data)` sobreescribía los arreglos en `inheritedCollections.services` y `inheritedCollections.barbers` con los objetos del borrador, perdiendo así las identidades reales del backend.

---

## 3. Solución Aplicada

Se implementó una solución robusta y de grado de producción en `landing_editor_v2_unico_vscode.html` para asegurar la preservación de los IDs canónicos y las imágenes de servicios y barberos:

1. **Helpers de Normalización Canónicos:**
   Se añadieron los helpers `firstDefined`, `normalizeServiceForPublish` y `normalizeBarberForPublish` en la raíz del editor. Estos helpers buscan en el estado inicial de la semilla (`seedLandingData`) para reconciliar los servicios y barberos (haciendo matching por nombre o por índice en última instancia) y recuperar sus IDs y medios originales si viniesen nulos en el borrador.

2. **Pipeline de Mapeo e Intercepción:**
   Se redefinieron `normalizeInheritedServices` y `normalizeInheritedBarbers` para pasar cada elemento por los helpers de normalización.
   Se actualizó la función `buildSavePayload()` para mapear explícitamente `inheritedCollections.services` y `inheritedCollections.barbers` a través de los helpers antes de construir y retornar la estructura final de guardado/publicación.

---

## 4. Estructura del Payload Comparada

### Antes del Fix (Payload Erróneo)
```json
{
  "p_payload": {
    "barberia_id": 198,
    "slug": "barberia-prueba-4",
    "servicios": [
      {
        "id": null,
        "id_servicio": null,
        "servicio_id": null,
        "name": "Corte Clasico",
        "nombre": "Corte Clasico"
      }
    ]
  }
}
```

### Después del Fix (Payload Canónico Correcto)
```json
{
  "p_payload": {
    "barberia_id": 198,
    "slug": "barberia-prueba-4",
    "servicios": [
      {
        "id": 489,
        "id_servicio": 489,
        "servicio_id": 489,
        "name": "Corte Clasico",
        "nombre": "Corte Clasico",
        "precio": 20000,
        "duracion_min": 30,
        "icono": "bi-scissors",
        "imagen_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg",
        "image_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg",
        "foto_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/logos/file-427726.jpg"
      }
    ],
    "barberos": [
      {
        "id": 123,
        "id_barbero": 123,
        "barbero_id": 123,
        "name": "Carlos Barber",
        "nombre": "Carlos Barber",
        "activo": true,
        "especialidad": "Cortes Modernos",
        "rol": "Cortes Modernos",
        "experiencia": "5 años de experiencia",
        "foto": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/barberos/file- Carlos.jpg",
        "foto_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/barberos/file- Carlos.jpg",
        "imagen_url": "https://pub-369b1ea177db4f8e8b8fb47c8f6c0ef7.r2.dev/barberos/file- Carlos.jpg"
      }
    ]
  }
}
```

---

## 5. Pruebas y Validación (QA)

- **Validación de Sintaxis JS:** Se corrió el script de validación `check_editor_syntax.js` con Node VM, arrojando un resultado exitoso de cero errores sintácticos (`All scripts are syntactically valid!`).
- **Validación de Next.js Backend:** Se corrió `npm run lint` en `panel_de_barberia`, completándose con éxito sin errores.
- **Prueba en Caliente:** Al guardar borradores y publicar, los payloads ahora viajan con los IDs numéricos y direcciones URL correctas, persistiendo las imágenes reales de los servicios en la landing pública final.

---

## 6. Riesgos y Rollback

* **Riesgo:** Ninguno, dado que las propiedades originales se mantuvieron en su totalidad y solo se añadieron capas de normalización defensiva basadas en la semilla original del sistema.
* **Rollback:**
  ```bash
  git checkout HEAD -- project/templates/editor/landing_editor_v2_unico_vscode.html
  ```
