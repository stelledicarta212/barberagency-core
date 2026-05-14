# Landing Page - Estructura y Funcionamiento

## Overview

La landing page es dinámica y generada mediante Elementor Pro. Cada barbería tiene su propia landing con branding personalizado.

## Estructura HTML

```
<header>
  - Logo (dinámico por barbería)
  - Navegación (Inicio, Servicios, Galería, Contacto)
  - CTA: "Reservar Cita"
</header>

<main>
  <section class="hero">
    - Imagen de fondo personalizada
    - Título: "Cortes profesionales en [Nombre Barbería]"
    - Subtítulo customizado
    - CTA principal: "Reserva tu cita ahora"
  </section>

  <section class="services">
    - Grid de 3-4 servicios
    - Nombre, descripción, precio
    - Botón "Agendar" por servicio
  </section>

  <section class="gallery">
    - Galería de fotos de trabajos
    - Lightbox modal
    - 12+ imágenes
  </section>

  <section class="testimonials">
    - Reseñas de clientes
    - Rating estrellas
    - Foto del cliente (opcional)
  </section>

  <section class="contact">
    - Ubicación en mapa
    - Horarios de atención
    - Formulario de contacto
    - Links a WhatsApp/Instagram/Facebook
  </section>
</main>

<footer>
  - Enlaces legales
  - Política de privacidad
  - Redes sociales
</footer>
```

## Formulario de Reserva

### Modal de Reserva (paso 1: Seleccionar servicio)
```
1. Dropdown de Servicios
2. Botón "Siguiente"
```

### Modal de Reserva (paso 2: Seleccionar barbero y horario)
```
1. Seleccionar Barbero (radio buttons)
2. Seleccionar Fecha (date picker)
3. Seleccionar Hora (slots disponibles)
4. Botón "Continuar"
```

### Modal de Reserva (paso 3: Datos de contacto)
```
1. Input: Nombre completo
2. Input: Teléfono
3. Input: Email
4. Textarea: Notas (opcional)
5. Checkbox: "Deseo confirmación por WhatsApp"
6. Botón: "Confirmar reserva"
```

## Ciclo de Carga

1. **Inicialización**: Script carga ID de barbería desde URL (¿subdomain o parámetro?)
2. **Fetch datos**: AJAX a `/api/barbershops/{id}` para obtener:
   - Logo, colores, información básica
   - Servicios
   - Fotos de galería
   - Testimonios
3. **Inyección dinámica**: CSS customizado (colores) + datos en HTML
4. **Interactividad**: Event listeners en CTA y formulario

## Colores Dinámicos

Los colores se aplican vía CSS custom properties:
```css
:root {
  --color-primary: var(--from-api);
  --color-secondary: var(--from-api);
  --color-accent: var(--computed);
}
```

Guardados en Elementor como "Global Settings"

## Integración n8n

Cuando se envía el formulario:
1. Validación frontend (mail, teléfono)
2. Envío a `POST /api/reservations`
3. API dispara webhook de n8n
4. n8n envía confirmación por WhatsApp
5. Response al frontend con ID de reserva

## SEO

- Title dinámico: "Cortes en [Ciudad] - [Barbería]"
- Meta description: Personalizadas
- Open Graph tags (imagen de barbería, título, descripción)
- Schema.org LocalBusiness marcado

## Performance

- Imágenes optimizadas (WebP, lazy loading)
- CSS crítico inline
- JavaScript deferido (excepto reserva)
- Cache en navegador (1 hora)
- CDN para assets estáticos

## Responsive

- Mobile-first design
- Tested en iOS (iOS 12+) y Android (5+)
- Touch-optimized formularios
- Viewport meta tag correcto

## Accesibilidad

- ARIA labels en formularios
- Contraste WCAG AA
- Navegación con teclado
- Alt text en todas las imágenes

## Variables Personalizables por Barbería

```javascript
{
  id: 1,
  name: "Barbería Central",
  slug: "barberia-central",
  logo_url: "https://...",
  color_primary: "#1a1a1a",
  color_secondary: "#d4af37",
  phone: "+34 600 123 456",
  email: "info@central.es",
  address: "Calle Principal, 123",
  city: "Madrid",
  whatsapp_number: "+34 600 123 456",
  instagram: "@barberia.central",
  website_custom: "https://www.barberia-central.es"
}
```
