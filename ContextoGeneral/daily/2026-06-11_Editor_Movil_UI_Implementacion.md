# Editor Movil UI - Implementacion Grande

Fecha: 2026-06-11

## Resumen ejecutivo

Se implemento una segunda pasada de rediseño movil grande para el editor V2 de BarberAgency, tomando como referencia la UI tipo app premium entregada por el usuario.

El cambio se mantiene controlado: la implementacion principal queda en `project/templates/base/editor.css`, encapsulada en `@media (max-width: 900px)` y `@media (max-width: 430px)`.

No se modifico logica funcional del editor, publicacion, hidratacion, payloads, endpoints ni handlers.

Decision: `EDITOR MOVIL UI — IMPLEMENTACION GRANDE ENTREGADA`

## Archivos modificados

- `project/templates/base/editor.css`
- `ContextoGeneral/daily/2026-06-11_Editor_Movil_UI_Implementacion.md`

## HTML

No se modifico `project/templates/editor/landing_editor_v2_unico_vscode.html` para esta implementacion.

El HTML ya contiene los selectores funcionales necesarios:

- `#ba-editor-v2`
- `.ba-row`
- `#ba-left`
- `.ba-panel`
- `.ba-panel-head`
- `.ba-btns`
- `#goRegistro`
- `#goSelector`
- `#publish`
- `#ba-right.ba-preview`
- `.ba-preview-head`
- `#preview`
- `.ba-mobile-dock`
- `.ba-dock-btn`

Por eso se evito tocar HTML y no se agregaron wrappers, IDs, handlers ni estructura nueva.

## Diagnostico: por que el cambio anterior no se veia

El editor no carga `project/templates/base/editor.css` directamente desde el repo.

El HTML enlaza el CSS desde WordPress uploads:

`https://barberagency-barberagency.gymh5g.easypanel.host/wp-content/uploads/editor.css?v=130`

Conclusion: para que el cambio se vea en produccion hay que reemplazar/subir ese `editor.css` en WordPress y limpiar cache o actualizar el query param de version. Si solo se commitea el repo, WordPress seguira sirviendo el CSS anterior.

## Selectores reales usados

La implementacion usa los selectores reales existentes:

- `#ba-editor-v2`
- `#ba-editor-v2::before`
- `#ba-editor-v2::after`
- `.ba-row::before`
- `#ba-right.ba-preview`
- `#ba-right.ba-preview::before`
- `#ba-right.ba-preview::after`
- `#preview`
- `#ba-left`
- `.ba-panel-head`
- `.ba-btns`
- `.ba-btn`
- `#goRegistro`
- `#goSelector`
- `#publish`
- `#ba-section-brand`
- `.ba-section`
- `.ba-field`
- `.ba-upload`
- `.ba-mobile-dock`
- `.ba-dock-btn`

## Estructura movil creada

Sin tocar HTML, se recreo visualmente:

- header superior tipo app con marca BarberAgency y subtitulo `Editor movil`
- boton circular de opciones visual
- card principal `Tu landing`
- estado visual `Guardado`
- preview dentro de card premium
- acciones principales en tres columnas
- panel `Editar contenido`
- dock inferior glass fijo

## UI segun imagen

La nueva capa movil apunta a la referencia:

- fondo negro/grafito con radial dorado
- superficies glass con blur
- bordes redondeados grandes
- sombras suaves premium
- acento dorado BarberAgency
- preview con card grande
- botones claros y grandes
- `Publicar` destacado en dorado
- panel de contenido con filas tipo app

## Dock glass

El dock movil queda:

- fijo abajo
- con safe-area
- ancho casi completo
- redondeado
- translucido
- con blur fuerte
- con borde sutil
- estado activo dorado

Se oculta visualmente un item sobrante del dock para acercarlo a la referencia de 4 opciones.

## Proteccion de desktop

No se agregaron reglas desktop nuevas.

Los cambios visuales nuevos quedan dentro de:

- `@media (max-width: 900px)`
- `@media (max-width: 430px)`

## Modo oscuro

Modo oscuro:

- fondo `#070A0D` / `#0B1117`
- superficies rgba oscuras
- texto claro
- acento dorado `#C9A24E`
- dock glass oscuro

## Modo claro

Modo claro se conserva con overrides para:

- `body.light-mode #ba-editor-v2`
- `#ba-editor-v2[data-ui-theme='light']`

Se usan superficies blancas/translucidas, texto oscuro y dorado como acento.

## Validaciones realizadas

Validaciones de alcance:

- No se modifico HTML para esta tarea.
- No se modifico JS funcional.
- No se tocaron IDs funcionales.
- No se tocaron handlers.
- No se tocaron inputs hidden.
- No se modifico `buildSavePayload`.
- No se modifico `publishPayload`.
- No se modifico hidratacion.
- No se modificaron endpoints.
- No se modifico `/api/editor/publish`.
- No se modifico `/api/configuracion/update`.

Validaciones tecnicas:

- `git diff --check`: PASS.
- Balance de llaves CSS: PASS, `278` aperturas y `278` cierres.
- Diff del HTML revisado para funciones, fetch, endpoints y handlers: sin cambios nuevos de esta tarea.
- `git diff --cached --check`: PASS antes del commit.

Validacion visual pendiente:

- Requiere subir `editor.css` a WordPress.
- Revisar Network para confirmar que se sirva el CSS actualizado.
- Probar 390px, 430px, 768px y desktop.
- Probar dark/light mode en la pagina real.

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

## Como subir a WordPress

Actualizar en WordPress:

- reemplazar `wp-content/uploads/editor.css` con `project/templates/base/editor.css`
- limpiar cache de WordPress/CDN/navegador
- si aplica, subir version del query param de `editor.css?v=130` a un valor nuevo
- verificar en Network que el CSS cargado corresponde al archivo nuevo

No copiar HTML por esta tarea.

## Riesgos pendientes

- Si WordPress sigue sirviendo `editor.css?v=130` cacheado, el cambio no se vera aunque el repo este correcto.
- Existen estilos inline historicos en `landing_editor_v2_unico_vscode.html`; la nueva capa CSS usa mayor especificidad y orden final para ganar en movil sin tocar JS.
- El dock se mantiene sobre la estructura funcional existente para no cambiar handlers.

## Decision

`EDITOR MOVIL UI — IMPLEMENTACION GRANDE ENTREGADA`
