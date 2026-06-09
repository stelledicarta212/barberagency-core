# Reporte de QA de Producción — BarberAgency

* **Fecha de Ejecución**: 2026-06-09T23:32:32.472Z
* **Tenant Probado**: Barbería 198 (`barberia-prueba-4`)

## 1. Tabla de Resultados PASS/FAIL

| Sección | Prueba | Estatus | Evidencia |
| :--- | :--- | :--- | :--- |
| A. Login y sesión | 1. Login con usuario autorizado y obtención de ba_session | **PASS** | HTTP 200, Cookie: Recibida |
| A. Login y sesión | 2. session/me devuelve barbería 198 autorizada | **PASS** | HTTP 200, Barberia 198 en lista: true |
| A. Login y sesión | 3. dashboard/state devuelve 200 con datos reales | **PASS** | HTTP 200, Nombre Barbería: "Barberia Prueba 4" |
| B. Configuración | 1. /api/configuracion/update responde exitosamente | **PASS** | HTTP 200, Respuesta: configuracion_actualizada |
| B. Configuración | 2. Seguridad SQL (owner_id no cambia, hashes intactos) | **PASS** | owner_id actual: 7 (esperado 7), Hash de contraseñas intacto: true |
| C. Editor y publicación | 1. /api/editor/publish publica landing con respuesta 200 | **PASS** | HTTP 200, URL pública: https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-prueba-4 |
| D. Landing y reservas | 1. Carga de slots disponibles | **PASS** | HTTP 200, Slots encontrados: 24 |
| D. Landing y reservas | 2. Crear reserva QA y validar persistencia en PostgreSQL | **PASS** | Reserva creada: true, ID cita en DB: 184 |
| D. Landing y reservas | 3. El slot reservado queda ocupado / no disponible | **PASS** | Slot 08:30 disponible después de reservar: false |
| D. Landing y reservas | 4. Liberar reserva restaura la disponibilidad del slot | **PASS** | Slot 08:30 disponible después de liberar: true |
| E. Multi-tenant / seguridad | 1. Usuario dueño de 198 accede a otra barbería (ID 3) bloqueado | **PASS** | HTTP 403, Mensaje: "No tienes permisos para esta barberia o no existe" |
| E. Multi-tenant / seguridad | 2. Petición sin cookie / sesión bloqueada | **PASS** | HTTP 401, Mensaje: "Sesion no valida" |
| E. Multi-tenant / seguridad | 3. Cambiar email_contacto NO afecta el acceso al dashboard | **PASS** | HTTP 200, Acceso concedido: true |

## 2. Evidencia de Red (Network Logs)
* `POST /webhook/barberagency/dashboard/login` $\rightarrow$ HTTP 200 (Emite `ba_session`)
* `GET /api/session/me` $\rightarrow$ HTTP 200 (Filtra barberías por pertenencia/membresía)
* `GET /api/dashboard/state?barberia_id=198` $\rightarrow$ HTTP 200 (Carga datos reales del tenant)
* `POST /api/configuracion/update` $\rightarrow$ HTTP 200 (Guarda borrador en DB sin alterar dueños)
* `POST /api/editor/publish` $\rightarrow$ HTTP 200 (Publica diseño en base de datos)
* `GET /webhook/barberagency/reservas/slots` $\rightarrow$ HTTP 200 (Carga slots de disponibilidad real)
* `POST /webhook/barberagency/reservas/create` $\rightarrow$ HTTP 200 (Guarda cita en DB)

## 3. Evidencia SQL (PostgreSQL)
* **Creación de Citas**: Se verificó la inserción directa en la tabla `public.citas` mediante consulta post-reserva.
* **Protección del Owner**: Se corroboró mediante DDL y consultas que el campo `owner_id` no es alterado por las actualizaciones de configuración comercial.
* **Desacople de email_contacto**: El cambio manual de `email_contacto` no impidió ni alteró la autenticación del dashboard del owner de la barbería.

## 4. Riesgos Encontrados
1. **Riesgo de Concurrencia de Slots**: Si dos usuarios intentan reservar el mismo slot al mismo milisegundo, la función `ba_reservas_public_create` debe gestionar correctamente la atomicidad mediante bloqueos de fila (`SELECT ... FOR UPDATE`). Actualmente n8n confía en la base de datos para abortar por conflictos de unicidad.
2. **Dependencia de la compilación de Next.js**: Cualquier cambio menor en el proxy requiere compilar y re-desplegar la imagen de Next.js. Se recomienda monitorear con herramientas de APM las llamadas del editor para detectar latencias en el proxy.

## 5. Recomendaciones
1. Continuar con el despliegue del proxy same-origin en producción de EasyPanel.
2. Migrar los 7 candidatos a admin listados en el reporte P0 anterior para evitar que pierdan acceso si no se les han creado membresías en `barberia_miembros`.
