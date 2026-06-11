# Auditoría y Diagnóstico de Regresión: Plantillas, Headers e Hidratación de Colecciones
**Fecha:** 2026-06-11
**Estado:** BUG PLANTILLAS HEADER/FOTOS — DIAGNÓSTICO ENTREGADO

---

## 1. Resumen Ejecutivo
Se ha realizado una auditoría y diagnóstico del commit `9a0a40477747a6b6556de6c4b49e8efa1f101d6d` y del flujo de publicación de plantillas públicas en BarberAgency.
El commit auditado solucionó correctamente la inyección de parámetros canónicos en el formulario de reservas (tales como `barberia_id`, `slug`, `servicio_id`, etc.), previniendo errores de hidratación y fallas de publicación.
Sin embargo, se han identificado las causas raíz detrás de las regresiones visuales (imágenes de cabecera cambiadas por placeholders genéricos y fotos de servicios/barberos desconfiguradas), además de explicar por qué WordPress podría cargar la plantilla equivocada tras publicar.

---

## 2. Commit Auditado
* **Hash:** `9a0a40477747a6b6556de6c4b49e8efa1f101d6d`
* **Mensaje:** `fix(booking): hydrate booking form from canonical source`
* **Autor:** Carlos a Alvis
* **Fecha:** 2026-06-11

---

## 3. Archivos Revisados
* `project/templates/plantillas/index_unico_v2.html`
* `project/templates/plantillas/index_unico_v3_nueva.html`
* `project/templates/plantillas/index_unico_v4_editorial.html`
* `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`
* `project/templates/plantillas/index_unico_v6_negro_dorado.html`
* `project/templates/plantillas/index_unicov7.html`
* `project/templates/plantillas/pruebas.html`
* `project/templates/editor/landing_editor_v2_unico_vscode.html`
* `wordpress-plugins/barberagency-public-router-v5/barberagency-public-router.php`
* `pruebas/landing_save_workflow.json` (n8n save workflow)
* `pruebas/publish_workflow.json` (n8n publish workflow)

---

## 4. Cambios Detectados en Headers/Heros
* **No hay URLs hardcodeadas modificadas:** El commit auditado **no** alteró las URLs fijas ni modificó strings de imágenes (como `.jpg` o `.png`) en ninguna plantilla.
* **Lógica de Sobrescritura de Portadas:** La función `applyPublicLandingBranding` en las plantillas toma `cover_url` de la base de datos:
  ```javascript
  const coverUrl = safeSeedText(profile.cover_url || branding.cover_url || branding.hero_image_url);
  const heroImage = document.getElementById('heroImage');
  if (coverUrl && heroImage) heroImage.src = coverUrl;
  ```
  Si `cover_url` en la base de datos contiene una URL genérica (por ejemplo, `https://images.unsplash.com/cover.jpg` utilizada por scripts de pruebas), el código la inyecta directamente, pisando la imagen original y premium de la plantilla.
* **Falta de Hidratación en el Editor (Pérdida de Portada):** En el editor (`landing_editor_v2_unico_vscode.html`), la carga inicial de `seedLandingData` en `readLandingSeed()` and `applySeedDefaults()` **no mapea** la variable `cover_url`. Como consecuencia, el input oculto `#cover_url` queda vacío (`""`). Al publicar, se envía una cadena vacía en `cover_url`. La base de datos, al recibir este string vacío y reconciliar mediante `ba_publicar_landing_completa`, lo convierte a `NULL` o cae en valores obsoletos, lo que rompe la inercia del hero.

---

## 5. Cambios Detectados en Fotos de Servicios y Barberos
* **Lógica de Exclusión Estricta (Filtro por ID):** El commit introdujo un filtro estricto de IDs en las funciones de normalización de las plantillas públicas:
  * **Servicios (`normalizeSeedService`):**
    ```javascript
    const serviceId = toSeedNumber(item.id_servicio ?? item.servicio_id ?? item.id ?? item.idServicio, 0);
    if (!serviceId) return null;
    ```
  * **Barberos (`normalizeSeedBarber`):**
    ```javascript
    const barberId = toSeedNumber(item.id_barbero ?? item.barbero_id ?? item.id ?? item.idBarbero, 0);
    if (!barberId) return null;
    ```
    **Problema:** Si el payload del onboarding o base de datos devuelve objetos de servicios/barberos temporales o mal mapeados sin un ID numérico explícito (mayor que 0), la normalización los descarta por completo (retorna `null`). Al quedar vacía la colección hidratada en `applyInheritedCollections`, la plantilla no inyecta los datos reales y cae en el listado mock del fallback de la plantilla.
* **Fallas de Ruta Relativa en Fotos de Barberos:** `normalizeInheritedBarbers` en el editor asigna una ruta relativa como fallback (`./assets/barberos/Barbero1.png`) si el barbero no posee foto. Al guardarse y sincronizarse mediante `ba_sync_publicacion_collections`, este string relativo se persiste en la columna `foto_url` de la base de datos, lo que causa imágenes rotas en la landing pública de producción.

---

