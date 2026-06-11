# Auditoría del Frontend Móvil del Editor BarberAgency

## 1. Resumen Ejecutivo
Este reporte documenta el análisis técnico y diagnóstico del frontend del editor visual de **BarberAgency** (`landing_editor_v2_unico_vscode.html`). El objetivo de esta auditoría es evaluar la viabilidad de un rediseño de interfaz para dispositivos móviles que emule una aplicación nativa premium (estilo iPhone, fondo oscuro negro/grafito, detalles dorados, tarjetas con efecto de vidrio templado/glassmorphism y una barra de navegación inferior tipo dock), conservando la compatibilidad con el modo claro/oscuro y previniendo riesgos en la lógica de negocio, hidratación o compatibilidad desktop.

Se confirma que el diseño móvil es totalmente factible mediante una sobreescritura de reglas CSS y restructuración puramente visual del HTML (manteniendo los mismos IDs e inputs funcionales requeridos por la lógica Javascript).

---

## 2. Archivos Revisados
1. **Archivo de plantilla local:**
   - [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html) (Contiene la estructura HTML, estilos iniciales embebidos y lógica JS del editor).
2. **Archivo CSS externo importado:**
   - `https://barberagency-barberagency.gymh5g.easypanel.host/wp-content/uploads/editor.css?v=130` (Estilos globales, variables de color/tema y la mayor parte del diseño responsive y breakpoints).

---

## 3. Estructura Actual del Editor Móvil
Actualmente, en pantallas de resolución menor o igual a **900px** (`max-width: 900px`), el editor entra en modo móvil. La interfaz consiste en:
1. **Contenedor Principal (`#ba-editor-v2`):** Actúa como lienzo con un gradiente de fondo, con padding especial a la izquierda para acomodar el dock lateral.
2. **Dock de Navegación Lateral (`#baMobileDock`):** Actualmente se posiciona en el lado izquierdo del viewport (`position: fixed; left: 10px; top: 50%; transform: translateY(-50%)`), y NO en la parte inferior. Contiene botones circulares (`.ba-dock-btn`) para alternar las secciones visibles.
3. **Panel de Editor (`#ba-left` / `.ba-panel`):** Contiene los campos de texto e inputs de marca, mensaje, SEO y datos heredados. Se posiciona como una tarjeta flotante / hoja inferior deslizante (`bottom-sheet`) controlada por estados JS (`is-left-open`, `is-left-mid`, `is-left-full`).
4. **Vista Previa de Landing (`#ba-right` / `.ba-preview`):** Un frame flotante de fondo que simula un dispositivo móvil mediante un borde oscuro tipo marco de teléfono. Cuando el panel izquierdo se expande, la vista previa se escala hacia el fondo reduciendo su opacidad y rotando en perspectiva (`rotateY(-24deg)`).

---

## 4. Respuestas a Preguntas Obligatorias

### 1. ¿Dónde está definido el layout móvil actual del editor?
El layout responsive móvil está definido principalmente en dos ubicaciones:
* En el CSS externo `editor.css` bajo la directiva `@media (max-width: 900px)` (líneas 804–1544).
* En el script del editor `landing_editor_v2_unico_vscode.html` (líneas 465–601) que inyecta dinámicamente en el encabezado (`document.head`) un bloque `<style>` con clases móviles adicionales en `@media (max-width: 900px)`.
* Las posiciones y comportamientos de arrastre/apertura se coordinan con lógica JS inyectando clases de estado al contenedor raíz: `.is-left-open`, `.is-left-mid` e `.is-left-full`.

### 2. ¿Qué clases controlan el sidebar izquierdo?
* El contenedor principal es `<aside id="ba-left" class="ba-panel">`.
* Visualmente está controlado por `.ba-panel` (color de fondo, bordes, altura de trabajo).
* El estado móvil se gestiona mediante reglas CSS reactivas a clases en el contenedor raíz `#ba-editor-v2`:
  - `#ba-editor-v2.is-left-open #ba-left` controla la transición de entrada, escala, rotación 3D y opacidad.
  - `#ba-editor-v2.is-sheet-dragging #ba-left` suspende la animación de transición durante el arrastre manual con el handle.
  - La propiedad `leftPanel.dataset.mobileState` almacena el nivel actual (`'min'`, `'mid'`, `'full'`).

