# Onboarding System - BarberAgency

## 🎯 Objetivo

Definir cómo funciona el sistema de onboarding (registro de barbería) a nivel real.

Este archivo describe:

* flujo completo
* estructura de datos
* comportamiento del frontend
* conexión con backend

---

## 🧠 Descripción general

El onboarding es un sistema tipo wizard que:

* captura datos del negocio
* los valida
* los transforma
* los envía al backend

---

## 🔁 Flujo completo

```text id="qhv70t"
Usuario → Wizard (frontend) → draft → payload → API → backend (n8n / DB)
```

---

## 🧩 Estructura interna (frontend)

El sistema está dividido en pasos:

```text id="if1z67"
1. Datos de barbería
2. Servicios
3. Horarios
4. Barberos
5. Accesos
6. Confirmación
```

---

## 💾 Manejo de estado

El sistema usa:

```text id="wwcjpp"
localStorage → draft
```

---

### Ejemplo:

```json id="0yixej"
{
  "draft": {
    "barberia": {...},
    "servicios": [...],
    "horarios": [...],
    "barberos": [...],
    "accesos": {...}
  }
}
```

---

## 🔁 Transformación de datos

Antes de enviar:

* se normalizan valores
* se validan campos
* se estructura el payload

---

## 📦 Payload real

```json id="g9r86v"
{
  "draft": {
    "barberia": {
      "nombre": "Barbería Elite",
      "logo": "url"
    },
    "servicios": [...],
    "horarios": [...],
    "barberos": [...],
    "accesos": {
      "email": "admin@..."
    }
  }
}
```

---

## 🌐 Envío al backend

El payload se envía a:

```text id="xtxf3h"
endpoint (n8n webhook)
```

---

## 🎨 Sistema de tema

El onboarding usa:

```text id="dj4qzs"
[data-theme="light"]
[data-theme="dark"]
```

---

### Importante

Este sistema es independiente del global:

```text id="e4p79c"
body.light-mode
```

---

## ⚠️ Regla

Ambos sistemas deben mantenerse sincronizados a nivel visual.

---

## 🔗 Relación con otros sistemas

Este sistema conecta con:

* data-contract.md
* template-system.md
* theme-adapter.md

---

## 🧠 Responsabilidades del onboarding

✔ Capturar datos
✔ Validar datos
✔ Transformar datos
✔ Enviar datos

---

## 🚨 Lo que NO hace

❌ Renderizar plantillas
❌ Consultar base de datos
❌ Manejar lógica de negocio avanzada

---

## ⚠️ Problemas comunes

❌ datos inconsistentes
❌ estructura diferente al contrato
❌ duplicación de lógica
❌ desalineación con plantillas

---

## 🔥 Regla clave

El onboarding define el origen de todos los datos del sistema.

Si aquí falla:

* todo el sistema se rompe

---

## ✅ Resultado esperado

* datos consistentes
* payload limpio
* integración correcta con backend
* base sólida para render de plantillas

---

## 🚀 Importancia

Este archivo representa el punto de entrada del SaaS.

Es el inicio del flujo:

```text id="28lhbm"
onboarding → backend → DB → frontend → cliente final
```

---

## 🧠 Conclusión

El onboarding NO es solo un formulario.

Es un sistema crítico que:

* define los datos
* inicia el flujo
* impacta todo el SaaS
