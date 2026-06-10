# P0 Bloque 5 - Correccion Publicacion Publica Robusta

Fecha: 2026-06-10

## Objetivo

Corregir los riesgos P0/P1 detectados en publicacion publica, editor de landing, borradores y endpoints de publicacion.

No se avanzo al Bloque 6. No se tocaron reservas. No se cambio logica funcional de POS; solo se removieron referencias `NEXT_PUBLIC_*` a endpoints server-side. No se modifico configuracion fuera de validacion de publicacion/draft.

## Causa raiz confirmada

1. `publishBarbershopViaRpc` publicaba desde el navegador directo a n8n.
2. `saveLandingDraft` y `publishLanding` usaban endpoints configurables en cliente para webhooks n8n.
3. `/api/editor/publish` validaba cookie pero no validaba `barberia_id + slug` antes de reenviar a n8n.
4. `env.ts` exponia variables `NEXT_PUBLIC_*` para webhooks internos.
5. `ba_get_landing_publica` y `ba_resolver_qr` son lecturas publicas directas toleradas, no escrituras.

## Archivos modificados

Panel:

- `_work_panel_de_barberia/src/app/api/editor/auth.ts`
- `_work_panel_de_barberia/src/app/api/editor/publish/route.ts`
- `_work_panel_de_barberia/src/app/api/editor/draft/route.ts`
- `_work_panel_de_barberia/src/lib/dashboard-api.ts`
- `_work_panel_de_barberia/src/store/dashboard-context.tsx`
- `_work_panel_de_barberia/src/lib/env.ts`
- `_work_panel_de_barberia/src/app/api/session/me/route.ts`
- `_work_panel_de_barberia/src/app/api/dashboard/state/route.ts`
- `_work_panel_de_barberia/src/app/api/pos/route.ts`

Core:

- `ContextoGeneral/daily/2026-06-10_P0_Bloque5_Correccion_Publicacion_Landing.md`

## Cambios aplicados

### Proxy same-origin para publicacion

- `publishBarbershopViaRpc` ahora llama `POST /api/editor/publish`.
- El payload enviado incluye:
  - `p_barberia_id`
  - `barberia_id`
  - `slug`
  - `payload` actual del editor (`merged`)
  - `source=dashboard_editor`
- Ya no existe llamada cliente directa a `/webhook/barberagency/dashboard/publicar`.

### Proxy same-origin para borradores

- Creado `POST /api/editor/draft`.
- `saveLandingDraft` ahora llama `/api/editor/draft` con `credentials: include`.
- Ya no existe llamada cliente directa a `/webhook/barberagency/landing/draft/save`.

### Validacion de sesion, tenant y slug

- Creado helper server-only `src/app/api/editor/auth.ts`.
- El helper:
  - Lee cookie `ba_session`.
  - Llama server-side a `SESSION_ME_ENDPOINT`.
  - Valida que `barberia_id` exista en `current_barberia` o `barberias` autorizadas.
  - Valida que `slug` coincida exactamente si viene en payload.
- Si falla auth/tenant/slug, `/api/editor/publish` y `/api/editor/draft` devuelven error local y no reenvian a n8n.

Codigos:

- `no_autorizado_anonimo` -> 401
- `barberia_ajena` -> 403
- `slug_mismatch` -> 403
- `barberia_id_requerido` -> 400

### Variables sensibles

- Eliminado del cliente el uso de:
  - `NEXT_PUBLIC_DRAFT_SAVE_ENDPOINT`
  - `NEXT_PUBLIC_PUBLISH_ENDPOINT`
  - `NEXT_PUBLIC_DASHBOARD_STATE_ENDPOINT`
  - `NEXT_PUBLIC_SESSION_ME_ENDPOINT`
- Rutas server-side usan variables sin prefijo `NEXT_PUBLIC`.
- Cliente conserva rutas same-origin:
  - `/api/editor/publish`
  - `/api/editor/draft`
  - `/api/dashboard/state`
  - `/api/session/me`

### Lectura publica RPC

- `ba_get_landing_publica` y `ba_resolver_qr` quedan como lecturas publicas toleradas desde `https://api.agencia2c.cloud`.
- No se usan para escritura privada.
- No se usan para reconstruir payload vivo de publicacion.

## Pruebas HTTP/Postman ejecutadas

Ambiente: panel local desplegable contra produccion, `http://127.0.0.1:3124`.