### 3. ¿Qué clases controlan el preview?
* El contenedor de la vista previa es `<section id="ba-right" class="ba-preview">`.
* Está controlado por la clase `.ba-preview` (diseño de flexbox, desbordamiento, bordes).
* En móvil, el selector `#ba-editor-v2 #ba-right.ba-preview` ancla fijamente el contenedor a la pantalla.
* Las transformaciones 3D de profundidad cuando el panel se expande son controladas por:
  - `#ba-editor-v2.is-left-mid #ba-right.ba-preview`
  - `#ba-editor-v2.is-left-full #ba-right.ba-preview`
* El iframe propiamente se controla con `#preview` (ancho máximo `430px`, borde simulado de teléfono, sombra y altura `--work-height`).

### 4. ¿Qué clases controlan los botones de acción?
* El panel de acciones en la cabecera usa la clase de agrupación `.ba-btns`.
* Los botones individuales usan la clase base `.ba-btn`, que tiene overrides en móvil para soportar blur (`backdrop-filter: blur(8px)`) y variaciones de color según su id (`#goSelector`, `#publish`, etc.).
* Internamente, los botones tienen un SVG con clase `.ba-btn-art` y un contenedor de texto `.ba-btn-label`.

### 5. ¿Existe menú inferior móvil actualmente?
No. Actualmente no existe un menú inferior tradicional. En su lugar, el dock de navegación móvil (`.ba-mobile-dock` / `#baMobileDock`) está anclado en el **lateral izquierdo** de la pantalla (`left: 10px; top: 50%; transform: translate3d(0, -50%, 0); flex-direction: column;`).

### 6. ¿Qué partes se pueden cambiar sin tocar lógica JS?
* Toda la paleta de colores y el estilo estético (mediante variables CSS `--page-bg`, `--panel-bg`, `--panel-border`, `--accent`, etc.).
* La posición física del dock de navegación (cambiar de anclaje lateral izquierdo a inferior usando CSS).
* El diseño de tarjetas, bordes curvos, sombras, y efectos glassmorphism (añadiendo `backdrop-filter: blur(...)` y bordes semitransparentes).
* Elementos del mockup del teléfono de previsualización (dimensiones, sombras, notch simulado, márgenes).
* La visualización y orden de los campos dentro del panel (mediante CSS Grid/Flexbox).

### 7. ¿Qué partes dependen de JS y no deben tocarse?
* **Los IDs de los botones principales:** `goRegistro`, `goSelector`, `openFinalPreview`, `saveDraft`, `publish`, `resetPalette`.
* **Los IDs de los inputs y campos de datos:** `biz_name`, `logo_width`, `font_pair`, `hero_kicker`, `hero_title`, `hero_subtitle`, `hero_btn_primary`, `hero_btn_secondary`, `palette_primary`, `palette_secondary`, `palette_accent`, `palette_text`, `address`, `logo_url`, `cover_url`, `maps_url`.
* **Los IDs de la navegación:** `baMobileDock`, `baMobileScrim`, `baSheetHandle` y las referencias con atributos `data-target` y `data-action` en los botones del dock.
* **Las clases del contenedor principal:** `.is-left-open`, `.is-left-mid`, `.is-left-full`, `.is-sheet-dragging` ya que son insertadas dinámicamente por eventos táctiles/mote en el DOM.

