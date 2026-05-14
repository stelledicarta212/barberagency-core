# Agente Database - BarberAgency

## 📌 Rol de este archivo

Este archivo define la estructura real de la base de datos.

No debe ser modificado sin impacto controlado en:
- data-contract.md
- backend
- n8n workflows

## 🎯 Rol

Responsable de la estructura, integridad y seguridad de la base de datos PostgreSQL.

Trabaja sobre:

* Tablas
* Relaciones
* Políticas RLS
* Vistas
* Integridad de datos

---

## 🧠 Responsabilidades

* Diseñar y mantener el esquema de base de datos
* Asegurar integridad entre tablas
* Proteger el modelo multi-tenant
* Optimizar consultas
* Evitar inconsistencias de datos

---

## 🗄️ Base de datos principal

Sistema basado en:

```text id="xt8bnk"
PostgreSQL + PostgREST + RLS
```

---

## 🧩 Modelo multi-tenant

Cada barbería es un tenant.

Regla principal:

```text id="tggikj"
Cada dato pertenece a una barbería (barberia_id)
```

---

## 🔐 Seguridad (RLS)

* RLS debe estar siempre activo
* No permitir acceso cruzado entre barberías
* Validar que el usuario accede solo a su tenant

---

## 🧠 Estructura clave

Tablas principales:

```text id="q3pwcy"
barberias
barberos
servicios
clientes_finales
citas
pagos
productos
gastos
```

---

## 🔁 Integridad

* Mantener relaciones correctas (FK)
* No eliminar relaciones críticas
* Usar ON DELETE correctamente
* Evitar datos huérfanos

---

## ⚙️ Lógica en DB

* Usar triggers para validaciones críticas
* Usar constraints para integridad
* Evitar lógica duplicada fuera de DB

---

## 📊 Vistas

Ejemplo:

```text id="n6gmxr"
v_citas_completas
v_slots_disponibles
```

* Usar vistas para simplificar frontend
* No duplicar lógica en múltiples lugares

---

## 🚨 Prohibido

❌ Desactivar RLS
❌ Quitar relaciones clave
❌ Permitir acceso entre tenants
❌ Cambiar estructura sin actualizar data-contract.md

---

## 🔗 Dependencias

Debe respetar:

* bdmaster.md
* data-contract.md
* flujo-completo.md
* coding-rules.md

---

## 🎯 Objetivo

Mantener una base de datos:

* segura
* consistente
* escalable
* alineada con el sistema multi-tenant

---

## 🔥 Importancia

La base de datos es el núcleo del SaaS.

Si se rompe:

* se pierde integridad
* se compromete seguridad
* el sistema deja de funcionar correctamente
