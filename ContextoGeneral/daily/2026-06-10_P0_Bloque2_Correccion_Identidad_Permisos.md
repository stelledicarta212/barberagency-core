# P0 Fuente de Verdad - Bloque 2 Correccion Identidad y Permisos

Fecha: 2026-06-10

## Objetivo

Corregir los riesgos aprobados del Bloque 2 sin avanzar a Bloque 3:

- Blindar `POST /api/pos`.
- Eliminar fallback inseguro de `dashboard-api.ts`.
- Restringir `localStorage/sessionStorage` como autoridad de identidad.
- Consolidar login en `/api/session/login`.
- Verificar que `email_contacto` no sea autorizacion.

## Archivos Revisados

- `_work_panel_de_barberia/src/app/api/pos/route.ts`
- `_work_panel_de_barberia/src/lib/dashboard-api.ts`
- `_work_panel_de_barberia/src/lib/barbershop-context.ts`
- `_work_panel_de_barberia/src/app/api/auth/login/route.ts`
- `_work_panel_de_barberia/src/app/api/session/login/route.ts`
- `_work_panel_de_barberia/src/app/api/session/me/route.ts`
- `_work_panel_de_barberia/src/app/api/dashboard/state/route.ts`

## Archivos Modificados

- `_work_panel_de_barberia/src/app/api/pos/route.ts`
- `_work_panel_de_barberia/src/lib/dashboard-api.ts`
- `_work_panel_de_barberia/src/lib/barbershop-context.ts`
- `_work_panel_de_barberia/src/app/api/auth/login/route.ts`
- `ContextoGeneral/daily/2026-06-10_P0_Bloque2_Correccion_Identidad_Permisos.md`

## Cambios Implementados

### POST /api/pos

- Ahora exige cookie `ba_session`.
- Sin cookie devuelve `401`.
- Lee `barberia_id` del payload.
- Valida acceso llamando server-side a `dashboard/state` con la cookie.
- Si `dashboard/state` devuelve `401/403`, no reenvia a n8n POS.
- Solo reenvia al webhook POS cuando el usuario tiene acceso al tenant.

### dashboard-api.ts

- Eliminado fallback en `catch` de `getDashboardState`.
- Eliminadas consultas directas a PostgREST desde el fallback.
- Eliminada generacion de mocks `Alex M.`, `James V.`, `Aldo H.` en el flujo de `dashboard/state`.
- Si `/api/dashboard/state` falla, ahora propaga error claro.
- `loginDashboard()` usa `/api/session/login`.

### barbershop-context.ts

- `resolveBarbershopIdentity()` ya no devuelve identidad desde localStorage/sessionStorage.
- Storage queda como cache UX, no autoridad final.
- La identidad privada debe venir de URL validada contra `session/me` o de `session/me/current_barberia`.

### /api/auth/login

- Marcado como deprecated seguro.
- Devuelve `410 endpoint_deprecated`.
- No maneja credenciales ni cookies.
- Login canonico: `/api/session/login`.

### email_contacto

- Busqueda en `_work_panel_de_barberia/src` no encontro uso de `email_contacto` como autorizacion.
- `email_contacto` queda como dato comercial.
- La autorizacion se valida por `owner_id` y `barberia_miembros`.

## Endpoints Postman/HTTP Probados

Ambiente: `Local Next proxy + n8n/PostgreSQL produccion QA`

Base URL: `http://127.0.0.1:3100`

| Endpoint | Metodo | Caso | Esperado | Obtenido | Resultado |
| --- | --- | --- | --- | --- | --- |
| `/api/session/me` | GET | Sin cookie | 401 | 401 | PASS |
| `/api/session/me` | GET | Cookie valida QA | 200 | 200 | PASS |
| `/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4` | GET | Barberia propia | 200 | 200 | PASS |
| `/api/dashboard/state?barberia_id=3` | GET | Barberia ajena | 403 | 403 | PASS |
| `/api/dashboard/state?barberia_id=198&slug=slug-ajeno` | GET | Slug incorrecto | 403 | 403 | PASS |
| `/api/pos` | POST | Sin cookie | 401 | 401 `sesion_requerida` | PASS |
| `/api/pos` | POST | Barberia ajena | 403 | 403 `sin_permiso` | PASS |
| `/api/pos` | POST | Barberia propia, payload QA invalido | 200 o error controlado webhook | 200 `ok=false`, `Error al registrar pago` | PASS |

## SQL Ejecutado

```sql
SELECT json_build_object(
  'owner', (SELECT row_to_json(x) FROM (
    SELECT b.id, b.owner_id, u.email AS owner_email, b.email_contacto
    FROM public.barberias b
    LEFT JOIN public.usuarios u ON u.id = b.owner_id
    WHERE b.id = 198
  ) x),
  'memberships', (SELECT COALESCE(json_agg(m), '[]'::json) FROM (
    SELECT bm.barberia_id, bm.usuario_id, u.email, bm.rol, bm.activo
    FROM public.barberia_miembros bm
    JOIN public.usuarios u ON u.id = bm.usuario_id
    WHERE bm.usuario_id = 7
    ORDER BY bm.barberia_id
  ) m),
  'pagos_count', (SELECT count(*) FROM public.pagos)
) AS state;
```

```sql
SELECT json_build_object(
  'pagos_count', (SELECT count(*) FROM public.pagos),
  'email_contacto_auth_check', (SELECT json_build_object(
    'barberia_id', b.id,
    'owner_id', b.owner_id,
    'email_contacto', b.email_contacto,
    'email_contacto_equals_owner_email', COALESCE(b.email_contacto = u.email, false)
  )
  FROM public.barberias b
  LEFT JOIN public.usuarios u ON u.id = b.owner_id
  WHERE b.id = 198)
) AS state;
```

## Resultado DB

- `barberia_id=198` tiene `owner_id=7`.
- Usuario QA `7` tiene membresias activas owner en sus barberias QA.
- `email_contacto` coincide con owner email en la QA, pero no fue usado como autorizacion por codigo del panel.
- `pagos_count` antes: `16`.
- `pagos_count` despues de pruebas POS fallidas/no autorizadas: `16`.
- POS no creo registros cuando fallo auth o tenant.

## Verificaciones de Codigo

- `dashboard-api.ts` no contiene `safeGetArray`.
- `dashboard-api.ts` no contiene mocks `Alex M.` ni `James V.` en el flujo de fallback.
- `loginDashboard()` llama `/api/session/login`.
- `/api/auth/login` no procesa credenciales.
- `barbershop-context.ts` no resuelve identidad final desde storage.

## Build y Lint

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS con warnings preexistentes, 0 errores.
- `npm run build`: PASS despues de limpiar `.next` generado por EPERM de Windows/OneDrive.

## Riesgos Eliminados

- POS anonimo.
- POS con tenant ajeno desde proxy Next.
- Fallback directo a PostgREST en `dashboard-api.ts`.
- Mocks de barberos generados por fallback de `dashboard/state`.
- Login duplicado activo en `/api/auth/login`.
- Cache local como autoridad final de identidad.

## Riesgos Pendientes

- Existen datos demo `Alex M.` en paginas/mocks fuera del fallback productivo (`citas`, `clientes`, `mock-dashboard-data`). No se tocaron porque el alcance aprobado era Bloque 2 y `dashboard-api.ts`.
- Existen otros endpoints directos a n8n en dominios que pertenecen a bloques posteriores. No se tocaron.

## Decision

GO CON RESERVAS para Bloque 2.

No avanzar a Bloque 3 hasta aprobacion explicita.
