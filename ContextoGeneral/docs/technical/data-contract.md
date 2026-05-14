# Data Contract - BarberAgency (Aligned with BD)

## 🎯 Objetivo

Definir la estructura de datos que el frontend consume,
basada en la base de datos real (bdmaster.md).

Este contrato NO replica la BD, la adapta.

---

## 🧠 Principio clave

* BD = estructura interna
* Data Contract = datos listos para UI

---

## 📦 Estructura global

```json
{
  "barberia": {
    "id": 1,
    "nombre": "Barbería Elite",
    "slug": "barberia-elite",
    "logo": "url",
    "telefono": "string"
  },

  "tema": {
    "primary": "#D4AF37",
    "mode": "dark"
  },

  "servicios": [
    {
      "id": 1,
      "nombre": "Corte clásico",
      "duracion": 30,
      "precio": 20000
    }
  ],

  "barberos": [
    {
      "id": 1,
      "nombre": "Juan",
      "activo": true
    }
  ],

  "clientes": [
    {
      "id": 1,
      "nombre": "Carlos",
      "telefono": "300..."
    }
  ],

  "citas": [
    {
      "id": 1,
      "fecha": "2026-04-10",
      "hora_inicio": "10:00",
      "hora_fin": "10:30",
      "estado": "confirmada",

      "barbero": "Juan",
      "servicio": "Corte clásico",
      "cliente": "Carlos"
    }
  ],

  "pagos": {
    "total": 20000,
    "metodo": "efectivo"
  }
}
```

---

## 🔁 Relación con BD

| BD (bdmaster)    | Data Contract |
| ---------------- | ------------- |
| barberias        | barberia      |
| servicios        | servicios[]   |
| barberos         | barberos[]    |
| clientes_finales | clientes[]    |
| citas            | citas[]       |
| pagos            | pagos         |

---

## 🧠 Transformaciones importantes

### 1. IDs → nombres legibles

BD:

```text
barbero_id
servicio_id
```

Contrato:

```text
"barbero": "Juan"
"servicio": "Corte clásico"
```

---

### 2. joins resueltos

La BD tiene relaciones separadas
El contrato entrega datos listos

---

### 3. simplificación

Se eliminan:

* campos técnicos
* columnas internas
* datos irrelevantes para UI

---

## 🔗 Dependencias

Este contrato es usado por:

* theme-adapter.md
* template-system.md
* frontend
* plantillas

---

## 🚨 Reglas

* No cambiar nombres sin impacto global
* Mantener consistencia con BD
* No agregar campos inventados
* Toda modificación debe reflejar BD real

---

## ❌ Prohibido

❌ exponer IDs sin contexto
❌ enviar datos sin procesar
❌ duplicar estructuras
❌ romper consistencia

---

## ✅ Resultado

* Frontend recibe datos listos
* No necesita lógica compleja
* Menos errores
* Menos uso de IA

---

## 🔥 Importancia

Este archivo conecta:

BD → Backend → Frontend

Si está mal:

* se rompen plantillas
* fallan reservas
* aumenta la complejidad
