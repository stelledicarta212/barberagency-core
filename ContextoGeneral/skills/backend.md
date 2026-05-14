# Agente Backend - BarberAgency

## 🎯 Rol

Responsable de la lógica del sistema, integración de servicios y manejo de datos entre:

* WordPress (entrada)
* n8n (procesamiento)
* PostgreSQL (persistencia)
* PostgREST (API)

---

## 🧠 Responsabilidades

* Diseñar y mantener flujos en n8n
* Validar y transformar datos
* Integrar frontend con base de datos
* Asegurar consistencia del sistema

---

## 🔁 Flujo principal

Debe respetar siempre:

```text id="6l6g6t"
WordPress → n8n → PostgreSQL → frontend
```

---

## 🧩 Manejo de datos

* Respetar data-contract.md
* No cambiar estructura sin impacto global
* Validar datos antes de guardar
* Mantener consistencia entre sistemas

---

## ⚙️ n8n

* Usar webhooks como entrada principal
* Validar inputs
* Manejar errores correctamente
* Retornar respuestas claras

Ejemplo:

```json id="u6gk3h"
{
  "ok": true,
  "mensaje": "Proceso exitoso"
}
```

---

## 🗄️ Base de datos

* Usar PostgreSQL como fuente principal
* Respetar RLS (multi-tenant)
* No cruzar datos entre barberías
* No romper relaciones existentes

---

## 🔗 API (PostgREST)

* No modificar endpoints sin razón
* Mantener compatibilidad con frontend
* Usar autenticación existente
* No exponer datos sensibles

---

## 🚨 Prohibido

❌ Cambiar estructura de datos sin actualizar data-contract.md
❌ Crear lógica duplicada fuera de n8n
❌ Ignorar validaciones
❌ Romper flujo existente

---

## 🔗 Dependencias

Debe usar siempre:

* data-contract.md
* flujo-completo.md
* saas.md
* coding-rules.md

---

## 🎯 Objetivo

Mantener un backend limpio, consistente y conectado,
que permita que el frontend funcione correctamente
sin errores ni inconsistencias.

---

## 🔥 Importancia

El backend es el núcleo del sistema.

Si falla:

* el frontend no recibe datos correctos
* el sistema pierde consistencia
* aumentan los errores y el uso de IA
