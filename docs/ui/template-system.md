# Template System - BarberAgency

## 🎯 Objetivo

Definir cómo funcionan internamente las plantillas y cómo reciben datos del sistema.

Este archivo describe el comportamiento real del frontend.

---

## 🧠 Estructura del sistema

Cada plantilla funciona como:

```text
estructura HTML + estilos propios + datos dinámicos
```

---

## 🔁 Flujo de datos en frontend

```text
data-contract.md → theme-adapter.md → plantilla → render
```

---

## 🧩 Inyección de datos

Las plantillas NO generan datos.

Las plantillas SOLO consumen:

```text
{{nombre}}
{{logo}}
{{cover}}
{{servicios}}
```

---

## 🎨 Sistema de tema

Cada plantilla:

* Tiene estilo propio
* Pero usa variables CSS globales

Ejemplo:

```css id="vtsj0n"
body {
  background: var(--bg);
  color: var(--text);
}
```

---

## 🖼️ Manejo de contenido

Las plantillas deben:

* Mostrar datos dinámicos
* No definir contenido fijo
* No usar valores hardcodeados

---

## 🔄 Herencia de datos

El flujo correcto es:

```text
Onboarding → DB → data-contract → adapter → plantilla
```

👉 la plantilla NUNCA accede directo a DB

---

## ⚠️ Problemas comunes

❌ cada plantilla interpreta datos diferente
❌ uso de estilos fijos
❌ duplicación de lógica
❌ datos no conectados

---

## 🔗 Dependencias

* theme-adapter.md
* template-rules.md
* data-contract.md

---

## 🎯 Resultado esperado

* Todas las plantillas reciben datos igual
* Todas renderizan correctamente
* No hay inconsistencias visuales
* No se necesita intervención manual

---

## 🔥 Importancia

Este archivo define el comportamiento real del frontend.

Sin este sistema:

* las plantillas se vuelven inconsistentes
* el sistema pierde escalabilidad
