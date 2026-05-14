# BarberAgency - SaaS Multi-Tenant Overview

## Arquitectura General

**BarberAgency** es una plataforma SaaS multi-tenant para gestionar barberías.

### Características Principales

- **Multi-tenant**: Múltiples barberías en una instancia
- **Landing Page**: Generada dinámicamente por Elementor
- **Reservas Online**: Integración con n8n
- **Admin Dashboard**: WP Admin extensionado
- **API REST**: Endpoints para clientes y admin

### Stack Tecnológico

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla + jQuery)
- **Backend**: WordPress + PHP
- **Base de Datos**: MySQL/PostgreSQL
- **Automatización**: n8n (workflows)
- **Editor**: Elementor Pro
- **Hosting**: Cloud compatible

## Funcionalidades Core

### 1. Landing Page Dinámica
- Carga desde BD según barbería
- Elementos editables en Elementor
- Formulario de contacto/reserva
- Integración de WhatsApp
- Gallery de servicios

### 2. Sistema de Reservas
- Búsqueda de horarios disponibles
- Confirmación automática por WhatsApp
- Sincronización con calendario
- Recordatorios 24h antes

### 3. Admin Panel
- Gestión de servicios y precios
- Calendario de barbero
- Historial de clientes
- Reportes de ingresos

## Estructura de Datos

```
/wp-content/
  /plugins/
    /barbera-plugin/
      api/
      admin/
      frontend/
  /themes/
    /barbera-theme/
      landing/
      dashboard/
```

## Endpoints API (Previstos)

- `GET /api/barbers/{id}/services` - Listar servicios
- `GET /api/availability/{id}/slots` - Horarios libres
- `POST /api/reservations` - Crear reserva
- `GET /api/reservations/{id}` - Ver reserva
- `PUT /api/barbers/{id}/availability` - Actualizar disponibilidad

## Seguridad

- JWT para API
- Role-based access (admin, barbero, cliente)
- Validación de NONCE en formularios WP
- SQL injection prevention

## Próximas Mejoras

- App móvil nativa
- Inteligencia artificial para sugerencias de horario
- Sistema de loyalty/puntos