### 8. ¿Cómo se conservan los modos claro y oscuro?
* El editor utiliza variables CSS declaradas bajo el selector `#ba-editor-v2`.
* El modo oscuro móvil se aplica de forma predeterminada o mediante la propiedad `#ba-editor-v2[data-ui-theme='dark']` o clases globales del body (`body.dark-mode #ba-editor-v2`).
* El modo claro móvil se aplica redefiniendo esas mismas variables en los selectores `#ba-editor-v2[data-ui-theme='light']` o `body.light-mode #ba-editor-v2`.
* Se conservarán manteniendo el mismo esquema de herencia de variables CSS para ambos temas, ajustando la paleta de colores de acento dorado, gris oscuro/grafito para el modo oscuro, y tonalidades complementarias de alto contraste para el modo claro.

### 9. ¿Qué breakpoints móviles existen actualmente?
* El breakpoint móvil principal del editor se sitúa en **900px** (`max-width: 900px`). Este breakpoint es validado tanto por CSS como en JS mediante `const MOBILE_BREAKPOINT = 900;`.
* Hay un breakpoint intermedio en **1180px** (`max-width: 1180px`) que reestructura el layout de dos columnas a una sola columna vertical apilada antes de activar la UI móvil tipo App nativa.
* Existe un breakpoint de escritorio para resoluciones superiores en `min-width: 901px`.

