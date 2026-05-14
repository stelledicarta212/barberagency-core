# Template Structure - BarberAgency

## 🎯 Objetivo

Definir la estructura obligatoria de todas las plantillas del sistema.

Este archivo garantiza:

* consistencia visual
* integración con el editor
* compatibilidad con el backend
* escalabilidad del SaaS

---

## 🧠 Principio clave

Las plantillas NO son sistemas independientes.

Son:

```text
renderizadores pasivos de datos
```

---

## 🧱 Estructura base obligatoria

Cada plantilla debe tener:

```text
#landingRoot
```

Ejemplo:

```html
<div id="landingRoot" data-theme="light">
  <!-- contenido -->
</div>
```

---

## 🎨 Sistema de tema

Las plantillas deben usar:

```text
data-theme="light" / "dark"
```

Y aplicar estilos así:

```css
#landingRoot[data-theme='light'] { ... }
#landingRoot[data-theme='dark'] { ... }
```

---

## 🚨 REGLA CRÍTICA

Las plantillas:

```text
NO definen el tema
```

El tema viene del:

```text
editor
```

---

## 🎨 Variables CSS

Las plantillas deben usar variables:

```css
background: var(--bg);
color: var(--text);
border-color: var(--primary);
```

---

## ❌ Prohibido

```css
background: #000;
color: #fff;
```

---

## 🧩 Estructura de secciones

Todas las plantillas deben incluir:

```text
✔ Hero
✔ Servicios
✔ Barberos
✔ Horarios / Mapa
✔ Reserva
✔ QR / compartir
```

---

## 📦 Datos dinámicos

Las plantillas reciben datos desde:

```text
editor → data-contract → render
```

---

## 🎯 Ejemplo

```text
{{barberia.nombre}}
{{servicios}}
{{barberos}}
```

---

## 🚨 Prohibido

```text
❌ datos hardcodeados
❌ servicios fijos
❌ nombres fijos
```

---

## 🧠 Responsabilidad

| Elemento | Responsable         |
| -------- | ------------------- |
| Datos    | onboarding / editor |
| Tema     | editor              |
| Render   | plantilla           |

---

## 🔗 Dependencias

Las plantillas deben respetar:

* template-engine.md
* template-system.md
* onboarding-system.md
* data-contract.md

---

## ⚠️ Errores comunes

```text
❌ cada plantilla con su sistema de colores
❌ lógica duplicada
❌ inconsistencia visual
❌ uso de valores fijos
```

---

## 🔥 Regla de oro

```text
Si una plantilla toma decisiones → está mal
Si solo muestra datos → está bien
```

---

## ✅ Resultado esperado

* plantillas consistentes
* integración automática
* bajo mantenimiento
* menor uso de IA

---

## 🚀 Importancia

Este archivo define cómo se construyen TODAS las plantillas.

Sin esto:

* el sistema se fragmenta
* aumenta la complejidad
* se rompe la escalabilidad

## 🖼️ Manejo de imágenes

Las plantillas deben recibir todas las imágenes como URLs.

Ejemplo:

{
  "barberia": {
    "logo": "https://...",
    "cover": "https://..."
  }
}

Reglas:

- No usar imágenes locales
- No hardcodear rutas
- Siempre usar URLs dinámicas
- Siempre validar que existan

Fallback:

Si no hay imagen:

- usar placeholder
- no romper layout

### 🔁 Fallback de imágenes

Si una imagen no existe:

* usar placeholder por defecto
* no romper el layout
* mantener proporciones visuales

Ejemplo:

```html
<img src="{{logo || '/assets/default-logo.png'}}" />
```

---

### 📏 Reglas de render

* Todas las imágenes deben tener:

  * width definido o responsive
  * aspect-ratio controlado
* No depender del tamaño original de la imagen

### ⚠️ Validación mínima

Antes de renderizar:

* validar que la URL exista
* evitar valores null o undefined
