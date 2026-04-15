# Template Rules - BarberAgency

## 🎯 Objetivo

Definir reglas obligatorias para TODAS las plantillas.

---

## 🎨 Colores

❌ PROHIBIDO:

```css
background: black;
color: white;
```

✅ OBLIGATORIO:

```css
background: var(--bg);
color: var(--text);
```

---

## 🖼️ Logos

```html
<img src="{{logo}}" class="ba-logo" />
```

```css
.ba-logo {
  max-height: 60px;
  object-fit: contain;
}
```

---

## 🖼️ Imágenes

```html
<img src="{{cover}}" class="ba-cover" />
```

```css
.ba-cover {
  width: 100%;
  object-fit: cover;
}
```

---

## 🧠 Variables obligatorias

```text
{{nombre}}
{{logo}}
{{cover}}
```

---

## 🚨 Reglas críticas

* No lógica de tema
* No estilos duplicados
* No URLs hardcodeadas
* Todo dinámico

---

## 🧩 Estructura base

```html
<header></header>
<section></section>
<footer></footer>
```

---

## ✅ Resultado

✔ Plantillas reutilizables
✔ Sin errores de diseño
✔ Escalables
