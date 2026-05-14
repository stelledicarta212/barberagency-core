# Template Lifecycle - BarberAgency

## 🎯 Objetivo

Definir el flujo completo desde que un usuario registra su barbería hasta que su landing queda publicada y accesible con QR.

Este documento conecta:

* onboarding
* editor
* n8n
* base de datos
* WordPress (render)
* plantillas

---

## 🧠 Principio clave

```text
EL ESTADO FINAL SIEMPRE VIENE DEL EDITOR
```

Las plantillas NO generan datos.
Las plantillas solo renderizan.

---

# 🔁 FLUJO COMPLETO DEL SISTEMA

## 1️⃣ Registro (Onboarding)

El usuario crea su barbería.

Se genera:

```json
{
  "barberia_id": 1,
  "nombre": "Barbería Elite",
  "slug": "barberia-elite",
  "servicios": [],
  "barberos": [],
  "horarios": []
}
```

Esto se guarda como:

```text
ba_landing_seed
```

---

## 2️⃣ Entrada al Editor

El editor:

* lee `ba_landing_seed`
* carga datos heredados
* permite modificar:

```text
✔ nombre
✔ branding
✔ colores
✔ logo
✔ textos
✔ botones
```

---

## 3️⃣ Estado Draft

El editor mantiene un estado local:

```text
ba_editor_draft
```

Incluye:

```json
{
  "branding": {},
  "contenido": {},
  "servicios": [],
  "barberos": [],
  "horarios": []
}
```

---

## 4️⃣ Selección de plantilla

El usuario elige:

```text
v1, v2, v3, v4, v5, v6
```

Se guarda:

```text
ba_selected_template
```

---

## 5️⃣ Preview (sin publicar)

El editor:

```text
envía datos al iframe
```

```js
postMessage(...)
```

La plantilla:

```text
renderiza en tiempo real
```

⚠️ No se guarda en BD aún

---

## 6️⃣ Publicar (EVENTO CRÍTICO)

Cuando el usuario hace:

```text
👉 PUBLICAR
```

Se ejecuta:

```text
publishLanding()
```

---

## 7️⃣ Construcción del payload

El editor genera:

```json
{
  "barberia_id": 1,
  "slug": "barberia-elite",
  "template_id": "v4",
  "template_file": "index_unico_v4_editorial.html",

  "inherited": {
    "servicios": [],
    "barberos": [],
    "horarios": []
  },

  "branding": {
    "logo_url": "...",
    "color_primary": "...",
    "hero_title": "...",
    "hero_subtitle": "..."
  },

  "public_landing_url": "...",
  "qr_url": "...",
  "reservation_url": "..."
}
```

---

## 🧠 REGLA CRÍTICA

```text
🔥 ESTE PAYLOAD ES EL ESTADO FINAL
🔥 ESTE ES EL QUE SE GUARDA
🔥 ESTE ES EL QUE SE RENDERIZA
```

---

## 8️⃣ Envío a n8n

```text
POST → /landing/save-v2
```

n8n:

```text
✔ valida datos
✔ genera URL final
✔ (opcional) genera QR
✔ guarda en PostgreSQL
```

---

## 9️⃣ Persistencia en DB

Se guarda:

```text
✔ template elegido
✔ branding final
✔ datos heredados
✔ URL pública
✔ QR
```

---

## 🔒 IMPORTANTE

```text
🔥 EL ESTADO SE CONGELA AQUÍ
```

Después de publicar:

```text
los cambios NO afectan automáticamente la landing
```

---

## 🔟 Render en WordPress

WordPress:

```text
carga la plantilla correspondiente
```

Ejemplo:

```text
/templates/v4/index.html
```

---

## 11️⃣ Render final

La plantilla recibe:

```json
{
  "barberia": {},
  "branding": {},
  "servicios": [],
  "barberos": [],
  "horarios": [],
  "qr": "..."
}
```

Y hace:

```text
solo render visual
```

---

# 🧠 RESPONSABILIDADES

| Sistema    | Responsabilidad        |
| ---------- | ---------------------- |
| Onboarding | datos iniciales        |
| Editor     | configuración + estado |
| n8n        | lógica + persistencia  |
| DB         | almacenamiento         |
| WordPress  | render                 |
| Plantilla  | visual                 |

---

# 🚨 ERRORES QUE NO DEBEN PASAR

```text
❌ plantilla generando QR
❌ plantilla creando datos
❌ cambios en editor afectando landing publicada
❌ múltiples fuentes de verdad
```

---

# 🔥 REGLA DE ORO

```text
EDITOR DEFINE
BACKEND GUARDA
PLANTILLA MUESTRA
```

---

# 🚀 RESULTADO

* sistema consistente
* flujo claro
* escalable
* listo para multi-tenant
* listo para automatización con agentes
