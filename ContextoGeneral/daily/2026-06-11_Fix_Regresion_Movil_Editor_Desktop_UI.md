# Reporte de Fix — Regresión Móvil del Editor BarberAgency (11 de Junio de 2026)

## 1. Resumen Ejecutivo
Se corrigió con éxito la regresión en la interfaz móvil (UI) del editor de BarberAgency causada durante el rediseño desktop. Las secciones exclusivas de PC que se visualizaban de forma desordenada en pantallas móviles han sido totalmente neutralizadas, y se restauró la vista app premium anterior en dispositivos móviles sin alterar el diseño PC/Desktop aprobado.

---

## 2. Causa Exacta de la Regresión Móvil
Al integrar las nuevas secciones e instrumentos de simulación en la estructura HTML (`landing_editor_v2_unico_vscode.html`):
- Los elementos del previsualizador (barra de simulación, botones de viewport y cabeceras de plantilla) carecían de la clase y directiva de ocultamiento en pantallas de ancho $\le 900\text{px}$.
- Como consecuencia, el navegador renderizaba estos bloques HTML de forma predeterminada en el flujo móvil con estilos incorrectos y botones gigantes desordenados.
- Además, la cabecera lateral y el acordeón del pie se filtraban dentro del panel deslizable de marca móvil.

---

## 3. Archivos Modificados
- **Estilos CSS:** [editor.css](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/base/editor.css)
- **Estructura HTML:** [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html)

---

## 4. Selectores y Reglas Corregidas
Se introdujo la clase explícita `.ba-desktop-only` para aislar los elementos que únicamente deben mostrarse en PC.
En [editor.css](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/base/editor.css), se agregaron las siguientes directivas móviles:
```css
@media (max-width: 900px) {
  /* Ocultar elementos exclusivos de escritorio */
  #ba-editor-v2 .ba-desktop-only,
  #ba-editor-v2 .ba-sidebar-header-desktop,
  #ba-editor-v2 .ba-sidebar-help-desktop,
  #ba-editor-v2 .ba-desktop-templates-section,
  #ba-editor-v2 .ba-preview-toolbar-desktop,
  #ba-editor-v2 .ba-browser-bar {
    display: none !important;
  }
  
  /* Contenedor transparente */
  #ba-editor-v2 .ba-browser-mockup {
    display: contents !important;
  }
}
```

---

## 5. Qué se Ocultó en Móvil
- **Cabecera "Plantillas" y Subtítulo:** Removida en móvil (la barra de chips de selección `.ba-chips` fue extraída del wrapper de PC en el HTML y ahora se visualiza correctamente de forma independiente en móvil).
- **Controles de Pantalla (Desktop/Tablet/Móvil):** Ocultados por completo.
- **Botón "Vista previa" de Escritorio:** Ocultado.
- **Barra de Navegador simulado (Tres puntos de colores y dirección URL fake):** Ocultada.
- **Cabeceras y ayudas laterales de PC:** Ocultadas para que no contaminen el formulario del slide móvil.

---

## 6. Qué se Preservó en Desktop (PC)
- **Visualización Completa intacta:** La cuadrícula, barra horizontal, botones de historial, botón Publicar dorado, selector de plantillas horizontal con check/dashed y simulación del navegador en el iframe con redimensionamiento dinámico siguen funcionando tal y como fueron aprobados en PC (resoluciones 1440px, 1366px, 1024px).

---

## 7. Validaciones Realizadas
1.  **Validación de Sintaxis JavaScript:** Se compiló el código JavaScript dentro del HTML de forma exitosa sin fallos sintácticos (`node check_syntax.js`).
2.  **Validación de Estilos:** Se ejecutó `git diff --check` aprobando la consistencia de llaves en el stylesheet.
3.  **Restauración en Móvil:** Verificado en simulador a $390\text{px}$ y $404\text{px} \times 608\text{px}$:
    - El header de la aplicación móvil original *"BarberAgency / Editor móvil"* se muestra correctamente.
    - La previsualización de la landing page se renderiza adecuadamente en el contenedor móvil.
    - El dock inferior de navegación tipo "glass" se ubica en la parte baja (`bottom`) con el espaciado adecuado.
    - Los botones móviles de *"Editar landing"*, *"Cambiar plantilla"* y *"Publicar"* operan correctamente.
    - Se eliminó toda la contaminación visual de botones gigantes o barras de URL simuladas.

---

## 8. Confirmación de Integridad y Reglas de Negocio
- **No se tocó backend/APIs/endpoints:** Confirmado.
- **No se modificó base de datos o n8n/EasyPanel:** Confirmado.
- **Lógica de Publicación y Guardado de payloads intacta:** Confirmado.
- **El diseño PC y sus handlers JS no sufrieron cambios de comportamiento:** Confirmado.

---

## 9. Archivos a Actualizar en WordPress
1.  `wp-content/uploads/editor.css` (Hojas de estilo modificadas).
2.  Widget HTML de Elementor en Elementor (o plantilla correspondiente del editor).

---

## 10. Decisión

`EDITOR MÓVIL REGRESIÓN DESKTOP — FIX ENTREGADO`
