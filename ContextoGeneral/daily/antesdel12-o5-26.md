# Bitácora de trabajo (antes del 12-05-26)

## 1. Objetivo general trabajado
Se construyó y refinó el dashboard de BarberAgency con enfoque visual premium (tema oscuro/claro, dorado), responsive real (móvil y desktop), y comportamiento dinámico entre módulos: Panel, Citas, Clientes, Barberos, Servicios, Programa de Lealtad y Caja/POS.

## 2. Cambios principales por módulo

### Panel
- Ajustes de layout para usar mejor ancho/alto de pantalla.
- Reorganización de tarjetas para evitar vista “amontonada”.
- Integración visual de marca (logo + nombre barbería heredados).
- Menú móvil rediseñado (más legible, mejor espaciado, jerarquía visual).

### Citas
- Formulario de nueva cita con cliente, teléfono, servicios, barbero, hora y fecha.
- Selección de servicios mejorada (botones dorados y total dinámico).
- Calendario principal para revisar días y calendario de reserva para agendar.
- Tabla/listado de solicitudes adaptado para móvil (flujo de alto volumen).
- Acciones: ver, editar, enviar y borrar cita.
- Edición real de cita (no duplicar cuando se edita).
- Tarjeta de detalle centrada al dar “ver”.
- Enlace por teléfono a WhatsApp del cliente.
- Estados visuales y chips coherentes en claro/oscuro.
- Vista de agenda por hora mejorada para mostrar ocupación.
- Se agregó reloj del sistema + tasa de ocupación (basada en reservas del día).
- Filtro de agenda: global + por barbero.

### Clientes
- Rediseño de tabla/lista móvil para evitar desborde y lectura mala.
- Cliente sin foto: uso de iniciales (avatar textual).
- Tarjeta dinámica del cliente seleccionado (aparece/oculta según selección).
- Tarjeta con datos clave: contacto, última visita, barbero, servicio, sellos.
- Integración de acceso rápido por WhatsApp desde teléfono.
- Ajustes de centrado/posición de popups en móvil.

### Barberos
- Sección visual similar al diseño premium solicitado.
- Mejor manejo de avatar/foto para evitar recortes feos.
- Panel derecho cambiado a disponibilidad (activo/inactivo) con color:
  - Activo = verde
  - Inactivo = rojo
- Botones de cambio manual de estado por barbero.
- Calendarización de descanso por barbero:
  - Selección de día de descanso (se marca)
  - Sincronía con estado del barbero
- Opción “Editar barberos” enlazada a Registro Barbería.
- Métricas en tarjeta: servicios hoy / servicios mes y resumen por barbero.
- Coordinación esperada con Citas para ocultar barberos inactivos o en descanso.

### Servicios
- Rediseño de sección para estilo premium tipo cards/lista.
- Panel lateral con top servicios, ingresos por servicio y promos.
- Botón “Agregar servicio” enlazado a Registro Barbería.
- Se pidió y dejó herencia de servicios desde editor/registro (fuente de verdad).
- Soporte de imágenes heredadas por múltiples campos posibles.
- Fallback de imagen por defecto bonita cuando no hay imagen real.
- Ajustes para evitar imágenes aleatorias sin relación con la barbería.

### Programa de Lealtad / Fidelización
- Estructura frontend de Plan PRO definida:
  1) Tarjeta de sellos editable
  2) Cumpleaños cliente
  3) Recordatorio de inactivos
  4) Beneficios en horas muertas
- Todo planteado como configurable desde dashboard.
- Herencia esperada hacia landing y reservas.
- Diseño de tarjetas mejorado (menos transparencia y mejor legibilidad).

### Caja / POS
- Sustitución del enfoque de inventario por módulo tipo caja/cierre.
- Vista de movimientos, cierre por barbero y totales.
- Solicitud de opción para impresión de tirilla de cierre.
- Ajustes visuales para consistencia con el resto del dashboard.

## 3. Responsive y UX
- Múltiples iteraciones en móvil para:
  - evitar bloques superpuestos,
  - evitar tarjetas “detrás” del menú,
  - separar mejor menú y contenido,
  - mantener navegación visible sin romper layouts.
- Ajustes de topbar móvil (logo, nombre, búsqueda, botones de tema/pro).
- Mejora de tamaños de botones y contraste en selects (texto visible en claro/oscuro).

## 4. Sincronizaciones y lógica cruzada (frontend)
- Coordinación entre Barberos y Citas para disponibilidad.
- Persistencia local para estados de barbero/descanso y reservas.
- Filtros de agenda por barbero con lectura de reservas del día.
- Cálculo visual de ocupación con base en reservas creadas.

## 5. Problemas encontrados durante el proceso
- Errores de conexión local (localhost/puerto apagado).
- Errores de encoding UTF-8 en archivos TSX.
- Error EPERM de Next.js al renombrar archivos temporales.
- Diferencias entre vista móvil y desktop que exigieron ajustes separados.
- En algunos momentos la fuente de servicios no venía del remoto por configuración/fallback.

## 6. Decisiones de producto/diseño tomadas
- Mantener estética dorado + oscuro/claro en todo el dashboard.
- Priorizar usabilidad móvil del admin (no solo desktop).
- Mostrar detalle en tarjetas/popup para evitar tablas gigantes en móvil.
- Centralizar edición real en dashboard, pero redirigir cambios maestros a Registro Barbería cuando aplica.

## 7. Estado funcional acumulado
- Base del dashboard ya avanzada y visualmente consistente.
- Flujos principales implementados en frontend.
- Aún hay puntos de ajuste fino en sincronización completa de datos remotos y consistencia final entre módulos.
