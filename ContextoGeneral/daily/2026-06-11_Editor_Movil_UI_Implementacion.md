# Editor Movil UI - Implementacion

Fecha: 2026-06-11

## Resumen ejecutivo

Se implemento una capa visual movil premium para el editor V2 de BarberAgency usando principalmente `project/templates/base/editor.css`.

El cambio queda encapsulado en reglas responsive `@media (max-width: 900px)` y `@media (max-width: 430px)`. No se modifico la logica funcional del editor, publicacion, hidratacion, payloads, endpoints ni handlers.

Decision: `EDITOR MOVIL UI — IMPLEMENTACION ENTREGADA`

## Archivo CSS modificado

- `project/templates/base/editor.css`

## HTML

No se modifico `project/templates/editor/landing_editor_v2_unico_vscode.html` para esta implementacion.

El HTML ya contiene:

- Link externo a CSS:
  `https://barberagency-barberagency.gymh5g.easypanel.host/wp-content/uploads/editor.css?v=130`
- Dock movil existente:
  `.ba-mobile-dock`
- Botones existentes:
  `#goSelector`, `#publish` y botones del dock

Por eso no fue necesario agregar wrappers, IDs, handlers ni estructura nueva.

## Clases y selectores tocados

La implementacion agrega overrides moviles para:

- `#ba-editor-v2`
- `.ba-row`
- `#ba-right.ba-preview`
- `#preview`
- `#ba-left`
- `.ba-panel-head`
- `.ba-biz-name`
- `.ba-section`
- `.ba-field`
- `.ba-upload`
- `.ba-btns`
- `.ba-btn`
- `#goSelector`
- `#publish`
- `.ba-preview-head`
- `.ba-chips`
- `.ba-chip`
- `.ba-mobile-dock`
- `.ba-dock-btn`
- `.ba-dock-ico`
- `.ba-mobile-scrim`
- `.ba-settings-sheet`
- `.ba-settings-input`

## Dock inferior glass

El dock movil anterior quedaba en lateral. La nueva capa CSS lo posiciona fijo abajo:

- `position: fixed`
- `left/right` con `env(safe-area-inset-*)`
- `bottom` con `env(safe-area-inset-bottom)`
- fila horizontal
- fondo glass oscuro o claro segun tema
- blur con `backdrop-filter`
- estado activo dorado

Tambien se agrego padding inferior al contenedor movil para que el dock no tape acciones criticas.

## Proteccion de desktop

No se modificaron reglas desktop fuera del nuevo bloque responsive.

Los cambios visuales nuevos aplican solo en:

- `@media (max-width: 900px)`
- `@media (max-width: 430px)`

## Modo oscuro

El modo oscuro usa variables moviles:

- fondo negro/grafito
- superficie glass oscura
- borde translucido
- acento dorado BarberAgency
- texto claro

## Modo claro

El modo claro se conserva mediante overrides para:

- `body.light-mode #ba-editor-v2`
- `#ba-editor-v2[data-ui-theme='light']`

En modo claro se usan superficies blancas/translucidas, texto oscuro y acento dorado.

## Validaciones realizadas

- Cambio principal en `project/templates/base/editor.css`.
- No se modifico HTML para esta tarea.
- No se modifico JS funcional.
- No se tocaron IDs usados por JavaScript.
- No se tocaron handlers.
- No se tocaron inputs hidden.
- No se modifico `buildSavePayload`.
- No se modifico `publishPayload`.
- No se modifico hidratacion.
- No se modificaron endpoints.
- No se modifico `/api/editor/publish`.
- No se modifico `/api/configuracion/update`.
- Pendiente de validacion visual final en WordPress despues de subir el CSS actualizado.

## Backend y datos

No se tocaron:

- backend
- DB
- n8n
- EasyPanel
- dashboard
- reservas
- permisos
- sesion
- APIs
- payloads

## Riesgos

- WordPress carga `editor.css` desde uploads con version `v=130`; si hay cache de WordPress/CDN/navegador, puede requerir limpiar cache o subir con version actualizada.
- La validacion visual definitiva debe hacerse en la pagina real despues de copiar el CSS actualizado a WordPress.
- Existen estilos inline historicos dentro del HTML; esta implementacion usa especificidad y orden final en CSS para sobreescribir el comportamiento movil anterior sin tocar JS.

## Archivos para copiar/subir a WordPress

Copiar/subir:

- `project/templates/base/editor.css`

No copiar HTML por esta tarea, porque no fue modificado para la implementacion movil.

## Decision

`EDITOR MOVIL UI — IMPLEMENTACION ENTREGADA`
