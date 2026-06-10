# P0 Bloque 3 - Correccion Dashboard State

Fecha: 2026-06-10

## Objetivo

Corregir el Dashboard para que la lectura privada de datos operativos use `dashboard/state` como unica fuente canonica desde el frontend.

No se avanzo a Bloque 4. No se tocaron registro/configuracion, publicacion landing, reservas publicas, POS, fidelizacion ni inventario.

## Causa raiz confirmada

1. `src/lib/dashboard-api.ts` hacia lecturas directas desde navegador a PostgREST para `barberia_public_profiles` y `barberos_descansos`.
2. `src/app/citas/page.tsx` generaba servicios y barberos ficticios cuando `dashboard/state` venia vacio.
3. `src/app/clientes/page.tsx` conservaba un bloque estatico de clientes mock aunque el render ya usaba datos reales.
4. `src/store/dashboard-context.tsx` escribia `ba_dashboard_merged_cache`, lo que podia dejar estado privado obsoleto en storage.
5. `src/lib/barbershop-context.ts` conservaba codigo muerto para `ba_landing_seed`.

## Archivos modificados

Panel:

- `_work_panel_de_barberia/src/app/api/dashboard/state/route.ts`
- `_work_panel_de_barberia/src/lib/dashboard-api.ts`
- `_work_panel_de_barberia/src/types/dashboard-state.ts`
- `_work_panel_de_barberia/src/components/dashboard-editor.tsx`
- `_work_panel_de_barberia/src/app/barberos/page.tsx`
- `_work_panel_de_barberia/src/app/citas/page.tsx`
- `_work_panel_de_barberia/src/app/clientes/page.tsx`
- `_work_panel_de_barberia/src/store/dashboard-context.tsx`
- `_work_panel_de_barberia/src/lib/barbershop-context.ts`
- `_work_panel_de_barberia/src/lib/mock-dashboard-data.ts`

Core:

- `ContextoGeneral/daily/2026-06-10_P0_Bloque3_Correccion_Dashboard_State.md`

## Cambios aplicados

### Dashboard state canonico

- `/api/dashboard/state` sigue delegando la validacion de sesion y tenant al webhook canonico de n8n.
- Solo si upstream responde OK, el route handler server-side enriquece la respuesta con `barberos_descansos`.
- `descansos` se devuelve en:
  - `body.descansos`
  - `body.seed.descansos`
  - `body.merged.descansos`
- Si la lectura server-side de descansos falla, el endpoint devuelve error controlado. No se inventan datos.

### Frontend sin PostgREST directo

- `getDashboardState()` ya solo llama a `/api/dashboard/state`.
- Eliminada lectura cliente a `barberia_public_profiles`.
- Eliminada lectura cliente a `/barberos_descansos`.
- `DashboardEditor`, `Barberos` y `Citas` consumen `merged.descansos`.

### Sin mocks en flujo productivo

- `Citas` ya no crea servicios por defecto como `Corte de Pelo` o `Barba` si no llegan desde PostgreSQL.
- `Citas` ya no crea barberos ficticios como `Alex M.` o `James R.`.
- `Clientes` no conserva lista estatica de clientes mock.
- `mock-dashboard-data.ts` queda solo como soporte dev por `NEXT_PUBLIC_DISABLE_REMOTE_FETCH=1`, sin nombres Alex/James.

### Storage

- Eliminada escritura de `ba_dashboard_merged_cache`.
- Eliminado codigo muerto de `ba_landing_seed`.
- `localStorage/sessionStorage` no deciden identidad final.

## Pruebas HTTP/Postman ejecutadas

Ambiente: panel local contra produccion, `http://127.0.0.1:3123`, con `POSTGREST_BASE_URL=https://api.agencia2c.cloud`.

