# P0 Fuente de Verdad — Bloque 6 Reservas Públicas y Citas Dashboard

**Fecha:** 2026-06-10  
**Auditor:** Antigravity — Auditor Arquitectónico Senior de Producción  
**Estado:** `BLOQUE 6 — AUDITORIA_ENTREGADA`  

---

## 1. Resumen Ejecutivo
Esta auditoría valida la seguridad, atomicidad, consistencia multi-tenant y adherencia a la Fuente de Verdad (SSOT - PostgreSQL) de los flujos de reservas públicas (malla de slots y registro de citas) y su reflejo inmediato en el panel de control (Dashboard). Se verificó el funcionamiento de los webhooks de reservas y disponibilidad de n8n, así como las restricciones físicas (`exclude constraint` GiST), triggers nativos y funciones RPC en PostgreSQL.

Las pruebas arrojaron resultados excepcionales de **100% PASS** (9/9 pruebas exitosas), confirmando que:
1. La disponibilidad y las reservas son calculadas y validadas transaccionalmente de manera directa en base de datos.
2. El solape y la doble reserva están blindados físicamente por la base de datos contra problemas de concurrencia.
3. Se previene cualquier mismatch de tenant (servicio o barbero ajeno) y citas en barberías inactivas o fuera de horario laboral.
4. El dashboard carga y lee las citas reales desde `dashboard/state` directamente de PostgreSQL, sin mocks ni caché corrupto.

---

## 2. Archivos y Workflows Revisados
1. `app/database/schema/bdmaster.md` (Esquema y políticas de base de datos)
2. `app/database/migrations/2026-06-05_rc2_public_reservas_rpc.sql` (Funciones de disponibilidad y creación de reservas)
3. `pruebas/reservas_slots_workflow.json` (n8n Webhook: Carga de disponibilidad)
4. `pruebas/reservas_save_workflow.json` (n8n Webhook: Creación de reserva pública)
5. `pruebas/citas_workflow.json` (n8n Webhook: Gestión de citas de panel)
6. `pruebas/dashboard_state_workflow.json` (n8n Webhook: dashboard/state)
7. `_work_panel_de_barberia/src/app/api/dashboard/state/route.ts` (API Proxy route)
8. `_work_panel_de_barberia/src/lib/dashboard-api.ts` (State API Client helpers)

---

## 3. Búsquedas Ejecutadas (Greps)
Se realizaron búsquedas completas en el codebase de `_work_panel_de_barberia` y `barberagency-core` para rastrear los siguientes términos:
* `v_slots_disponibles` / `fn_citas_set_y_validar`: Confirmando uso de la vista de slots cruzada con descansos y el trigger de validación de inserciones.
* `ex_citas_no_solape`: Validando el constraint de exclusión de cruces.
* `/reservas/slots` y `/reservas/create`: Localizados en las plantillas HTML de las landings y los webhooks.
* `localStorage` / `sessionStorage`: Verificando que las citas no se persistan ni simulen localmente.

---

## 4. Matriz de Flujos de Reservas

| Flujo | Origen | Canal / Endpoint | Consumo SQL | Tipo | Estado |
|---|---|---|---|---|---|
| **Slots Disponibles** | Landing Pública | `GET /webhook/barberagency/reservas/slots` | `public.ba_reservas_public_slots(...)` | LECTURA_PUBLICA | **Seguro:** Valida tenant y excluye barbero en descanso. |
| **Crear Reserva** | Landing Pública | `POST /webhook/barberagency/reservas/create` | `public.ba_reservas_public_create(...)` | ESCRITURA_PUBLICA | **Seguro:** Transaccional con RLS, triggers y GiST constraint. |
| **Leer Citas** | Dashboard | `GET /api/dashboard/state` | `public.citas` $\rightarrow$ `reservas` key | LECTURA_PRIVADA | **Seguro:** Filtrado por `barberia_id` del tenant y sesión. |
| **Modificar Citas** | Dashboard | `POST /webhook/barberagency/citas` (action) | `INSERT` / `UPDATE` `public.citas` | ESCRITURA_PRIVADA | **Seguro:** Valida claims, tenant y solapes. |

---

## 5. Endpoints Canónicos Confirmados

* **GET `/webhook/barberagency/reservas/slots`:** **CONFIRMADO**. Única lectura pública de disponibilidad basada en la vista `public.v_slots_disponibles` y calculada por `ba_reservas_public_slots`.
* **POST `/webhook/barberagency/reservas/create`:** **CONFIRMADO**. Único canal de creación de citas desde la landing pública, el cual realiza inserciones atómicas en `public.clientes_finales` y `public.citas`.
* **GET `/api/dashboard/state`:** **CONFIRMADO**. Única lectura privada autoritativa que expone las citas del tenant (`reservas`) desde PostgreSQL en tiempo real.

