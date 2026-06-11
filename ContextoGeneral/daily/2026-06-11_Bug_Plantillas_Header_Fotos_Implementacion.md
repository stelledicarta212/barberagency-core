# Bug plantillas header/fotos - implementacion

Fecha: 2026-06-11

## Causa raiz

Se confirmaron riesgos en el flujo visual de editor y plantillas:

1. El editor tenia input oculto `cover_url`, pero no hidrataba de forma explicita la portada desde la fuente publicada al iniciar.
2. El payload podia llevar `cover_url` vacio o placeholder conocido, dejando abierta la posibilidad de limpiar o reemplazar la portada real.
3. Las plantillas renderizaban imagen de servicio desde un subconjunto de campos (`imagen_url`/`image_url`) y podian ignorar `foto_url`, `foto`, `imagen`, `image`, `cover_url` o `media_url`.
4. El diagnostico previo sugeria `idx + 1` como fallback de ID; eso no es valido para produccion. Se verifico y se mantuvo la regla de no inventar IDs reales.
5. V5 existe como pagina fisica en WordPress y conserva identificacion V5.1 BlueRed, pero requiere copiar el HTML actualizado para recibir estos fixes.

## Fix aplicado

### Editor

Archivo:

- `project/templates/editor/landing_editor_v2_unico_vscode.html`

Cambios:

- Se agrego `isKnownPlaceholderImage(url)`.
- Se agrego `safeImageUrl(url)`.
- Se agrego `getCanonicalSeedCoverUrl()`.
- `applySeedDefaults()` ahora hidrata `cover_url` real desde:
  - `seedLandingData.cover_url`
  - `seedLandingData.barberia.cover_url`
  - `seedLandingData.landing.cover_url`
  - `seedLandingData.branding.cover_url`
  - `seedLandingData.profile.cover_url`
  - `seedLandingData.inherited.cover_url`
  - variantes `hero_image_url`
- `getFormData()` usa `safeImageUrl(el.coverUrl.value) || getCanonicalSeedCoverUrl()`.
- `buildSavePayload()` usa `publishCoverUrl` seguro en `branding`, `profile`, `barberia` y `landing_publish`.
- `buildEditorMessagePayload()` y `buildBrandingUpdatePayload()` usan cover/logo saneados.

### Plantillas

Archivos:

- `project/templates/plantillas/index_unicov7.html`
- `project/templates/plantillas/index_unico_v2.html`
- `project/templates/plantillas/index_unico_v3_nueva.html`
- `project/templates/plantillas/index_unico_v4_editorial.html`
- `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`
- `project/templates/plantillas/index_unico_v6_negro_dorado.html`

Cambios:

- Se agrego `isKnownPlaceholderImage(url)`.
- Se agrego `safeImageUrl(url)`.
- Se agrego `resolveServiceImage(item)`.
- Render de servicios usa `resolveServiceImage(...)`.
- Normalizadores conservan imagenes reales como:
  - `foto_url`
  - `foto`
  - `imagen`
  - `image_url`
  - `image`
  - `cover_url`
  - `media_url`
  - `photo`
  - `imagen_url`
- Header/cover publico usa `safeImageUrl(...)` para evitar reemplazo por placeholder conocido.

## Como se hidrata cover_url

El editor ahora resuelve primero la portada real desde el seed/perfil publico. Si existe y el input esta vacio, o contiene placeholder conocido, se asigna:

- `el.coverUrl.value`
- `el.coverImg.src`
- `runtimePreview.cover`

Esto evita iniciar el editor con portada visual vacia cuando la fuente de verdad trae `cover_url` real.

## Como se evita placeholder generico

El helper `isKnownPlaceholderImage(url)` bloquea:

- `images.unsplash.com/cover.jpg`
- `images.unsplash.com/logo.jpg`
- URLs de Unsplash terminadas en `/cover.jpg`
- URLs de Unsplash terminadas en `/logo.jpg`

`safeImageUrl(url)` devuelve cadena vacia para esos placeholders, por lo que no reemplazan portada/logo reales ni fotos reales.

## Como se preservan fotos de servicios

Las plantillas ahora resuelven la imagen del servicio con `resolveServiceImage(item)`, que revisa todos los campos conocidos antes de usar fallback visual propio de la plantilla.

Si el servicio trae foto real, se renderiza esa foto. Si no trae foto real, se conserva el fallback visual propio de cada plantilla.

## Como se evita inventar IDs

Se verifico que no queda logica que haga:

- `id_servicio: idx + 1`
- `servicio_id: idx + 1`
- `id_barbero: idx + 1`
- `barbero_id: idx + 1`
- `toSeedNumber(..., idx + 1)` para IDs reales

Los normalizadores mantienen:

- servicios sin id real: no son opcion valida de reserva.
- barberos sin id real: no son opcion valida de reserva.

Esto evita enviar IDs falsos al backend.

## Validaciones realizadas

- `node --check` PASS para scripts extraidos de:
  - `landing_editor_v2_unico_vscode.html`
  - `index_unicov7.html`
  - `index_unico_v2.html`
  - `index_unico_v3_nueva.html`
  - `index_unico_v4_editorial.html`
  - `index_unico_v5_1_azul_rojo_elegante.html`
  - `index_unico_v6_negro_dorado.html`
- `git diff --check` PASS.
- Busqueda confirmo que no quedan IDs inventados con `idx + 1`.
- Busqueda confirmo helpers anti-placeholder en editor y plantillas.
- Busqueda confirmo `cover_url` hidratado y publicado con `publishCoverUrl`.
- Validacion no destructiva de WordPress:
  - URL: `https://barberagency-barberagency.gymh5g.easypanel.host/index_unico_v5_1_azul_rojo_elegante/`
  - La pagina responde como `Index_unico_v5_1_azul_rojo_elegante`.
  - Metadata identifica `V5.1 BlueRed Barber Elegante BlueRed Barber`.

## Confirmaciones de alcance

- DB: no tocada.
- n8n: no tocado.
- EasyPanel: no tocado.
- Bloque 10: no tocado.
- POS: no tocado.
- permisos/sesion: no tocado.
- reservas backend: no tocado.

## HTML que debe copiarse a WordPress

Copiar el archivo completo del editor si se actualiza el editor en WordPress:

- `project/templates/editor/landing_editor_v2_unico_vscode.html`

Copiar el archivo completo de cada plantilla publica usada:

- `project/templates/plantillas/index_unicov7.html`
- `project/templates/plantillas/index_unico_v2.html`
- `project/templates/plantillas/index_unico_v3_nueva.html`
- `project/templates/plantillas/index_unico_v4_editorial.html`
- `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`
- `project/templates/plantillas/index_unico_v6_negro_dorado.html`

Para V5 especificamente, copiar:

- `project/templates/plantillas/index_unico_v5_1_azul_rojo_elegante.html`

## Decision

BUG PLANTILLAS HEADER/FOTOS - IMPLEMENTACION ENTREGADA