### 10. ¿Qué archivo exacto se debe modificar para implementar el diseño?
* El archivo que centraliza la estructura y la inyección de estilos de la interfaz es [landing_editor_v2_unico_vscode.html](file:///C:/Users/calvi/OneDrive/n8n/Visual%20studio/barberagency-core/project/templates/editor/landing_editor_v2_unico_vscode.html).
* Específicamente, las reglas CSS de personalización deben implementarse dentro de la etiqueta `<style>` embebida al inicio de la plantilla HTML (líneas 8-168) para asegurar que se carguen de manera integrada con el widget en WordPress.

### 11. ¿Qué riesgos hay para desktop?
* El principal riesgo es alterar variables de color globales (ej. `--panel-bg`, `--text`) sin especificar el breakpoint móvil, lo que rompería la estética del editor en pantallas grandes.
* Reglas de layout mal encapsuladas fuera de `@media (max-width: 900px)` podrían desalinear las columnas y menús del entorno de escritorio.
* **Mitigación:** Asegurar que todo el CSS del rediseño móvil esté encapsulado estrictamente dentro del media query `@media (max-width: 900px)`.

### 12. ¿Qué riesgos hay para publicar/hidratación?
* La hidratación y guardado de datos dependen del mapeo exacto de los inputs. Cambiar la estructura HTML de los formularios eliminando o alterando el atributo `id` de los campos, o quitando los inputs ocultos (`palette_accent`, `palette_text`, `logo_url`, `cover_url`, `maps_url`), causará fallas críticas al generar el payload JSON (`buildSavePayload()`).
* **Mitigación:** Respetar la integridad de todos los inputs y botones funcionales. No cambiar nombres de funciones de envío ni eventos de click.

### 13. ¿Qué validaciones visuales se deben ejecutar?
1. Visualización correcta en computadoras de escritorio (pantalla de 2 columnas de ancho normal).
2. Apertura del panel deslizable en móvil mediante swipe táctil y pulsación en los botones del dock.
3. Posicionamiento del menú inferior a ras de pantalla con soporte para "Safe Area" de iOS/Android.
4. Efecto de desenfoque de fondo (`backdrop-filter`) en tarjetas flotantes y dock inferior.
5. Contraste de colores y legibilidad de textos dorados y blancos sobre fondo oscuro.
6. Cambiar de plantilla desde el dock móvil y verificar que la landing se actualice en el iframe.
7. Comprobación del alternador de tema Claro / Oscuro para garantizar que no haya texto invisible.

---

## 5. Clases Principales y su Propósito
A continuación se detallan las clases CSS fundamentales para la maquetación que deben mantenerse o adaptarse visualmente:

| Clase / ID | Elemento / Propósito |
|---|---|
| `#ba-editor-v2` | Contenedor raíz del editor. Almacena las variables de colores e hidratación de temas (`data-ui-theme`). |
| `#ba-left` / `.ba-panel` | Sidebar / Panel izquierdo de controles. Se rediseñará con un efecto de desenfoque glassmorphism y bordes curvos suaves. |
| `#ba-right` / `.ba-preview` | Panel derecho / Contenedor del mockup móvil. Alberga el iframe. |
| `.ba-mobile-dock` / `#baMobileDock` | Barra de navegación móvil. Se modificará de `position: fixed; left: 10px; top: 50%` a `bottom: 15px; left: 15px; right: 15px; flex-direction: row` para formar el dock inferior premium. |
| `.ba-dock-btn` | Botones de la barra de navegación móvil. |
| `.ba-btn` | Botón base de acción (guardar, publicar, etc.). |
| `.ba-section` | Secciones colapsables del panel (Marca, Mensaje, SEO, etc.). Se les aplicará fondo semi-transparente oscuro. |

---

## 6. Propuesta de Rediseño e Implementación Controlada
Para lograr la estética **BarberAgency Premium (Negro/Grafito/Dorado con Glassmorphism)** de forma controlada y segura:

1. **Paleta de Colores Dark Premium (Sobreescritura de Variables CSS):**
   Definir valores específicos dentro de la consulta móvil para el tema oscuro:
   ```css
   @media (max-width: 900px) {
     #ba-editor-v2[data-ui-theme='dark'] {
       --page-bg: #0b0b0e; /* Negro profundo */
       --panel-bg: rgba(18, 18, 22, 0.72); /* Grafito semi-transparente */
       --panel-border: rgba(212, 162, 76, 0.15); /* Borde dorado ultra sutil */
       --panel-input: rgba(30, 30, 35, 0.6);
       --text: #ffffff;
       --accent: #d4af37; /* Dorado canónico */
       --btn-bg-1: #d4af37;
       --btn-bg-2: #aa841c;
     }
   }
   ```

2. **Dock Inferior Premium (Efecto Glassmorphism):**
   Reposicionar el dock en la parte inferior y aplicar desenfoque de fondo avanzado:
   ```css
   @media (max-width: 900px) {
     #ba-editor-v2 .ba-mobile-dock {
       position: fixed;
       left: 16px !important;
       right: 16px !important;
       bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
       top: auto !important;
       transform: none !important;
       flex-direction: row !important;
       justify-content: space-around;
       padding: 12px 8px !important;
       border-radius: 24px !important;
       background: rgba(15, 15, 18, 0.8) !important;
       backdrop-filter: blur(20px) saturate(1.4) !important;
       border: 1px solid rgba(212, 162, 76, 0.25) !important;
       box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6) !important;
     }
     /* Mostrar nombres sutiles bajo los iconos */
     #ba-editor-v2 .ba-dock-btn span {
       display: block !important;
       font-size: 9px;
       margin-top: 3px;
     }
   }
   ```

3. **Mockup de Teléfono Móvil de la Landing:**
   Centrar y estilizar el iframe dentro de una card premium con blur suave para que parezca una app nativa:
   ```css
   @media (max-width: 900px) {
     #ba-editor-v2 #ba-right.ba-preview {
       background: rgba(20, 20, 25, 0.4) !important;
       backdrop-filter: blur(10px);
       border-radius: 32px;
       border: 1px solid rgba(255, 255, 255, 0.08);
     }
   }
   ```

---

## 7. Lista de Archivos a Modificar
Para aplicar los cambios en producción, únicamente se requiere actualizar:
* `project/templates/editor/landing_editor_v2_unico_vscode.html`

No se requiere modificar archivos de configuración, base de datos, APIs de backend ni lógica de negocio Javascript.

---

## 8. Confirmación de No Modificación de Código
Se certifica formalmente que durante esta auditoría **no se realizó ninguna modificación** sobre el código fuente, archivos de configuración de base de datos ni lógica JavaScript del editor de BarberAgency. Este entregable constituye únicamente un reporte de análisis y diagnóstico.

---

## 9. Decisión
`EDITOR MÓVIL UI — AUDITORÍA ENTREGADA`
