# n8n Workflow - Sistema de Reservas (n8n-reservas)

## Descripción General

Flujo de automatización que procesa reservas de citas, envía confirmaciones y recordatorios.

## Trigger

**Webhook POST**: `/webhook/reservations`

**Payload esperado:**
```json
{
  "type": "reservation.created",
  "data": {
    "reservation_id": 123,
    "customer_name": "Juan García",
    "customer_phone": "+34 600 123 456",
    "customer_whatsapp": "+34 600 123 456",
    "service": "Corte clásico",
    "barber_name": "Carlos",
    "date": "2026-04-10T14:30:00Z",
    "barbershop_id": 1,
    "barbershop_name": "Barbería Central",
    "notes": "Con degradado"
  }
}
```

---

## Flujo Principal

### 1. **Recibir Webhook** (n8n Webhook)
- Node: Webhook
- Esperando POST a `/webhook/reservations`
- Verifica signature (si se configura)

### 2. **Validar Datos** (Switch)
- Node: Switch
- Condicio 1: Data completa (customer_phone + fecha válida)
- Condición 2: Si falla → Branch de error

### 3. **Guardar en DB** (Postgres/MySQL)
- Node: Postgres Insert
- Tabla: `reservations`
- Inserta registro con status `pending`

### 4. **Enviar WhatsApp - Confirmación** (WhatsApp)
- Node: WhatsApp Twilio
- **Destinatario**: `{customer_whatsapp}`
- **Mensaje Template**:
```
¡Hola {customer_name}! 🎉

Tu cita en {barbershop_name} está confirmada:

📅 Fecha: {date_formatted}
💈 Servicio: {service}
💇 Barbero/a: {barber_name}
📍 Ubicación: {barbershop_address}
🆔 Código de reserva: {reservation_id}

¿Necesitas cambiar algo? Responde aquí o llama al {barbershop_phone}
```

### 5. **Actualizar BD - Status Confirmed** (Postgres Update)
- Node: Postgres Update
- Tabla: `reservations`
- Campo: `status = 'confirmed'`
- Where: `id = {reservation_id}`

### 6. **Programar Recordatorio 24h antes** (Cron/Delay)
- Node: Set Date (calculate 24h before)
- Output: `remindTime = {date} - 24h`

### 7. **Esperar 24h** (Schedule/Delay)
- Node: Delay (Duration en segundos)
- Calcula: `(remindTime - now) * 1000`
- Si es negativo → envía inmediatamente remindatorio

### 8. **Enviar WhatsApp - Recordatorio** (WhatsApp)
- Node: WhatsApp Twilio
- **Destinatario**: `{customer_whatsapp}`
- **Mensaje**:
```
⏰ Recordatorio: Tu cita en {barbershop_name}

👉 Mañana a las {time} con {barber_name}
📍 {barbershop_address}

¿Confirmado? Si tienes dudas, llámanos al {barbershop_phone}
```

### 9. **Actualizar BD - Recordatorio Enviado** (Postgres Update)
- Node: Postgres Update
- Campo: `reminder_sent = TRUE`

### 10. **Error Handling** (Catch)
- Si WhatsApp falla:
  - Registra en log
  - Retry automático en 5 minutos
  - Máximo 3 reintentos

---

## Triggers Adicionales (Otros Workflows)

### Workflow: Cancela de Reserva
**Trigger**: Webhook `POST /webhook/reservations/cancel`

```
1. Recibir cancelación
2. Validar ID de reserva
3. Actualizar BD (status = 'cancelled')
4. Enviar WhatsApp: "Tu cita ha sido cancelada"
5. Notificar barbero en Telegram/Email (admin)
```

### Workflow: Completar Reserva
**Trigger**: Webhook `POST /webhook/reservations/complete`

```
1. Recibir confirmación de completación
2. Actualizar BD (status = 'completed')
3. Pedir reseña por WhatsApp
4. Guardar reseña en DB
5. Enviar cupón descuento (próxima cita)
```

### Workflow: Disponibilidad Actualizada
**Trigger**: Webhook `POST /webhook/availability/update`

```
1. Recibir cambios de disponibilidad
2. Verificar reservas conflictivas
3. Si hay conflicto → notificar barbero para resolver
4. Actualizar caché de disponibilidad
```

---

## Variables Globales en n8n

```javascript
{
  TWILIO_ACCOUNT_SID: "...",
  TWILIO_AUTH_TOKEN: "...",
  TWILIO_PHONE_NUMBER: "+34...",
  DB_HOST: "localhost",
  DB_NAME: "barberagency",
  DB_USER: "dbuser",
  DB_PASSWORD: "...",
  WEBHOOK_SECRET: "...",
  TELEGRAM_BOT_TOKEN: "...",
  TELEGRAM_CHAT_ID: "..."
}
```

---

## Logs y Monitoring

- **Cada envío de WhatsApp**: Log en tabla `workflow_logs`
- **Errores**: Notificación a canal Telegram admin
- **Métricas**: Dashboard n8n con % éxito/fallo

---

## Extensión Futura

1. **Pagos**: Integración con Stripe antes de confirmar
2. **Múltiples canales**: SMS + Email + Push
3. **IA**: Sugerir horarios alternativos si no hay disponibilidad
4. **Feedback**: Reseña automática 3 días después
5. **Promociones**: Enviar beneficios según historial
