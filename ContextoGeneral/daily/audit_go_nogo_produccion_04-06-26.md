# Auditoria final Go/No-Go PRODUCCION - 04-06-26

## Alcance

Auditoria ejecutada contra PRODUCCION usando tenant QA `barberia_id=185`, `slug=barberia-185`.

Controles aplicados:
- No se usaron barberias de clientes reales.
- Todo dato creado uso prefijo `QA_GO_NOGO_1780623422973`.
- No se borraron datos reales.
- Las citas QA se cancelaron, el servicio QA se desactivo y el descanso QA se elimino.
- Se verifico en PostgreSQL que no quedan citas confirmadas QA ni servicios QA activos.

## Decision

**GO con reservas.**

Motivo: los controles funcionales, multi-tenant, reservas publicas, landing, QR y RLS pasaron. La reserva publica ya responde con codigos controlados y no acepta servicio/barbero ajeno. La reserva valida crea cita y cliente; las invalidas fallan con `ok=false` y `code`.

Reserva pendiente: el validador automatico marco `cleanup datos QA=FAIL` por una lectura debil del resultado de cleanup, aunque la evidencia SQL muestra residuales activos en cero. Se debe ajustar el auditor para no generar falsos FAIL en cleanup.

## PASS/FAIL por modulo

| Modulo | Resultado |
| --- | --- |
| session/me | PASS |
| dashboard/state | PASS |
| servicios | PASS |
| citas dashboard | PASS |
| reservas publicas | PASS |
| slots publicos | PASS |
| barberos/descansos | PASS |
| publicacion | PASS |
| landing publica | PASS |
| QR | PASS |
| RLS / multi-tenant | PASS |
| build | PASS |
| lint | PASS con warnings |
| archivos sin trackear | FAIL operativo |
| datos QA residuales activos | PASS |
| verificador automatico de cleanup | FAIL de evidencia |

## Evidencia HTTP/Postman

| Prueba | HTTP | Resultado | Code |
| --- | ---: | --- | --- |
| session/me sin cookie | 401 | PASS |  |
| session/me cookie valida propia | 200 | PASS |  |
| dashboard/state sin cookie | 401 | PASS |  |
| dashboard/state cookie propia | 200 | PASS |  |
| dashboard/state cookie ajena | 403 | PASS |  |
| dashboard/state slug/id mismatch | 403 | PASS |  |
| servicios add QA propio | 200 | PASS | servicio_id=496 |
| servicios cookie ajena | 403 | PASS |  |
| slots servicio propio | 200 | PASS | slots_disponibles |
| slots servicio ajeno | 400 | PASS | servicio_no_pertenece |
| slots barbero ajeno | 400 | PASS | barbero_no_pertenece |
| reserva publica valida | 200 | PASS | reserva_creada |
| reserva publica solapada | 400 | PASS | slot_ocupado |
| reserva publica servicio ajeno | 400 | PASS | servicio_no_pertenece |
| citas dashboard add QA propio | 200 | PASS | cita_id=178 |
| citas dashboard cookie ajena | 403 | PASS |  |
| add_descanso QA | 200 | PASS | descanso_id=75 |
| slots en descanso | 400 | PASS | descanso_barbero |
| delete_descanso QA | 200 | PASS |  |
| publicacion propia | 200 | PASS |  |
| publicacion ajena | 403 | PASS |  |
| landing public endpoint | 200 | PASS |  |
| ba_get_landing_publica URLs correctas | 200 | PASS |  |
| /b/slug landing publica | 200 | PASS |  |
| RPC publicar anon directo | 401 | PASS | 42501 |

## Evidencia SQL

Baseline QA:
- `barberia_id=185`
- `slug=barberia-185`
- `owner_id=8`
- `servicio_id=435`
- `barbero_id=400`
- `estado=activa`
- `deleted_at=null`

Snapshot publicacion QA antes de la prueba:
- `publicada=true`
- `published_at=2026-05-28T21:04:14.443Z`