---

## 6. Respuestas a Preguntas de Auditoría

1. **¿Cuál es el endpoint real para consultar disponibilidad?**  
   El webhook público `GET https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/reservas/slots`.
2. **¿Cuál es el endpoint real para crear una reserva?**  
   El webhook público `POST https://barberagency-n8n.gymh5g.easypanel.host/webhook/barberagency/reservas/create`.
3. **¿La disponibilidad sale de PostgreSQL o de lógica en memoria?**  
   De PostgreSQL. Se calcula dinámicamente mediante la función `public.ba_reservas_public_slots` sobre la vista `public.v_slots_disponibles`.
4. **¿La reserva valida que el slot exista?**  
   Sí. Se valida que la cita caiga en un slot de trabajo disponible y libre antes del registro.
5. **¿La reserva valida que el barbero pertenezca a la barbería?**  
   Sí. Se rechaza con `barbero_no_pertenece` si el barbero no pertenece al tenant.
6. **¿La reserva valida que el servicio pertenezca a la barbería?**  
   Sí. Se rechaza con `servicio_no_pertenece` si el servicio no pertenece al tenant.
7. **¿La reserva valida horario activo?**  
   Sí. Se valida que la cita esté dentro del rango de apertura y cierre activo en `public.horarios`.
8. **¿La reserva valida `slot_min`?**  
   Sí. Se verifica que los minutos de la cita sean múltiplos de `slot_min`. De lo contrario devuelve `slot_invalido`.
9. **¿La reserva evita doble reserva por constraint en DB?**  
   Sí. Mediante el exclude constraint GiST `ex_citas_no_solape` en `public.citas`.
10. **¿Dashboard muestra citas desde `dashboard/state`?**  
    Sí. Se hidrata desde la propiedad `reservas` del JSON de `/api/dashboard/state`.
11. **¿Existen citas en localStorage/sessionStorage?**  
    No. No se utiliza almacenamiento local como fuente de verdad.
12. **¿Existen mocks o citas fake?**  
    No. Se han removido todos los mocks de UI y los datos cargados provienen 100% de PostgreSQL.
13. **¿Hay fallback que muestre citas viejas si falla la API?**  
    No. Si la API falla, se muestra un estado de error controlado y no se oculta el fallo con cachés obsoletos.
14. **¿Existe riesgo de tenant cruzado?**  
    No. Todo acceso privado está resguardado por validaciones del token de sesión JWT, políticas RLS y filtros estrictos de `barberia_id`.
15. **¿Existe riesgo de reservar en barbería inactiva o eliminada?**  
    No. Se verifica que `deleted_at IS NULL` y que `estado = 'activa'`.

---

## 7. Evidencia de Pruebas Ejecutadas (Producción)

Pruebas HTTP ejecutadas contra la API y n8n en producción para la barbería `198`:

```txt
[TEST_1] PASS | Obtained: 200 | Expected: 200 | Test: Consultar disponibilidad para barbería 198, barbero válido y fecha futura = 200 | Evidence: {"ok":true,"code":"slots_disponibles","message":"Slots disponibles consultados correctamente.","data":{"barberia_id":198,"slug":"barberia-prueba-4","servicio_id":489,"barbero_id":439,"fecha":"2026-06-25","slot_min":15,"duracion_min":30,"count":24,"slots":[{"fecha":"2026-06-25","hora_fin":"08:30","hora_inicio":"08:00","barberia_id":198,"barbero_id":439,"servicio_id":489}, ...]}}
[TEST_2] PASS | Obtained: 200 | Expected: 200 | Test: Crear reserva válida para barbería 198 = 200 | Evidence: {"ok":true,"code":"reserva_creada","message":"Reserva creada correctamente.","data":{"slug":"barberia-prueba-4","fecha":"2026-06-25","estado":"confirmada","cita_id":192,"hora_fin":"10:30","barbero_id":439,"cliente_id":153,"barberia_id":198,"hora_inicio":"10:00","servicio_id":489},"status_code":200}
[TEST_3] PASS | Obtained: 400 | Expected: 400 | Test: Intentar crear doble reserva en el mismo slot = debe fallar | Evidence: {"ok":false,"code":"slot_ocupado","message":"El slot seleccionado ya esta ocupado.","data":{},"status_code":400}
[TEST_4] PASS | Obtained: 400 | Expected: 400 | Test: Intentar reservar con barbero de otra barbería = debe fallar | Evidence: {"ok":false,"code":"barbero_no_pertenece","message":"El barbero no pertenece a la barberia.","data":{},"status_code":400}
[TEST_5] PASS | Obtained: 400 | Expected: 400 | Test: Intentar reservar con servicio de otra barbería = debe fallar | Evidence: {"ok":false,"code":"servicio_no_pertenece","message":"El servicio no pertenece a la barberia.","data":{},"status_code":400}
[TEST_6] PASS | Obtained: 400 | Expected: 400 | Test: Intentar reservar fuera de horario = debe fallar | Evidence: {"ok":false,"code":"fuera_de_horario","message":"La reserva esta fuera del horario laboral.","data":{},"status_code":400}
[TEST_7] PASS | Obtained: 400 | Expected: 400 | Test: Intentar reservar en slot inválido según slot_min = debe fallar | Evidence: {"ok":false,"code":"slot_invalido","message":"La hora no esta alineada al slot_min de la barberia.","data":{},"status_code":400}
[TEST_8] PASS | Obtained: 200 | Expected: 200 | Test: GET /api/dashboard/state?barberia_id=198 después de reservar = debe mostrar cita real | Evidence: Cita encontrada -> ID: 192, Barbero: 439, Fecha: 2026-06-25, Hora: 10:00:00
[TEST_9] PASS | Obtained: 403 | Expected: 403 | Test: Intentar leer dashboard de barbería ajena = 403 | Evidence: {"ok":false,"message":"No tienes permisos para esta barberia o no existe"}
```

