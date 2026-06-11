# Reporte Diario: Fix UX Móvil - Editor como App Native Full-Screen

**Fecha:** 2026-06-11  
**Autor:** Antigravity (AI Coding Assistant)  
**ID Conversación:** 4ea57a6a-75af-4003-93e9-e5d495483a99  

---

## 1. Resumen Ejecutivo
Se corrigió la experiencia de usuario (UX) del editor BarberAgency en dispositivos móviles. Anteriormente, el previsualizador de la landing page se renderizaba como un mockup de celular (con un marco de pantalla oscuro, barra simulada de navegador y sombras pesadas) dentro del propio dispositivo del usuario, generando un efecto de redundancia visual ("celular dentro de un celular"). La nueva interfaz adapta la previsualización como una sección de card limpia e integrada que fluye naturalmente a pantalla completa, logrando una verdadera apariencia de aplicación móvil nativa.

## 2. Causa Exacta del Efecto "Celular dentro del Celular"
La anomalía visual se debía a dos reglas CSS superpuestas aplicadas bajo `@media (max-width: 900px)` en [editor.css](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/base/editor.css):
1. El contenedor del previsualizador `#ba-right.ba-preview` actuaba como una card con bordes redondeados y sombra.
2. El iframe `#preview` que contiene la landing previsualizada estaba restringido a `max-width: 430px`, centrado con `margin: 0 auto`, y decorado con un borde de `5px solid #050913` que simulaba el bisel físico de un smartphone, junto con su propio borde-redondeado y sombra.
Esto hacía que en viewports de celular reales (e.g. 390px) se redujera la pantalla útil y se viera un teléfono dibujado dentro de la pantalla real del dispositivo.

## 3. Archivos Modificados
* [editor.css](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/base/editor.css) (Estilos del editor)
* [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html) (Añadido wrapper HTML del header móvil y versión de caché de CSS incrementada)

## 4. Selectores Corregidos y Modificaciones CSS
* **Header Superior Real:** Se implementó una barra superior fija (`.ba-mobile-header`) con desenfoque de fondo glassmorphic, que contiene el logo "B", el nombre BarberAgency, subtítulo "Editor móvil" y el estado de guardado actual.
* **Desactivación de Header Simulado por CSS:** Se deshabilitaron los pseudo-elementos `#ba-editor-v2::before`, `#ba-editor-v2::after` y `#ba-editor-v2 .ba-row::before` que generaban textos y botones absolutos redundantes y estáticos que se desplazaban con el scroll.
* **Neutralización del Mockup en el Iframe (`#preview`):** Se eliminó el `max-width: 430px`, el borde de bisel simulado (`border: none !important`) y la sombra de simulación de dispositivo, dejando que ocupe el 100% de la card de previsualización con esquinas redondeadas sutiles a tono con la interfaz.
* **Neutralización de wrappers y barras de navegador:** Se forzó `display: none !important` en elementos de interfaz de navegador como `.ba-browser-bar`, `.ba-browser-chrome`, `.ba-device-frame`, `.ba-phone-frame` y selectores desktop en móvil.

## 5. Qué se Ocultó en Móvil
* `.ba-desktop-only` (elementos específicos de escritorio).
* `.ba-sidebar-header-desktop` y `.ba-sidebar-help-desktop`.
* `.ba-desktop-templates-section` (sección de plantillas de escritorio).
* `.ba-preview-toolbar-desktop` (toolbar con los botones Desktop/Tablet/Mobile y previsualizador superior).
* `.ba-browser-bar` (barra simulada con dots e input de dirección web).
* `.ba-device-frame` y `.ba-phone-frame` (marcos simulados de dispositivos).
* Los pseudo-elementos del header simulado en `#ba-editor-v2` y `.ba-row`.

## 6. Qué se Neutralizó en Móvil
* `.ba-browser-mockup` se cambió a `display: contents !important` y se le removieron backgrounds, bordes y sombras para que no enmarque el iframe.
* Las restricciones de tamaño y márgenes de `#preview` (`max-width: 430px`, `margin: 0 auto`) se desactivaron asignándole `width: 100% !important; margin: 0 !important;`.
* Los bordes y sombras de `#preview` en modo claro y oscuro se establecieron a `none`.

## 7. Cómo se Preservó Desktop
Se encapsularon de forma estricta todas las modificaciones usando las consultas de medios correspondientes:
* Los estilos de ocultamiento y reseteo móvil viven exclusivamente dentro de `@media (max-width: 900px)`.
* Se añadió una regla bajo `@media (min-width: 901px)` para asegurar que el nuevo elemento `.ba-mobile-header` y cualquier clase `.ba-mobile-only` permanezcan ocultos con `display: none !important` en resoluciones de escritorio.

## 8. Validaciones Realizadas
1. **Verificación de Formato y Estilo Git:** Se ejecutó `git diff --check` arrojando estado exitoso.
2. **Validación de Sintaxis JS:** Se extrajo el código Javascript contenido en [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html) mediante un script Node y se corrió `node --check` sobre cada bloque script, confirmando 100% de validez sintáctica.
3. **Verificación del viewport de escritorio:** Confirmado que se mantiene intacto.

## 9. Confirmación de No Alteración del Backend
Se confirma que no se ha tocado ningún archivo de base de datos, backend, endpoints PHP/WordPress ni workflows de n8n.

## 10. Confirmación de No Alteración de la Lógica de Publicado/Guardado
Se confirma que la función `buildSavePayload`, la hidratación de datos y la llamada a las funciones de guardar y publicar no se vieron afectadas en absoluto, ya que solo se modificó estructura visual HTML y hojas de estilo CSS.

## 11. Archivos a Subir a WordPress
Para aplicar estos cambios en producción en WordPress, se deben subir/actualizar los siguientes archivos:
1. `wp-content/uploads/editor.css` (Reemplazar con el contenido de `project/templates/base/editor.css`).
2. El Widget HTML del Editor en Elementor/Gutenberg (Actualizar pegando el contenido del archivo `project/templates/editor/landing_editor_v2_unico_vscode.html`).

---

### Decisión
`EDITOR MÓVIL APP UX — FIX ENTREGADO`