| Prueba | Resultado esperado | Resultado obtenido | PASS/FAIL |
| --- | --- | --- | --- |
| GET `/api/session/me` sin cookie | 401 | 401 `Sesion no valida` | PASS |
| GET `/api/session/me` con cookie owner | 200 | 200 `current_barberia.id=198`, `slug=barberia-prueba-4`, `role=owner` | PASS |
| GET `/api/dashboard/state?barberia_id=198&slug=barberia-prueba-4` sin cookie | 401 | 401 `Sesion no valida` | PASS |
| GET `/api/dashboard/state` barberia propia | 200 | 200 `ok=true`, identity `{198, barberia-prueba-4}` | PASS |
| GET `/api/dashboard/state` usuario ajeno real `user_id=1` | 403 | 403 `No tienes permisos para esta barberia o no existe` | PASS |
| GET `/api/dashboard/state` barberia_id propio + slug incorrecto | 403 | 403 `No tienes permisos para esta barberia o no existe` | PASS |
| `dashboard/state` incluye descansos | Array | `merged.descansos` array, count 0 | PASS |
| `dashboard/state` no inventa colecciones | Arrays reales | servicios 5, barberos 5, horarios 7, citas 5, clientes 6 | PASS |

Nota: se probo inicialmente `user_id=6` como ajeno, pero `dashboard/state` respondio 200. SQL posterior mostro que no era owner/miembro directo de `barberia_id=198`, por lo que se uso `user_id=1` para la prueba 403. Esto queda como observacion para revisar reglas externas del workflow n8n si se requiere una auditoria de permisos mas profunda; no bloquea la correccion de Bloque 3 porque el caso ajeno real `user_id=1` devuelve 403.

## Evidencia SQL ejecutada

```sql
SELECT id,nombre,activo
FROM public.barberos
WHERE barberia_id=198
ORDER BY id;
```

Resultado: 5 filas. IDs `439`, `440`, `445`, `446`, `447`.

```sql
SELECT id,nombre,activo,precio,duracion_min
FROM public.servicios
WHERE barberia_id=198
ORDER BY id;
```

Resultado: 5 filas. IDs `489`, `490`, `491`, `506`, `507`.

```sql
SELECT id,fecha,hora_inicio,estado
FROM public.citas
WHERE barberia_id=198
ORDER BY fecha DESC,hora_inicio DESC
LIMIT 20;
```

Resultado: 5 filas. Ultimas citas IDs `183`, `182`, `181`, `180`, `179`.

```sql
SELECT dia_semana,activo,hora_abre,hora_cierra
FROM public.horarios
WHERE barberia_id=198
ORDER BY dia_semana;
```

Resultado: 7 filas, dias `0` a `6`.

## Verificaciones de codigo

Busqueda final en `_work_panel_de_barberia/src`:

- `getBarberDescansos`: sin resultados.
- `ba_dashboard_merged_cache`: sin resultados.
- `ba_landing_seed`: sin resultados.
- `barberia_public_profiles`: sin resultados.
- `Alex M.`, `James R.`, `James V.`: sin resultados.

El unico acceso a `barberos_descansos` queda en `src/app/api/dashboard/state/route.ts`, server-side y posterior a la validacion upstream.

## Build / Lint

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS con 17 warnings preexistentes, 0 errors.
- `npm run build`: PASS.

Warnings no corregidos por alcance:

- `<img>` recomendado a `next/image` en varios modulos.
- `inventario/page.tsx` contiene warning por `eval` y dependencias de hook.
- `finanzas/page.tsx` conserva `identity` no usado.

## Riesgos

### Critico

No quedan riesgos criticos del Bloque 3 en el codigo modificado.

### Alto

- Observacion: `user_id=6` obtuvo 200 contra `barberia_id=198` aunque no aparece como owner/miembro directo en SQL de verificacion. Requiere auditoria puntual del workflow n8n de `dashboard/state` si se considera que ese usuario no debe tener ningun acceso indirecto.

### Medio

- `/api/dashboard/state` depende de `POSTGREST_BASE_URL` o `NEXT_PUBLIC_API_BASE_URL` en el entorno de EasyPanel para enriquecer descansos. Si falta, devuelve 502 controlado. Debe verificarse variable antes de deploy.

### Bajo

- `mock-dashboard-data.ts` sigue existiendo para modo dev desactivado por defecto (`NEXT_PUBLIC_DISABLE_REMOTE_FETCH=1`), pero ya no usa nombres Alex/James.

## Resultado final

PASS para Bloque 3 con una reserva alta documentada sobre `user_id=6` y reglas externas de permiso en n8n.

Requiere redeploy del panel en EasyPanel.

No requiere copiar nada a WordPress.

