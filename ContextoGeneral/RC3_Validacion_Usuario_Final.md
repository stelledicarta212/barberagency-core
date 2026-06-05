# RC-3 – Validación Real de Usuario Final

## Objetivo

Validar BarberAgency desde la perspectiva de un usuario real utilizando una barbería QA en producción.

Esta prueba debe confirmar que la Fuente Única de Verdad funciona correctamente desde el registro hasta la reserva pública sin depender de datos locales, mocks o bypasses.

---

# Escenario Completo

## Fase 1 – Dashboard

### Crear barbería QA

Validar:

* Nombre correcto
* Slug correcto
* Logo correcto
* Horarios correctos
* Servicios correctos
* Barberos correctos

Resultado esperado:

* Información visible en dashboard
* Persistencia correcta en PostgreSQL

Estado:

[ ] PASS
[ ] FAIL

---

## Fase 2 – Publicación

Publicar la barbería.

Validar:

* public_landing_url
* reservation_url
* qr_url

Resultado esperado:

* URLs generadas correctamente
* QR funcional

Estado:

[ ] PASS
[ ] FAIL

---

## Fase 3 – Landing Pública

Abrir landing pública.

Validar:

* Branding
* Servicios
* Barberos
* Horarios

Verificar que:

* No aparecen datos de otras barberías
* No aparecen datos privados

Estado:

[ ] PASS
[ ] FAIL

---

## Fase 4 – Reserva Pública

Crear reserva desde landing pública.

Validar:

* Selección de servicio
* Selección de barbero
* Fecha
* Hora

Resultado esperado:

* reserva_creada
* cita registrada

Estado:

[ ] PASS
[ ] FAIL

---

## Fase 5 – Dashboard

Ingresar nuevamente al dashboard.

Validar:

* La cita aparece inmediatamente
* Datos del cliente visibles
* Estado correcto

Estado:

[ ] PASS
[ ] FAIL

---

## Fase 6 – PostgreSQL

Verificar:

public.citas

public.clientes_finales

Resultado esperado:

* cliente creado o reutilizado
* cita persistida

Estado:

[ ] PASS
[ ] FAIL

---

## Fase 7 – Cancelación

Cancelar la cita desde dashboard.

Resultado esperado:

estado = cancelada

Estado:

[ ] PASS
[ ] FAIL

---

## Fase 8 – Revalidación de Slots

Intentar reservar nuevamente el mismo horario.

Resultado esperado:

* slot disponible nuevamente

Estado:

[ ] PASS
[ ] FAIL

---

# Validación Multi-Tenant

Intentar:

* acceder con barberia_id ajeno
* slug ajeno
* publicación ajena
* dashboard/state ajeno

Resultado esperado:

403 Forbidden

Estado:

[ ] PASS
[ ] FAIL

---

# Evidencia

Adjuntar:

* capturas
* respuestas HTTP
* consultas SQL
* URLs utilizadas
* IDs creados

---

# Resultado Final

GO

GO CON RESERVAS

NO GO

---

# Regla Obligatoria

Todo dato QA creado durante esta prueba debe quedar documentado.

Al finalizar:

* cancelar citas QA
* desactivar servicios QA
* eliminar descansos QA temporales
* documentar IDs afectados

No dejar residuos sin registrar.
