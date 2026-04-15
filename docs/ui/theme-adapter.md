# Theme Adapter - BarberAgency

## 🎯 Objetivo

Definir cómo los datos del onboarding se transforman y aplican en todas las plantillas.

Flujo:

onboarding → n8n → DB → adapter → plantilla

---

## 🧩 Entrada (data real)

```json
{
  "barberia": {
    "nombre": "Barbería Elite",
    "logo": "https://.../logo.png",
    "telefono": "+57..."
  },
  "theme": {
    "primary": "#D4AF37",
    "mode": "dark"
  },
  "media": {
    "cover": "https://.../cover.jpg",
    "gallery": ["img1.jpg", "img2.jpg"]
  }
}
```

---

## 🎨 Variables CSS estándar

```css
:root {
  --primary: #D4AF37;
  --bg: #0b0f17;
  --text: #ffffff;
  --card: #111827;
  --border: #1f2937;
}

body.light-mode {
  --bg: #ffffff;
  --text: #0f172a;
  --card: #f8fafc;
  --border: #e2e8f0;
}
```

---

## ⚙️ Adapter (JS)

```js
function applyTheme(config) {
  const root = document.documentElement;

  root.style.setProperty('--primary', config.theme.primary);

  if (config.theme.mode === "light") {
    document.body.classList.add("light-mode");
  } else {
    document.body.classList.remove("light-mode");
  }

  document.querySelectorAll(".ba-logo")
    .forEach(el => el.src = config.barberia.logo);

  document.querySelectorAll(".ba-nombre")
    .forEach(el => el.textContent = config.barberia.nombre);
}
```

---

## 🖼️ Imágenes

```text
config.media.cover
config.media.gallery[]
```

---

## 🚨 Reglas

* No hardcodear colores
* No lógica de tema en plantillas
* Todo pasa por adapter
* Variables CSS obligatorias

---

## ✅ Resultado

✔ Plantillas consistentes
✔ Dark/Light estable
✔ Sin bugs de herencia
✔ Menos uso de IA
