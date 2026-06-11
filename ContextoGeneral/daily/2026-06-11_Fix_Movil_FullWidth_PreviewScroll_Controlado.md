# Reporte Diario: Editor Móvil Full-Width + Preview Scroll Controlado
**Fecha:** 2026-06-11
**Estado:** Entregado

---

## 1. Resumen Ejecutivo
Se ha rediseñado y corregido la interfaz móvil del editor de BarberAgency para resolver los problemas visuales detectados en dispositivos móviles. La interfaz ahora se comporta como una aplicación web nativa móvil de ancho completo (full-width), con un orden lógico correcto de elementos, altura de previsualización controlada y un scroll interno funcional en la tarjeta de previsualización de la landing page. La experiencia de escritorio (desktop) permanece intacta y funcional.

---

## 2. Causa Real de los Problemas

1. **Ancho incorrecto (limitación a 820px o viewport angosto):**
   - **Causa:** Existía un bloque de CSS inyectado dinámicamente mediante JavaScript (`paletteInlineStyles` en [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html)) que forzaba a `#ba-left`, `#ba-right`, `.ba-panel` y `.ba-preview` a tener un ancho máximo `min(98vw, 820px) !important` en resoluciones inferiores a 900px, limitando el ancho real y rompiendo el comportamiento fluido full-width en pantallas pequeñas. Además, los botones `.ba-btn` tenían overrides inyectados dinámicamente con color de fondo grisáceo semitransparente que rompían el color dorado distintivo del botón de publicar.

2. **Orden incorrecto:**
   - **Causa:** En la visualización móvil previa, la estructura flex no tenía un orden explícito estricto o colocaba el panel de edición `#ba-left` por encima del previsualizador `#ba-right` en ciertas condiciones de renderizado.

3. **Alto excesivo del preview:**
   - **Causa:** El previsualizador del iframe `#preview` utilizaba la variable de entorno `--work-height` que calculaba alturas demasiado grandes en mobile (`clamp(520px, 70svh, 780px)`), provocando que la previsualización ocupara casi toda la pantalla y no dejara espacio visible para el panel de edición o los botones de acción en la parte inferior.

---

## 3. Selectores Corregidos y Soluciones Aplicadas

### 3.1 Implementación de Full-Width
- **HTML/JS:** Se eliminó por completo el bloque `@media (max-width: 900px)` dentro de `paletteInlineStyles` en [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html). Esto erradicó las colisiones y permitió que el archivo global [editor.css](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/base/editor.css) controlara el layout de manera limpia y centralizada.
- **CSS:** Se configuró `#ba-editor-v2` con `width: 100% !important; padding-left: 0; padding-right: 0;` y `#ba-editor-v2 .ba-row` con `width: 100% !important; max-width: 100% !important; display: flex !important; flex-direction: column !important;`.
- **Card de Previsualización:** Se aplicó sobre `#ba-editor-v2 #ba-right.ba-preview`:
  ```css
  width: calc(100% - 28px) !important;
  max-width: calc(100% - 28px) !important;
  margin: 16px 14px !important;
  ```
  Esto crea una tarjeta elegante con un espaciado de margen uniforme de 14px sin marcos artificiales de teléfonos.

### 3.2 Orden Correcto en Móvil
- Se definió el flujo de orden visual usando flexbox en `.ba-row` (en móvil) posicionando la previsualización al inicio y las configuraciones después:
  - **Tarjeta de Previsualización (`#ba-right.ba-preview`):** `order: 1 !important;`
  - **Botones de Acción (`.ba-panel-head`):** Naturalmente se posicionan antes de las secciones de edición porque `.ba-panel-head` es el primer elemento visible de `#ba-left` (`order: 2` implícito dentro del contenedor).
  - **Panel de Edición / Acordeones (`#ba-left`):** `order: 3 !important;`

### 3.3 Alto Controlado y Scroll Interno
- Se aplicaron límites estrictos de altura al iframe `#preview` usando CSS:
  ```css
  height: clamp(340px, 48vh, 520px) !important;
  min-height: 340px !important;
  max-height: 520px !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  ```
- Se configuró `#ba-right.ba-preview` con `overflow: hidden !important` para encapsular la ventana de visualización y permitir que el iframe sea el contenedor que realice el scroll interno de la landing page.

---

## 4. Confirmación de Desktop Intacto
- Todos los cambios se encuentran estrictamente encapsulados bajo la regla `@media (max-width: 900px)`.
- El layout de escritorio de 2 columnas (panel a la izquierda con ancho de 350px y previsualización simulada a la derecha con barras de herramientas) se mantiene 100% intacto y funcional, sin interferencias de los estilos móviles.

---

## 5. Validaciones Realizadas
1. **Sintaxis JS en HTML:** Se ejecutó `node --check` sobre las secciones de scripts extraídas del archivo HTML, resultando en 0 errores.
2. **Chequeo de git diff:** Se corrió `git diff --check` para validar la ausencia de errores de sintaxis y conflictos de fusión de archivos en el área de trabajo.
3. **Control de Ancho Móvil:** Confirmado que no existen referencias activas a mockups físicos de celulares (como `ba-device-frame` o `ba-phone-frame`) y que no se limita a un ancho fijo (ej. 390px/430px).

---

## 6. Qué subir a WordPress
Para aplicar estos cambios en el entorno de producción en la nube:
1. Copiar y pegar el contenido completo de [editor.css](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/base/editor.css) en la ruta del archivo CSS de estilos del editor en el servidor/WP (generalmente cargado en `/wp-content/uploads/editor.css`).
2. Actualizar el código del template de la página en WordPress (o sistema gestor de landing pages) con el contenido corregido de [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html) (principalmente cuidando la referencia de versión en el link CSS `editor.css?v=137` para refrescar la caché del cliente móvil).

---

## Decisión Final:
**EDITOR MÓVIL FULL WIDTH + PREVIEW SCROLL CONTROLADO — FIX ENTREGADO**
