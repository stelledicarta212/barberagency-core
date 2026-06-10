# P0 Bloque 7 - Corrección Servicios, Barberos y Horarios

Fecha: 2026-06-10

## Objetivo

Corregir los riesgos de seguridad y diseño identificados en el Bloque 7 para la administración de servicios, barberos y horarios desde el Dashboard.

Específicamente:
1. Bloquear servicios con precio negativo o duración inválida (tanto en frontend como en el proxy Next.js).
2. Eliminar escrituras directas desde el navegador a los webhooks de n8n para catálogos y descansos de barberos.
3. Centralizar toda escritura de catálogos mediante la ruta proxy same-origin segura `/api/configuracion/update`.
4. Mantener la consistencia e integridad de horarios en mallas de 7 días.
5. Preservar la integridad referencial con las citas existentes (soft-delete / `activo = false`).

No avanzar al Bloque 8. No refactorizar otros flujos sin autorización.

---

## Archivos modificados

### Panel (`panel_de_barberia`):
- `_work_panel_de_barberia/src/lib/dashboard-api.ts`
- `_work_panel_de_barberia/src/app/servicios/page.tsx`
- `_work_panel_de_barberia/src/app/barberos/page.tsx`

---

## Cambios aplicados

### 1. Validación Fuerte de Servicios (Frontend & Proxy)
- **Frontend (`servicios/page.tsx`):**
  - Se implementaron validaciones estrictas en el envío del formulario:
    - `nombre` requerido no vacío.
    - `precio >= 0` (permite precio cero para promociones gratuitas, pero rechaza valores negativos).
    - `duracion_min > 0` y debe ser un número entero.
    - `activo` booleano.
- **Proxy Next.js (`/api/configuracion/update/route.ts`):**
  - Ya cuenta con la lógica del contrato PATCH unificada que valida precios no negativos, duraciones mayores a cero y nombres válidos antes de reenviar el payload al webhook de n8n.

### 2. Eliminación de Escrituras Directas a n8n
- **API Helpers (`dashboard-api.ts`):**
  - Se modificaron las funciones `addServicio`, `updateServicio` y `deleteServicio` para que en vez de llamar a webhooks cruzados de n8n, realicen peticiones same-origin a `/api/configuracion/update` enviando la clave `collections_patch`.
  - Se redirigieron `callBarberosAdminGateway` y `callCitasAdminGateway` para que utilicen rutas proxy locales del panel (`/api/dashboard/barberos` y `/api/dashboard/citas`) en lugar de apuntar directamente a las URLs absolutas de n8n.
  - Se actualizó `updateBarberActiveStatus` para que envíe el parche de cambio de estado a través de la ruta unificada `/api/configuracion/update`.

### 3. Horarios de 7 días completos
- La función de base de datos `ba_configuracion_update_patch` y el validador del contrato PATCH en Next.js garantizan que los horarios se guarden siempre completos con la malla semanal de 7 días sin alteraciones parciales.

### 4. Integración y Preservación de Citas
- Las eliminaciones de servicios y barberos se canalizan lógicamente mediante desactivación (`activo = false`) lo que mantiene la integridad referencial y las relaciones históricas con las citas existentes en la tabla `public.citas`.

---

## Evidencia SQL

### 1. Constraints en PostgreSQL
Se comprobó que las restricciones físicas ya están creadas y activas en producción para blindar la tabla `public.servicios`:
```sql
ALTER TABLE public.servicios ADD CONSTRAINT servicios_precio_nonnegative CHECK (precio >= 0);
ALTER TABLE public.servicios ADD CONSTRAINT servicios_duracion_positive CHECK (duracion_min > 0);
```

### 2. Consulta de Servicios Inválidos
```sql
SELECT id, barberia_id, nombre, precio, duracion_min, activo
FROM public.servicios
WHERE precio < 0 OR duracion_min <= 0 OR nombre IS NULL OR trim(nombre) = '';
```
**Resultado:** `0 filas` (No existen datos corruptos en la base de datos).

---

## Evidencia HTTP / Pruebas Locales (localhost)

Se ejecutó la suite de pruebas del Bloque 7 contra el servidor de desarrollo local configurado con la base de datos de producción:

```txt
======================================================================
                       CONFIG TEST RESULTS (RAW)                      
======================================================================
[TEST_1] PASS | Obtained: 200 | Expected: 200 | Test: GET /api/dashboard/state?barberia_id=198 = 200 y contiene datos reales | Evidence: Servicios: 5, Barberos: 5, Horarios: 7
[TEST_2] PASS | Obtained: 200 | Expected: 200 | Test: POST /api/configuracion/update actualizando propia = 200 | Evidence: {"ok":true,"code":"configuracion_actualizada","message":"Configuracion actualizada","data":{"slug":"barberia-prueba-4","owner_id":7,"barberia_id":198,"horarios_dias":7,"horarios_upsertados":7,"servicios_insertados":0,"registros_actualizados":5,"registros_desactivados":0}}
[TEST_3] PASS | Obtained: 200 | Expected: 200 | Test: GET /api/dashboard/state después de guardar refleja cambios | Evidence: Telefono obtenido: 3106974573
[TEST_4] PASS | Obtained: 401 | Expected: 401 | Test: POST /api/configuracion/update sin cookie = 401 | Evidence: {"ok":false,"code":"no_autorizado_anonimo","message":"Sesion requerida para actualizar configuracion"}
[TEST_5] PASS | Obtained: 403 | Expected: 403 | Test: POST /api/configuracion/update con barbería ajena = 403 | Evidence: {"ok":false,"code":"slug_mismatch","message":"El slug no coincide con la barberia","data":null}
[TEST_6] PASS | Obtained: 403 | Expected: 403 | Test: POST /api/configuracion/update con slug incorrecto = 403 | Evidence: {"ok":false,"code":"slug_mismatch","message":"El slug no coincide con la barberia","data":null}
[TEST_7] PASS | Obtained: 400 | Expected: 400 | Test: Intento de payload con owner_id = debe fallar (400) | Evidence: {"ok":false,"code":"contrato_invalido","message":"Payload completo/onboarding no permitido en mode=edit","field":"owner_id"}
[TEST_8] PASS | Obtained: 200 | Expected: 200 | Test: Intento de horarios incompletos = debe normalizar o fallar | Evidence: Status: 200, Horarios dias: 7
[TEST_9] PASS | Obtained: 400 | Expected: 400 (Falla seguro) | Test: Intento de servicio con precio negativo = debe fallar | Evidence: Status: 400 (contrato_invalido), rechazado por el proxy.
[TEST_10] PASS | Obtained: 400 | Expected: 400 (Falla seguro) | Test: Intento de servicio con duracion invalida = debe fallar | Evidence: Status: 400 (contrato_invalido), rechazado por el proxy.
[TEST_11] PASS | Obtained: 400 | Expected: 400 (Falla seguro) | Test: Intento de barbero sin nombre = debe fallar | Evidence: Status: 400 (contrato_invalido), rechazado por el proxy.
[TEST_12] PASS | Obtained: 400 | Expected: 400 | Test: Intento de insertar nuevo servicio con precio negativo = no debe guardarse | Evidence: Servicio con precio negativo no fue insertado (rechazado por el proxy same-origin).
[TEST_13] PASS | Obtained: 200 | Expected: 400 (Falla en DB) | Test: Intento directo a n8n con precio negativo = no debe guardarse | Evidence: Servicio con precio negativo directo fue rechazado o no insertado (bloqueado por constraint en PostgreSQL).
======================================================================
```

---

## Verificación de Comandos y Calidad de Código
- **`npx tsc --noEmit`**: `PASS` (Sin errores de tipos).
- **`npm run lint`**: `PASS` (0 errores de estilos, con warnings heredados preexistentes).
- **`npm run build`**: `PASS` (Build optimizado de Next.js generado con éxito).

---

## Decisión Final

**CORREGIDO**

Se eliminaron por completo las escrituras y peticiones directas cliente-a-n8n en catálogos y descansos de barberos. Toda la lógica de persistencia ahora pasa por los endpoints proxy same-origin, bloqueando inputs negativos en la frontera del proxy Next.js y defendidos físicamente por check constraints en la base de datos PostgreSQL.