| Endpoint | Caso | Esperado | Obtenido | Resultado |
| --- | --- | --- | --- | --- |
| `POST /api/editor/publish` | barberia propia 198 | 200 | 200 `ok=true`, `slug=barberia-prueba-4`, `qr_code=QR04851428` | PASS |
| `POST /api/editor/publish` | sin cookie | 401 | 401 `code=no_autorizado_anonimo` | PASS |
| `POST /api/editor/publish` | usuario ajeno `user_id=1` | 403 | 403 `code=barberia_ajena` | PASS |
| `POST /api/editor/publish` | `barberia_id=198` + slug incorrecto | 403 | 403 `code=slug_mismatch` | PASS |
| `POST /api/editor/draft` | barberia propia 198 | 200 | 200 `ok=true`, `key=id:198` | PASS |
| `POST /api/editor/draft` | sin cookie | 401 | 401 `code=no_autorizado_anonimo` | PASS |
| `POST /api/editor/draft` | usuario ajeno `user_id=1` | 403 | 403 `code=barberia_ajena` | PASS |
| `POST /api/editor/draft` | `barberia_id=198` + slug incorrecto | 403 | 403 `code=slug_mismatch` | PASS |
| `POST /rpc/ba_get_landing_publica` | slug `barberia-prueba-4` | 200 | 200 `ok=true`, landing publicada | PASS |
| `POST /rpc/ba_resolver_qr` | `QR04851428` | 200 | 200 `slug=barberia-prueba-4`, `redirect_path=/b/barberia-prueba-4` | PASS |

Validacion adicional:

- Los casos 401/403 se resuelven antes del `fetch` hacia n8n en la API Route.
- El navegador ya no necesita conocer los webhooks internos de publicacion/draft.

## Pruebas funcionales

1. Publicar landing propia desde editor/proxy: PASS.
2. Landing publica carga despues de publicar: PASS (`ba_get_landing_publica` devuelve `ok=true` y `publicada=true`).
3. QR resuelve correctamente: PASS (`/b/barberia-prueba-4`).
4. Editor no llama directo a n8n para publish/draft: PASS por codigo.
5. No quedan variables `NEXT_PUBLIC_*` sensibles indicadas: PASS.
6. No se publica con snapshot viejo: PASS por payload actual enviado desde `merged`.
7. Payload publicado corresponde al payload actual del editor: PASS, `publishBarbershopViaRpc(identity, merged)`.

## SQL ejecutado

```sql
SELECT *
FROM public.barberia_public_profiles
WHERE barberia_id = 198;
```

Resultado: 1 fila, `slug=barberia-prueba-4`, `enabled=true`, `qr_enabled=true`, `public_landing_url=https://barberagency-barberagency.gymh5g.easypanel.host/b/barberia-prueba-4`.

```sql
SELECT *
FROM public.barberia_theme
WHERE barberia_id = 198;
```

Resultado: 1 fila, `primary_color=#000000`, `secondary_color=#111111`, `background_color=#FFFFFF`, `text_color=#ffffff`.

```sql
SELECT *
FROM public.barberia_assets
WHERE barberia_id = 198
ORDER BY orden, id;
```

Resultado: sin filas registradas para assets adicionales.

```sql
SELECT id, slug, nombre, owner_id
FROM public.barberias
WHERE id = 198;
```

Resultado: `id=198`, `slug=barberia-prueba-4`, `nombre=Barberia Prueba 4`, `owner_id=7`.

## Build / Lint

- `npx tsc --noEmit`: PASS.
- `npm run lint`: PASS con 17 warnings preexistentes, 0 errores.
- `npm run build`: PASS.

Warnings no corregidos por alcance:

- `<img>` recomendado a `next/image`.
- `inventario/page.tsx` conserva warnings por `eval` y dependencias de hook.
- `finanzas/page.tsx` conserva `identity` no usado.

## Riesgos eliminados

- Bypass directo de publicacion desde navegador a n8n.
- Guardado de borrador directo desde navegador a n8n.
- `barberia_id + slug` mismatch devolviendo 200 en publicacion.
- Variables `NEXT_PUBLIC_*` sensibles para endpoints internos listados en este bloque.

## Riesgos pendientes

- Existen otros webhooks n8n de modulos no pertenecientes al Bloque 5 que siguen siendo tratados en bloques posteriores del plan P0.
- `ba_get_landing_publica` y `ba_resolver_qr` siguen como lecturas publicas directas toleradas.

## Decision

GO para Bloque 5 con la reserva de que los demas modulos con webhooks directos se atiendan en sus bloques correspondientes.

Requiere redeploy del panel en EasyPanel.

No requiere copiar nada a WordPress.