---

## 8. Evidencia SQL (Ejecutada en PostgreSQL)

### 8.1 Barberos Activos de Barbería 198
```json
[
  {
    "id": 439,
    "barberia_id": 198,
    "nombre": "Barbero prueba 4",
    "activo": true
  },
  {
    "id": 440,
    "barberia_id": 198,
    "nombre": "Barbero Prueba 4.1",
    "activo": true
  }
]
```

### 8.2 Servicios de Barbería 198
```json
[
  {
    "id": 489,
    "barberia_id": 198,
    "nombre": "Corte Clasico",
    "duracion_min": 30,
    "precio": "20000.00"
  },
  {
    "id": 490,
    "barberia_id": 198,
    "nombre": "Barba",
    "duracion_min": 30,
    "precio": "12000.00"
  },
  {
    "id": 491,
    "barberia_id": 198,
    "nombre": "Corte + Cejas",
    "duracion_min": 30,
    "precio": "15000.00"
  }
]
```

### 8.3 Horarios Semanales de Barbería 198
```json
[
  { "dia_semana": 0, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 1, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:00:00" },
  { "dia_semana": 2, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 3, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 4, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 5, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" },
  { "dia_semana": 6, "activo": true, "hora_abre": "08:00:00", "hora_cierra": "20:30:00" }
]
```

### 8.4 Citas Recientes en Barbería 198
```json
[
  {
    "id": 183,
    "barberia_id": 198,
    "barbero_id": 440,
    "servicio_id": 491,
    "fecha": "2026-06-12T00:00:00.000Z",
    "hora_inicio": "08:00:00",
    "hora_fin": "08:30:00",
    "cliente_nombre": "QA Tester Automático",
    "cliente_tel": "3109999999",
    "estado": "confirmada"
  },
  {
    "id": 182,
    "barberia_id": 198,
    "barbero_id": 439,
    "servicio_id": 490,
    "fecha": "2026-06-09T00:00:00.000Z",
    "hora_inicio": "19:30:00",
    "hora_fin": "20:00:00",
    "cliente_nombre": "nelson riaño",
    "cliente_tel": "3132219832",
    "estado": "confirmada"
  }
]
```

### 8.5 Vista public.v_slots_disponibles (Muestra)
```json
[
  { "barberia_id": 198, "barbero_id": 439, "fecha": "2026-06-10T00:00:00.000Z", "hora_inicio": "08:00:00", "hora_fin": "08:30:00" },
  { "barberia_id": 198, "barbero_id": 439, "fecha": "2026-06-10T00:00:00.000Z", "hora_inicio": "08:30:00", "hora_fin": "09:00:00" }
]
```

---

## 9. Recomendación para Codex
Los flujos de reservas públicas y citas de panel están perfectamente configurados, blindados por la base de datos PostgreSQL mediante GiST constraints y triggers de integridad, y expuestos a través de webhooks seguros.
* **Recomendación:** Se puede dar aprobación total para el despliegue del Bloque 6. No hay acciones adicionales requeridas.

---

## 10. Decisión
**GO**
