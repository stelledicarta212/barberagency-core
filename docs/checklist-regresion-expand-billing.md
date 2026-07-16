# Checklist de Regresión - Módulo de Facturación SaaS

Este checklist recopila las validaciones lógicas y funcionales necesarias para confirmar que la aplicación del parche y la migración Core V2 de facturación **no generan regresiones** (efectos secundarios negativos) sobre el funcionamiento básico de BarberAgency.

---

## 1. Módulo de Autenticación y Onboarding

*   [ ] **Verificar Login de Propietario (Admin):**
    *   *Acción:* Iniciar sesión con una cuenta de barbería existente.
    *   *Esperado:* Acceso correcto, el token JWT (`ba_session`) se genera y almacena con éxito.
*   [ ] **Verificar Session/Me (`/rpc/session_me`):**
    *   *Acción:* Confirmar que el panel lee los datos de sesión del usuario.
    *   *Esperado:* Retorna el payload del usuario y confirma que no se ve bloqueado tras el desacoplamiento de planes.
*   [ ] **Onboarding de Barbería Nueva (Registro):**
    *   *Acción:* Crear una nueva cuenta de usuario e iniciar el registro de barbería.
    *   *Esperado:* El usuario (incluso con `plan_id = NULL` inicial) puede crear y registrar su barbería con éxito. El workflow `registro_barberia` no debe bloquear.

---

## 2. Módulo de Administración del Panel

*   [ ] **Visualización del Dashboard:**
    *   *Acción:* Ingresar al dashboard principal de una barbería activa.
    *   *Esperado:* Carga rápida de widgets principales, métricas básicas y barra de navegación.
*   [ ] **Gestión de Barberos:**
    *   *Acción:* Crear un barbero, modificar su horario de trabajo e inactivarlo.
    *   *Esperado:* Operación correcta en base de datos; RLS existente en `barberos` no se ve afectado.
*   [ ] **Gestión de Servicios:**
    *   *Acción:* Crear y actualizar un servicio (nombre, precio, duración).
    *   *Esperado:* Persistencia correcta.
*   [ ] **Gestión de Horarios Generales:**
    *   *Acción:* Modificar el horario de atención de la barbería.
    *   *Esperado:* Actualización correcta en `horarios`.

---

## 3. Módulo de Reservas Públicas (Citas)

*   [ ] **Carga de la Landing Page Pública:**
    *   *Acción:* Acceder a la URL pública de la barbería (`/barberia-slug`).
    *   *Esperado:* Carga del banner, listado de servicios disponibles y selección de barberos sin retraso.
*   [ ] **Creación de Cita (Reserva):**
    *   *Acción:* Seleccionar un turno libre y registrar una cita para un cliente final.
    *   *Esperado:* Inserción correcta en la tabla `citas`.
*   [ ] **Validación de `tiene_acceso()` (Trigger Acceso Reservas):**
    *   *Acción:* Reservar una cita en una barbería con suscripción activa (`status = 'active'`, `estado = 'activa'`).
    *   *Esperado:* La cita se registra con éxito.
    *   *Acción:* Intentar reservar en una barbería inactiva (o sin suscripción).
    *   *Esperado:* El trigger interrumpe y arroja la excepción: `Necesitas un plan activo para usar las reservas`.

---

## 4. Validación de Barberías Legacy (Históricas)

*   [ ] **Sincronización de Barberías Legacy Pro (Tarifa especial):**
    *   *Acción:* Confirmar que las 10 barberías Pro legacy (ej. IDs 175, 176, 186, etc.) tienen un plan Pro activo e indefinido o con vigencia correcta de 1 año.
    *   *Esperado:* Tienen acceso ininterrumpido a la creación de reservas de citas.
*   [ ] **RLS Existente en Core:**
    *   *Acción:* Validar que el trigger de auditoría de citas no bloquea transacciones del POS físico.
