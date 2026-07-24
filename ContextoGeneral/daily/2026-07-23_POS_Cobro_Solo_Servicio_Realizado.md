# Gate final POS: cobro solo después del servicio

Fecha de ejecución del gate: 2026-07-24

## Alcance y producción

Este gate valida la rama `fix/pos-charge-only-after-service` sin desplegar ni
modificar producción.

- Modificaciones anteriores a este gate: la base de datos y el workflow n8n POS
  ya habían sido modificados previamente, según la evidencia histórica del
  repositorio.
- Modificaciones durante este gate: ninguna en PostgreSQL de producción, n8n de
  producción o EasyPanel.
- No se usó `/webhook/temp_postgres_exec`.
- No se ejecutó merge ni rollback en producción.
- Billing, suscripciones, licencias y Mercado Pago quedaron fuera del alcance.

## Estado real de los PR al inicio

| Repositorio | PR | Draft | Mergeable | Merge state | Head |
|---|---:|---|---|---|---|
| `barberagency-core` | #3 | `true` | `MERGEABLE` | `CLEAN` | `eeddb4f9e007f871b19a79dc3ab530732358eeb1` |
| `panel_de_barberia` | #1 | `true` | `MERGEABLE` | `UNSTABLE` | `61212a80350872b121581a2c28e8ce76e395ba77` |

El estado final debe volver a consultarse después del push. `UNSTABLE` no se
trata como `CLEAN`, aunque GitHub sí reportó el PR como mergeable.

## Clasificación de pruebas

| Clasificación | Artefacto/comando | Resultado |
|---|---|---|
| `MODEL_SPEC` | `node pruebas/test_pos_model_spec.js` | 14/14 PASS |
| `REAL_POSTGRES_INTEGRATION` | `node pruebas/test_pos_postgres_integration.js` | 24/24 PASS |
| `REAL_POSTGRES_CONCURRENCY` | misma suite, dos clientes `pg` y `Promise.allSettled` | PASS; un único pago |
| `REAL_ROLLBACK_INTEGRATION` | misma suite, rollback SQL y `pg_get_functiondef` | PASS |
| `REAL_NEXTJS_HANDLER` | `npx vitest run tests/pos-route.test.ts` | 9/9 PASS |
| `BUILD_VALIDATION` | `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm run build` | exit 0 en los cuatro |

La antigua `pruebas/test_pos_sql_integration.js` era una simulación JavaScript
en memoria y fue eliminada. `test_pos_model_spec.js` se conserva explícitamente
como especificación de modelo, no como integración SQL.

## PostgreSQL real aislado

- Método: contenedor Docker local, sin producción ni staging compartido.
- Contenedor: `barberagency-pos-test`.
- Imagen: `postgres:16`.
- Puerto local: `127.0.0.1:55432`.
- Versión reportada: `16.14 (Debian 16.14-1.pgdg13+1)`.
- Esquema: `pruebas/fixtures/pos_minimal_schema.sql`.
- Driver: paquete `pg`.
- Casos reales ejecutados: 24.
- Concurrencia: dos conexiones PostgreSQL independientes y llamadas simultáneas
  mediante `Promise.allSettled`.
- Resultado de concurrencia: un `ok=true`, un `cita_ya_pagada`, una fila en
  `pagos` y cita final `pagada`.

### Rollback real

- Hash SHA-256 previo:
  `6b5a07fa7f1b1a89cf68d1efe61d70fcdb97db7c8db2cc4d78d083af908da353`
- Hash SHA-256 posterior al rollback:
  `6b5a07fa7f1b1a89cf68d1efe61d70fcdb97db7c8db2cc4d78d083af908da353`
- Coincidencia: `true`.
- `fn_pos_registrar_pago_realizada(...)` después del rollback: `NULL`.
- `fn_pos_registrar_venta_mostrador(...)` después del rollback: `NULL`.

## Handler Next.js real

`tests/pos-route.test.ts` importa y ejecuta `POST` desde
`src/app/api/pos/route.ts`. Solo se simulan la cookie de sesión, la respuesta de
`/api/dashboard/state` y el `fetch` hacia n8n.

Pasaron nueve casos: 401 sin sesión; 400 tenant inválido; 400 monto negativo;
403 cita ajena; 409 cita no realizada; 409 cita ya pagada; 200 válida;
`ok:false` con HTTP 200 convertido a 409; y propagación del error HTTP de n8n.

## Validación dashboard

| Comando | Exit code | Resultado | Últimas líneas relevantes |
|---|---:|---|---|
| `npm ci` | 0 | PASS | 389 paquetes; auditoría reportó 6 vulnerabilidades (1 baja, 5 altas) |
| `npx tsc --noEmit` | 0 | PASS | sin errores |
| `npm run lint` | 0 | PASS con warnings | 22 warnings, 0 errores |
| `npm run build` | 0 | PASS | 26/26 páginas; `/inventario` prerenderizada |
| `npm test` | 0 | PASS | 5 archivos, 38 pruebas |

## Rol PostgreSQL de n8n

- `CURRENT_PRODUCTION_N8N_DB_USER`: no verificado en vivo durante este gate. El
  workflow guardado referencia la credencial n8n `Postgres account`; el nombre
  SQL del usuario no aparece expuesto en el artefacto.
- `CURRENT_ROLE_SUPERUSER`: la documentación previa del repositorio registra
  que n8n usa una credencial PostgreSQL superuser. No se volvió a consultar
  producción durante este gate.
- `PLANNED_N8N_ROLE`: `barberagency_n8n_pos`.
- `ROLE_MIGRATION_EXECUTED`: `false`.

Diseño planificado, no ejecutado:

```sql
CREATE ROLE barberagency_n8n_pos
  LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

REVOKE ALL ON FUNCTION
  public.fn_pos_registrar_pago_realizada(integer, integer, numeric, text)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION
  public.fn_pos_registrar_venta_mostrador(integer, integer, integer, numeric, text, text, text)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.fn_pos_registrar_pago_realizada(integer, integer, numeric, text)
  TO barberagency_n8n_pos;
GRANT EXECUTE ON FUNCTION
  public.fn_pos_registrar_venta_mostrador(integer, integer, integer, numeric, text, text, text)
  TO barberagency_n8n_pos;
```

La migración del rol requiere una ventana productiva separada, respaldo,
confirmación del usuario SQL real usado por la credencial n8n y revocación
controlada del acceso anterior. No está implementada por este gate.

## Riesgos pendientes

- `npm ci` reporta 6 vulnerabilidades de dependencias (1 baja, 5 altas).
- Lint pasa con 22 warnings heredados.
- El usuario SQL real de la credencial n8n no se verificó en vivo.
- El estado final de checks y mergeabilidad debe registrarse después del push.
