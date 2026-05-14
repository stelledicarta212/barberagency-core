# Backend API - Endpoints

## Base URL
```
https://api.barberagency.com/v1
```

## Authentication
- Header: `Authorization: Bearer {JWT_TOKEN}`
- Header: `X-Tenant-ID: {BARBERSHOP_ID}`

---

## Servicios / Services

### GET /services
Obtiene lista de servicios de la barbería.

**Parámetros Query:**
- `active` (boolean): Filtrar por activos/inactivos
- `sort` (string): Campo a ordenar

**Respuesta:**
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "name": "Corte clásico",
      "description": "Corte tradicional",
      "duration_minutes": 30,
      "price": 15.00,
      "icon_url": "https://..."
    }
  ]
}
```

---

## Disponibilidad / Availability

### GET /availability/slots
Busca horarios disponibles.

**Parámetros Query:**
- `date` (YYYY-MM-DD): Fecha a consultar
- `barber_id` (number, opcional): ID específico de barbero
- `service_id` (number): ID del servicio

**Respuesta:**
```json
{
  "ok": true,
  "date": "2026-04-10",
  "slots": [
    { "time": "09:00", "barber_name": "Juan", "available": true },
    { "time": "09:30", "barber_name": "Carlos", "available": true }
  ]
}
```

### POST /availability/update
Actualiza disponibilidad de barbero (solo admin/barbero).

**Body:**
```json
{
  "barber_id": 1,
  "day_of_week": 1,
  "start_time": "09:00",
  "end_time": "18:00",
  "lunch_start": "13:00",
  "lunch_end": "14:00"
}
```

---

## Reservas / Reservations

### POST /reservations
Crea nueva reserva.

**Body:**
```json
{
  "customer_name": "Carlos López",
  "customer_phone": "+34 600 123 456",
  "customer_email": "carlos@email.com",
  "service_id": 1,
  "barber_id": 1,
  "reservation_date": "2026-04-10T10:00:00Z",
  "notes": "Con degradado"
}
```

**Respuesta:**
```json
{
  "ok": true,
  "id": 123,
  "status": "pending",
  "created_at": "2026-04-06T14:30:00Z"
}
```

### GET /reservations/{id}
Obtiene detalles de una reserva.

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "id": 123,
    "customer_name": "Carlos López",
    "service": "Corte clásico",
    "barber_name": "Juan",
    "reservation_date": "2026-04-10T10:00:00Z",
    "status": "confirmed",
    "price": 15.00
  }
}
```

### PUT /reservations/{id}
Actualiza una reserva (admin/barbero).

**Body (parcial):**
```json
{
  "status": "confirmed",
  "notes": "Nuevo comentario"
}
```

### DELETE /reservations/{id}
Cancela una reserva.

**Respuesta:**
```json
{
  "ok": true,
  "message": "Reserva cancelada"
}
```

---

## Clientes / Customers

### POST /customers
Registra nuevo cliente.

**Body:**
```json
{
  "name": "Ana García",
  "phone": "+34 600 654 321",
  "email": "ana@email.com",
  "whatsapp": "+34 600 654 321"
}
```

### GET /customers/{id}
Obtiene perfil de cliente.

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "id": 1,
    "name": "Ana García",
    "phone": "+34 600 654 321",
    "total_visits": 5,
    "last_visit": "2026-04-01T14:00:00Z"
  }
}
```

---

## Admin Endpoints

### GET /admin/stats
Dashboard de estadísticas.

**Parámetros Query:**
- `period` (day|week|month|year): Período

**Respuesta:**
```json
{
  "ok": true,
  "data": {
    "total_revenue": 1250.50,
    "reservations_today": 8,
    "customers_count": 45,
    "avg_rating": 4.8
  }
}
```

### GET /admin/barbers
Lista de barberos (solo admin).

### POST /admin/barbers
Crear nuevo barbero (solo admin).

### PUT /admin/barbers/{id}
Actualizar barbero (solo admin).

### DELETE /admin/barbers/{id}
Eliminar barbero (solo admin).

---

## Error Handling

**Formato de Error:**
```json
{
  "ok": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "status": 400
}
```

**Códigos Comunes:**
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

---

## Rate Limiting

- 100 requests/minuto por IP
- 1000 requests/hora por token

Headers de respuesta:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