Datos QA creados:
- Servicio QA: `id=496`
- Cita publica QA: `id=177`, cliente `id=145`
- Cita dashboard QA: `id=178`, cliente `id=146`
- Descanso QA: `id=75`

Evidencia antes de cleanup:

```sql
SELECT id, barberia_id, barbero_id, servicio_id, cliente_id, cliente_nombre, cliente_tel, fecha, hora_inicio, hora_fin, estado
FROM public.citas
WHERE barberia_id = 185
  AND cliente_nombre LIKE 'QA_GO_NOGO_1780623422973%';
```

Resultado:
- `177`, `estado=confirmada`, `cliente_nombre=QA_GO_NOGO_1780623422973_CLIENTE_PUBLICO`
- `178`, `estado=confirmada`, `cliente_nombre=QA_GO_NOGO_1780623422973_CLIENTE_DASH`

```sql
SELECT id, barberia_id, nombre, telefono
FROM public.clientes_finales
WHERE barberia_id = 185
  AND nombre LIKE 'QA_GO_NOGO_1780623422973%';
```

Resultado:
- `145`, `QA_GO_NOGO_1780623422973_CLIENTE_PUBLICO`
- `146`, `QA_GO_NOGO_1780623422973_CLIENTE_DASH`

Cleanup ejecutado:
- Citas `177` y `178` actualizadas a `estado='cancelada'`.
- Servicio `496` actualizado a `activo=false`.
- Descanso `75` eliminado.

Verificacion de residuales activos:
- `citas_confirmadas = 0`
- `servicios_activos = 0`
- `descansos_qa = 0`

## Build / Lint

`npm run build` en `_work_panel_de_barberia`: PASS.

`npm run lint` en `_work_panel_de_barberia`: PASS con 24 warnings, 0 errores.

Warnings relevantes:
- Uso de `<img>` en varias pantallas/componentes.
- Variables no usadas.
- `eval` en inventario, marcado como `react-hooks/unsupported-syntax`.

## Archivos sin trackear

Riesgo operativo: hay archivos sin trackear en `pruebas/`, no bloquean runtime pero ensucian release/auditoria.

Archivos detectados:
- `pruebas/dashboard_state_workflow_backup.json`
- `pruebas/inspect_barberias_cols.js`
- `pruebas/inspect_barberos_servicios.js`
- `pruebas/inspect_citas_debug.js`
- `pruebas/inspect_horarios.js`
- `pruebas/inspect_public_profiles.js`
- `pruebas/inspect_view_def.js`
- `pruebas/list_n8n_workflows.js`
- `pruebas/test_citas_query.js`
- `pruebas/test_config_claims.js`
- `pruebas/test_rpc_direct.js`

## Riesgos

### CRITICO

No se detectaron riesgos criticos activos:
- No hubo bypass de JWT.
- No hubo contaminacion entre tenants en endpoints probados.
- No hubo reservas con servicio/barbero ajeno.
- No quedaron citas QA confirmadas.

### ALTO

Ninguno activo en runtime.

Observacion: el auditor automatico produjo `cleanup datos QA=FAIL` aunque SQL mostro cleanup correcto. Esto debe corregirse porque puede ocultar un fallo real o generar ruido en futuras auditorias.

### MEDIO

- Lint tiene warnings acumulados, especialmente `eval` en inventario. No bloqueo el build, pero debe corregirse antes de endurecer gates de CI.
- Hay archivos sin trackear en `pruebas/`.

### BAJO

- Uso de `<img>` en Next.js genera warnings de optimizacion.
- Variables no usadas en frontend.

## Recomendacion tecnica

El sistema puede avanzar como **GO con reservas** para produccion desde seguridad funcional y SSOT de reservas publicas.

Antes de declarar **GO limpio**, ejecutar:
1. Ajustar el auditor de cleanup para validar explicitamente filas/resultados SQL y no marcar falsos FAIL.
2. Resolver o clasificar los archivos sin trackear.
3. Eliminar `eval` de inventario y bajar warnings de lint.
4. Convertir esta auditoria en smoke test automatizado recurrente con tenant QA controlado.