## 6. Cambios Detectados en V5 (`index_unico_v5_1_azul_rojo_elegante.html`)
* Se comprobó la inyección exacta de las funciones `normalizeSeedHour`, `normalizeSeedService`, `normalizeSeedBarber` y la inyección canónica de `barberia_id` y `slug` en el payload de reservas (`buildPayload`).
* No existen cambios que afecten los layouts de V5 ni modificaciones de CSS del tema azul/rojo.

---

## 7. Evidencia de si V5 se Publica o no se Publica
Se ejecutó una simulación de lectura de base de datos para la barbería con `barberia_id = 198` (slug `'barberia-prueba-4'`) y se comprobó que:
1. **La base de datos tiene asignada la plantilla V5:** La tabla `barberia_landing_publish` registra correctamente `template_id = 'v5'` y `template_name = 'Prestigio Ejecutivo'`.
2. **El contrato JSON de la RPC (`ba_get_landing_publica`) es correcto:** Devuelve `"plantilla": { "template_id": "v5", ... }` y los servicios y barberos correctos.
3. **¿Por qué aparece otra plantilla (ej. V2) al abrir la página?**
   * **Mapeo de Router en WordPress:** El plugin enrutador de WordPress mapea la clave `'v5'` a `/index_unico_v5_1_azul_rojo_elegante/`.
   * **Causa Raíz:** Si la página con el slug `index_unico_v5_1_azul_rojo_elegante` en WordPress no fue creada físicamente, o si fue creada pero se le pegó por error el código HTML de la versión V2, WordPress devolverá la estructura de V2. El enrutador simplemente lee lo que responde `home_url('/index_unico_v5_1_azul_rojo_elegante/')` e inyecta las variables de hidratación de la base de datos sobre esa plantilla.

---

## 8. Causa Raíz
1. **Falta de Hydrate del cover en el Editor:** El editor no carga la portada en el hidden input `#cover_url` al iniciar, enviando cadenas vacías al publicar.
2. **Placeholder de Pruebas Persistido:** El script de QA inyectó y persistió la URL de placeholder genérica `https://images.unsplash.com/cover.jpg` en la base de datos, forzando a las plantillas a renderizar esta imagen en lugar del hero original.
3. **Filtro Estricto por ID:** La regla `if (!serviceId) return null` y `if (!barberId) return null` en las plantillas descarta servicios/barberos completos en lugar de proveerles un ID temporal incremental en caso de inconsistencias en el payload.
4. **Desfase de Slugs/Contenido en WordPress:** Mismatch o sobreescritura de la página WordPress con slug `index_unico_v5_1_azul_rojo_elegante`, la cual contiene HTML de otra plantilla o es inaccesible.

---

## 9. Fix Mínimo Recomendado
1. **En las Plantillas (Lógica de Portada Genérica):**
   Modificar `applyPublicLandingBranding` para omitir la sobrescritura del elemento `#heroImage` si la URL entrante coincide con un placeholder conocido o genérico de pruebas (como `unsplash.com/cover` o `unsplash.com/logo`).
2. **En el Editor (Persistencia de Portada):**
   Agregar la inicialización de `cover_url` en `applySeedDefaults` de `landing_editor_v2_unico_vscode.html`:
   ```javascript
   const seedCoverUrl = safeText(seedLandingData?.cover_url) || safeText(seedLandingData?.barberia?.cover_url);
   if (seedCoverUrl) {
     el.coverUrl.value = seedCoverUrl;
   }
   ```
3. **En las Plantillas (Robustez en Normalización):**
   Permitir que la normalización de servicios y barberos genere un ID de fallback (`idx + 1`) si `serviceId` o `barberId` es `0` o no está presente, en lugar de retornar `null` y excluir el objeto:
   ```javascript
   const serviceId = toSeedNumber(item.id_servicio ?? item.servicio_id ?? item.id ?? item.idServicio, idx + 1);
   ```
4. **En WordPress (Contenido V5):**
   Confirmar la existencia de la página física `/index_unico_v5_1_azul_rojo_elegante/` en la base de datos de WordPress y validar que su código HTML interno corresponda al archivo V5 original.

---

## 10. ¿Se recomienda Revert Parcial?
* **No se recomienda revertir todo el commit 9a0a404,** dado que su lógica corrige el envío de parámetros canónicos en el formulario de reservas (P0).
* **Se recomienda un parche correctivo de imágenes y normalización** enfocado únicamente en la inyección de `cover_url` en el editor, el fallback de ID en las plantillas y la validación física de páginas en WordPress.

---

## 11. Archivos que tocaría modificar (para el fix futuro)
* `project/templates/editor/landing_editor_v2_unico_vscode.html` (para hidratar portada en editor)
* `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html` (y resto de templates, para fallbacks de ID y filtrado de portada genérica)

---

## 12. Riesgos
* **Bajo.** Al no alterar la estructura del payload que recibe n8n ni la base de datos, corregir estos fallbacks e inicializadores visuales en el editor/plantillas no introduce riesgos funcionales ni afecta la creación de citas.

---

## 13. Confirmación de No Modificación de Código Funcional
Se confirma de forma categórica que **no se ha modificado ningún archivo de código funcional** del repositorio en esta auditoría. El árbol de trabajo de Git se mantiene limpio y sin cambios.

---

## 14. Decisión
**BUG PLANTILLAS HEADER/FOTOS — DIAGNÓSTICO ENTREGADO**
